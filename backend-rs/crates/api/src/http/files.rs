//! Room file endpoints (parity with the Laravel `FileController`):
//! `GET /v1/rooms/{room_id}/files` (list), `POST /v1/rooms/{room_id}/files`
//! (presigned upload), `GET /v1/files/{id}` (presigned download),
//! `DELETE /v1/files/{id}` (soft delete).
//!
//! Uploads/downloads go directly to R2 via presigned URLs; the API only stores
//! metadata and signs URLs.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use chrono::Utc;
use garde::Validate;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::db;
use crate::db::files::NewFile;
use crate::domain::file::RoomFile;
use crate::error::{AppError, AppResult};
use crate::http::guard;
use crate::s3;
use crate::state::AppState;

const PRESIGN_TTL_SECS: u32 = 900;
const MAX_FILE_BYTES: i64 = 50 * 1024 * 1024;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/rooms/{room_id}/files", get(index).post(create))
        .route("/v1/files/{id}", get(download).delete(destroy))
}

async fn index(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
) -> AppResult<Json<Vec<RoomFile>>> {
    guard::room_authorized(&state, room_id, user.id).await?;
    Ok(Json(db::files::list(&state.db, room_id).await?))
}

#[derive(Debug, Deserialize, Validate)]
struct CreateFile {
    #[garde(length(min = 1, max = 255))]
    file_name: String,
    #[garde(skip)]
    mime_type: Option<String>,
    #[garde(range(min = 0, max = MAX_FILE_BYTES))]
    file_size: i64,
}

async fn create(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(room_id): Path<Uuid>,
    Json(req): Json<CreateFile>,
) -> AppResult<(StatusCode, Json<Value>)> {
    req.validate()?;
    guard::room_authorized(&state, room_id, user.id).await?;

    let r2_key = format!(
        "rooms/{room_id}/{}/{}",
        Uuid::new_v4(),
        sanitize(&req.file_name)
    );

    let file = db::files::create(
        &state.db,
        NewFile {
            room_id,
            uploaded_by: user.id,
            file_name: req.file_name,
            r2_key: r2_key.clone(),
            file_size: req.file_size,
            mime_type: req.mime_type,
        },
    )
    .await?;

    let upload_url = presign(&state, "PUT", &r2_key);
    Ok((
        StatusCode::CREATED,
        Json(json!({ "file": file, "upload_url": upload_url })),
    ))
}

async fn download(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let file = db::files::find(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;
    guard::room_authorized(&state, file.room_id, user.id).await?;

    let download_url = presign(&state, "GET", &file.r2_key);
    Ok(Json(json!({ "download_url": download_url, "file": file })))
}

async fn destroy(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let file = db::files::find(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;
    guard::room_authorized(&state, file.room_id, user.id).await?;
    db::files::soft_delete(&state.db, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

fn presign(state: &AppState, method: &str, r2_key: &str) -> String {
    s3::presign(
        &s3::PresignParams {
            method,
            host: &state.config.r2_endpoint,
            region: &state.config.r2_region,
            access_key: &state.config.r2_access_key,
            secret_key: &state.config.r2_secret_key,
            key: &format!("{}/{}", state.config.r2_bucket, r2_key),
            expires_secs: PRESIGN_TTL_SECS,
        },
        Utc::now(),
    )
}

/// Keeps object keys safe: alphanumerics plus `.`, `-`, `_`; everything else
/// becomes `-`.
fn sanitize(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '-'
            }
        })
        .collect()
}
