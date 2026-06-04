//! Organization endpoints: `GET /v1/organizations` (the caller's memberships).

use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};

use crate::auth::AuthUser;
use crate::db;
use crate::domain::organization::Organization;
use crate::error::AppResult;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new().route("/v1/organizations", get(index))
}

async fn index(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> AppResult<Json<Vec<Organization>>> {
    Ok(Json(
        db::organizations::list_for_user(&state.db, user.id).await?,
    ))
}
