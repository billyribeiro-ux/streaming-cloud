//! Workspace endpoints (parity with the Laravel `WorkspaceController`):
//! `GET/POST /v1/workspaces`, `GET /v1/workspaces/{id}`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use garde::Validate;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::db;
use crate::db::workspaces::NewWorkspace;
use crate::domain::workspace::Workspace;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/workspaces", get(index).post(store))
        .route("/v1/workspaces/{id}", get(show))
}

async fn index(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> AppResult<Json<Vec<Workspace>>> {
    let org_ids = db::organizations::member_org_ids(&state.db, user.id).await?;
    if org_ids.is_empty() {
        return Ok(Json(Vec::new()));
    }
    Ok(Json(
        db::workspaces::list_for_orgs(&state.db, &org_ids).await?,
    ))
}

#[derive(Debug, Deserialize, Validate)]
struct CreateWorkspace {
    #[garde(skip)]
    organization_id: Uuid,
    #[garde(length(min = 1, max = 255))]
    name: String,
    #[garde(inner(length(max = 1000)))]
    description: Option<String>,
}

async fn store(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(req): Json<CreateWorkspace>,
) -> AppResult<(StatusCode, Json<Workspace>)> {
    req.validate()?;

    if !db::organizations::is_member(&state.db, req.organization_id, user.id).await? {
        return Err(AppError::Forbidden);
    }

    let workspace = db::workspaces::create(
        &state.db,
        NewWorkspace {
            organization_id: req.organization_id,
            name: req.name,
            description: req.description,
        },
    )
    .await?;

    Ok((StatusCode::CREATED, Json(workspace)))
}

async fn show(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Workspace>> {
    let workspace = db::workspaces::find_by_id(&state.db, id)
        .await?
        .ok_or(AppError::NotFound)?;

    if !db::organizations::is_member(&state.db, workspace.organization_id, user.id).await? {
        return Err(AppError::Forbidden);
    }

    Ok(Json(workspace))
}
