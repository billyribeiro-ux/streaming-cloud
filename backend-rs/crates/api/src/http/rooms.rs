//! Room endpoints (parity with the Laravel `RoomController` CRUD + listings):
//! `GET/POST /v1/rooms`, `GET /v1/rooms/{live,upcoming,public}`,
//! `GET/PUT/DELETE /v1/rooms/{id}`.
//!
//! Lifecycle endpoints (start/end/join/leave/moderate/recordings) that drive the
//! SFU control-plane land in a later increment alongside the signaling client.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use garde::Validate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::db;
use crate::db::rooms::{NewRoom, RoomUpdate};
use crate::domain::room::{Room, RoomStatus};
use crate::error::{AppError, AppResult};
use crate::http::guard;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/rooms", get(index).post(store))
        .route("/v1/rooms/live", get(live))
        .route("/v1/rooms/upcoming", get(upcoming))
        .route("/v1/rooms/public", get(public))
        .route("/v1/rooms/{room_id}", get(show).put(update).delete(destroy))
}

#[derive(Debug, Deserialize)]
struct ListQuery {
    page: Option<u32>,
    per_page: Option<u32>,
    status: Option<RoomStatus>,
}

#[derive(Serialize)]
struct Page<T> {
    data: Vec<T>,
    meta: Meta,
}

#[derive(Serialize)]
struct Meta {
    page: i64,
    per_page: i64,
    total: i64,
}

struct PageParams {
    limit: i64,
    offset: i64,
    page: i64,
    per_page: i64,
}

fn page_params(page: Option<u32>, per_page: Option<u32>) -> PageParams {
    let per_page = i64::from(per_page.unwrap_or(20).clamp(1, 100));
    let page = i64::from(page.unwrap_or(1).max(1));
    PageParams {
        limit: per_page,
        offset: (page - 1) * per_page,
        page,
        per_page,
    }
}

async fn index(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Page<Room>>> {
    let org_ids = db::organizations::member_org_ids(&state.db, user.id).await?;
    let pp = page_params(q.page, q.per_page);

    if org_ids.is_empty() {
        return Ok(Json(Page {
            data: Vec::new(),
            meta: Meta {
                page: pp.page,
                per_page: pp.per_page,
                total: 0,
            },
        }));
    }

    let data = db::rooms::list(&state.db, &org_ids, q.status, pp.limit, pp.offset).await?;
    let total = db::rooms::count(&state.db, &org_ids, q.status).await?;

    Ok(Json(Page {
        data,
        meta: Meta {
            page: pp.page,
            per_page: pp.per_page,
            total,
        },
    }))
}

#[derive(Debug, Deserialize, Validate)]
struct CreateRoom {
    #[garde(skip)]
    workspace_id: Uuid,
    #[garde(length(min = 1, max = 255))]
    name: String,
    #[garde(inner(length(max = 2000)))]
    description: Option<String>,
    #[garde(skip)]
    scheduled_start: Option<DateTime<Utc>>,
    #[garde(skip)]
    scheduled_end: Option<DateTime<Utc>>,
    #[garde(skip)]
    recording_enabled: Option<bool>,
    #[garde(skip)]
    is_public: Option<bool>,
}

async fn store(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(req): Json<CreateRoom>,
) -> AppResult<(StatusCode, Json<Room>)> {
    req.validate()?;

    let workspace = db::workspaces::find_by_id(&state.db, req.workspace_id)
        .await?
        .ok_or(AppError::NotFound)?;
    guard::ensure_member(&state, workspace.organization_id, user.id).await?;

    let room = db::rooms::create(
        &state.db,
        NewRoom {
            workspace_id: workspace.id,
            organization_id: workspace.organization_id,
            name: req.name,
            description: req.description,
            scheduled_start: req.scheduled_start,
            scheduled_end: req.scheduled_end,
            recording_enabled: req.recording_enabled.unwrap_or(false),
            is_public: req.is_public.unwrap_or(false),
            created_by: user.id,
        },
    )
    .await?;

    Ok((StatusCode::CREATED, Json(room)))
}

async fn show(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
) -> AppResult<Json<Room>> {
    Ok(Json(
        guard::room_authorized(&state, room_id, user.id).await?,
    ))
}

#[derive(Debug, Deserialize, Validate)]
struct UpdateRoom {
    #[garde(inner(length(min = 1, max = 255)))]
    name: Option<String>,
    #[garde(inner(length(max = 2000)))]
    description: Option<String>,
    #[garde(skip)]
    scheduled_start: Option<DateTime<Utc>>,
    #[garde(skip)]
    scheduled_end: Option<DateTime<Utc>>,
    #[garde(skip)]
    recording_enabled: Option<bool>,
    #[garde(skip)]
    settings: Option<serde_json::Value>,
}

async fn update(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
    Json(req): Json<UpdateRoom>,
) -> AppResult<Json<Room>> {
    req.validate()?;
    guard::room_authorized(&state, room_id, user.id).await?;

    let room = db::rooms::update(
        &state.db,
        room_id,
        RoomUpdate {
            name: req.name,
            description: req.description,
            scheduled_start: req.scheduled_start,
            scheduled_end: req.scheduled_end,
            recording_enabled: req.recording_enabled,
            settings: req.settings,
        },
    )
    .await?;

    Ok(Json(room))
}

async fn destroy(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    guard::room_authorized(&state, room_id, user.id).await?;
    // Soft-cancel rather than hard-delete (preserves history/recordings).
    db::rooms::cancel(&state.db, room_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn live(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> AppResult<Json<Vec<Room>>> {
    by_status(&state, user.id, RoomStatus::Live).await
}

async fn upcoming(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> AppResult<Json<Vec<Room>>> {
    by_status(&state, user.id, RoomStatus::Scheduled).await
}

async fn public(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<Vec<Room>>> {
    let pp = page_params(q.page, q.per_page);
    Ok(Json(
        db::rooms::list_public(&state.db, pp.limit, pp.offset).await?,
    ))
}

async fn by_status(
    state: &AppState,
    user_id: Uuid,
    status: RoomStatus,
) -> AppResult<Json<Vec<Room>>> {
    let org_ids = db::organizations::member_org_ids(&state.db, user_id).await?;
    if org_ids.is_empty() {
        return Ok(Json(Vec::new()));
    }
    Ok(Json(
        db::rooms::list(&state.db, &org_ids, Some(status), 100, 0).await?,
    ))
}
