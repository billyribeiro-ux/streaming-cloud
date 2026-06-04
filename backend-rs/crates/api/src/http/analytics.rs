//! Analytics endpoints (parity with the Laravel `AnalyticsController`):
//! `GET /v1/analytics/dashboard`, `/v1/analytics/rooms/{id}`,
//! `/v1/analytics/organization/{id}`.

use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::db;
use crate::domain::room::RoomStatus;
use crate::error::AppResult;
use crate::http::guard;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/analytics/dashboard", get(dashboard))
        .route("/v1/analytics/rooms/{id}", get(room_stats))
        .route("/v1/analytics/organization/{id}", get(org_stats))
}

async fn dashboard(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> AppResult<Json<Value>> {
    let org_ids = db::organizations::member_org_ids(&state.db, user.id).await?;

    let total_rooms = db::rooms::count(&state.db, &org_ids, None).await?;
    let live_rooms = db::rooms::count(&state.db, &org_ids, Some(RoomStatus::Live)).await?;
    let upcoming_rooms = db::rooms::count(&state.db, &org_ids, Some(RoomStatus::Scheduled)).await?;
    let total_workspaces = db::analytics::workspace_count(&state.db, &org_ids).await?;

    Ok(Json(json!({
        "total_rooms": total_rooms,
        "live_rooms": live_rooms,
        "upcoming_rooms": upcoming_rooms,
        "total_workspaces": total_workspaces,
    })))
}

async fn room_stats(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let room = guard::room_authorized(&state, id, user.id).await?;
    let message_count = db::analytics::message_count(&state.db, room.id).await?;

    Ok(Json(json!({
        "room_id": room.id,
        "status": room.status,
        "total_participants": room.total_participants,
        "peak_participants": room.peak_participants,
        "total_duration_minutes": room.total_duration_minutes,
        "message_count": message_count,
    })))
}

async fn org_stats(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    guard::ensure_member(&state, id, user.id).await?;

    let scheduled =
        db::analytics::rooms_by_status_for_org(&state.db, id, RoomStatus::Scheduled).await?;
    let live = db::analytics::rooms_by_status_for_org(&state.db, id, RoomStatus::Live).await?;
    let ended = db::analytics::rooms_by_status_for_org(&state.db, id, RoomStatus::Ended).await?;

    Ok(Json(json!({
        "organization_id": id,
        "rooms": {
            "scheduled": scheduled,
            "live": live,
            "ended": ended,
            "total": scheduled + live + ended,
        },
    })))
}
