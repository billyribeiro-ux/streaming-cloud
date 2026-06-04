//! Chat endpoints (parity with the Laravel `ChatController`):
//! `GET/POST /v1/rooms/{room_id}/messages`, `DELETE /v1/messages/{id}`.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{delete, get};
use axum::{Json, Router};
use garde::Validate;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::db;
use crate::db::chat::NewMessage;
use crate::domain::chat::ChatMessage;
use crate::error::{AppError, AppResult};
use crate::http::guard;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/rooms/{room_id}/messages", get(index).post(store))
        .route("/v1/messages/{id}", delete(destroy))
}

#[derive(Debug, Deserialize)]
struct Pagination {
    page: Option<u32>,
    per_page: Option<u32>,
}

fn limits(p: &Pagination) -> (i64, i64) {
    let per_page = i64::from(p.per_page.unwrap_or(50).clamp(1, 100));
    let page = i64::from(p.page.unwrap_or(1).max(1));
    (per_page, (page - 1) * per_page)
}

async fn index(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
    Query(p): Query<Pagination>,
) -> AppResult<Json<Vec<ChatMessage>>> {
    guard::room_authorized(&state, room_id, user.id).await?;
    let (limit, offset) = limits(&p);
    Ok(Json(
        db::chat::list(&state.db, room_id, limit, offset).await?,
    ))
}

#[derive(Debug, Deserialize, Validate)]
struct CreateMessage {
    #[garde(length(min = 1, max = 2000))]
    content: String,
    #[serde(rename = "type")]
    #[garde(skip)]
    message_type: Option<String>,
}

async fn store(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
    Json(req): Json<CreateMessage>,
) -> AppResult<(StatusCode, Json<ChatMessage>)> {
    req.validate()?;
    guard::room_authorized(&state, room_id, user.id).await?;

    let message = db::chat::create(
        &state.db,
        NewMessage {
            room_id,
            user_id: user.id,
            content: req.content,
            message_type: normalize_type(req.message_type.as_deref()),
        },
    )
    .await?;

    Ok((StatusCode::CREATED, Json(message)))
}

async fn destroy(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let room_id = db::chat::room_id_of(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;
    guard::room_authorized(&state, room_id, user.id).await?;
    db::chat::soft_delete(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Clients may only post `text` (or `alert`) messages; anything else is coerced
/// to `text`. `system` messages are produced server-side only.
fn normalize_type(message_type: Option<&str>) -> String {
    match message_type {
        Some("alert") => "alert".to_string(),
        _ => "text".to_string(),
    }
}
