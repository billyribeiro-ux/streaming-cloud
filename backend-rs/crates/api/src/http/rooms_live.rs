//! Room lifecycle + signaling control-plane endpoints (parity with the Laravel
//! `RoomController` lifecycle actions):
//! `POST /v1/rooms/{room_id}/{start,end,join,leave,moderate}`,
//! `GET /v1/rooms/{room_id}/participants`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use garde::Validate;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::db;
use crate::db::participants::JoinParticipant;
use crate::domain::participant::RoomParticipant;
use crate::error::{AppError, AppResult};
use crate::http::guard;
use crate::signaling::{sfu, token};
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/rooms/{room_id}/start", post(start))
        .route("/v1/rooms/{room_id}/end", post(end))
        .route("/v1/rooms/{room_id}/join", post(join))
        .route("/v1/rooms/{room_id}/leave", post(leave))
        .route("/v1/rooms/{room_id}/participants", get(participants))
        .route("/v1/rooms/{room_id}/moderate", post(moderate))
}

async fn start(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let room = guard::room_authorized(&state, room_id, user.id).await?;
    let session_id = db::sessions::open(&state.db, room.id, user.id).await?;
    let room = db::rooms::mark_live(&state.db, room.id).await?;

    // Best-effort SFU allocation: the client still receives room/session info if
    // the signaling plane is momentarily unavailable.
    let sfu = match sfu::allocate_room(&state, room.id).await {
        Ok(value) => Some(value),
        Err(error) => {
            tracing::warn!(%error, "SFU allocation failed; returning room without SFU coordinates");
            None
        }
    };

    Ok(Json(
        json!({ "room": room, "session_id": session_id, "sfu": sfu }),
    ))
}

async fn end(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let room = guard::room_authorized(&state, room_id, user.id).await?;
    db::sessions::close_active(&state.db, room.id).await?;
    let room = db::rooms::mark_ended(&state.db, room.id).await?;
    sfu::close_room(&state, room.id).await;
    Ok(Json(json!({ "room": room })))
}

#[derive(Debug, Deserialize, Validate)]
struct JoinRequest {
    #[garde(inner(length(max = 255)))]
    display_name: Option<String>,
}

async fn join(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
    Json(req): Json<JoinRequest>,
) -> AppResult<Json<Value>> {
    req.validate()?;

    let room = db::rooms::find_by_id(&state.db, room_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Members may always join; non-members only when the room is public.
    let is_member = db::organizations::is_member(&state.db, room.organization_id, user.id).await?;
    if !is_member && !room.is_public {
        return Err(AppError::Forbidden);
    }

    let role = if room.created_by == user.id {
        "host"
    } else {
        "viewer"
    };
    let display_name = req
        .display_name
        .or_else(|| user.display_name.clone())
        .unwrap_or_else(|| user.name.clone());
    let session_id = db::sessions::active_id(&state.db, room.id).await?;

    let participant = db::participants::join(
        &state.db,
        JoinParticipant {
            room_id: room.id,
            session_id,
            user_id: user.id,
            role: role.to_string(),
            display_name: Some(display_name.clone()),
        },
    )
    .await?;

    let signaling_token = token::mint(
        &state.config.jwt_secret,
        token::MintParams {
            user_id: user.id,
            room_id: room.id,
            participant_id: participant.id,
            organization_id: room.organization_id,
            role: role.to_string(),
            display_name,
        },
    )?;

    Ok(Json(json!({
        "token": signaling_token,
        "participant": participant,
        "room": room,
        "signaling_url": state.config.signaling_url,
    })))
}

async fn leave(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    db::participants::leave(&state.db, room_id, user.id).await?;
    sfu::remove_participant(&state, room_id, user.id).await;
    Ok(StatusCode::NO_CONTENT)
}

async fn participants(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
) -> AppResult<Json<Vec<RoomParticipant>>> {
    guard::room_authorized(&state, room_id, user.id).await?;
    Ok(Json(
        db::participants::list_active(&state.db, room_id).await?,
    ))
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
enum ModerationAction {
    MuteAudio,
    MuteVideo,
    Kick,
}

#[derive(Debug, Deserialize)]
struct ModerateRequest {
    target_user_id: Uuid,
    action: ModerationAction,
}

async fn moderate(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
    Json(req): Json<ModerateRequest>,
) -> AppResult<StatusCode> {
    guard::room_authorized(&state, room_id, user.id).await?;

    match req.action {
        ModerationAction::MuteAudio => {
            sfu::mute_participant(&state, room_id, req.target_user_id, "audio").await;
        }
        ModerationAction::MuteVideo => {
            sfu::mute_participant(&state, room_id, req.target_user_id, "video").await;
        }
        ModerationAction::Kick => {
            db::participants::leave(&state.db, room_id, req.target_user_id).await?;
            sfu::remove_participant(&state, room_id, req.target_user_id).await;
        }
    }

    Ok(StatusCode::NO_CONTENT)
}
