//! Alert endpoints (parity with the Laravel `AlertController`):
//! `GET/POST /v1/rooms/{room_id}/alerts`, `DELETE /v1/alerts/{id}`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get};
use axum::{Json, Router};
use garde::Validate;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::db;
use crate::db::alerts::NewAlert;
use crate::domain::alert::Alert;
use crate::error::{AppError, AppResult};
use crate::http::guard;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/rooms/{room_id}/alerts", get(index).post(store))
        .route("/v1/alerts/{id}", delete(destroy))
}

async fn index(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
) -> AppResult<Json<Vec<Alert>>> {
    guard::room_authorized(&state, room_id, user.id).await?;
    Ok(Json(db::alerts::list(&state.db, room_id).await?))
}

#[derive(Debug, Deserialize, Validate)]
struct CreateAlert {
    #[serde(rename = "type")]
    #[garde(skip)]
    alert_type: Option<String>,
    #[garde(length(min = 1, max = 255))]
    title: String,
    #[garde(length(min = 1, max = 2000))]
    message: String,
    #[garde(skip)]
    priority: Option<String>,
}

async fn store(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
    Json(req): Json<CreateAlert>,
) -> AppResult<(StatusCode, Json<Alert>)> {
    req.validate()?;
    guard::room_authorized(&state, room_id, user.id).await?;

    let alert = db::alerts::create(
        &state.db,
        NewAlert {
            room_id,
            user_id: user.id,
            alert_type: normalize_type(req.alert_type.as_deref()),
            title: req.title,
            message: req.message,
            priority: normalize_priority(req.priority.as_deref()),
        },
    )
    .await?;

    Ok((StatusCode::CREATED, Json(alert)))
}

async fn destroy(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let room_id = db::alerts::room_id_of(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;
    guard::room_authorized(&state, room_id, user.id).await?;
    db::alerts::delete(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

fn normalize_type(alert_type: Option<&str>) -> String {
    match alert_type {
        Some(t @ ("warning" | "trade" | "announcement")) => t.to_string(),
        _ => "info".to_string(),
    }
}

fn normalize_priority(priority: Option<&str>) -> String {
    match priority {
        Some(p @ ("low" | "high" | "urgent")) => p.to_string(),
        _ => "medium".to_string(),
    }
}
