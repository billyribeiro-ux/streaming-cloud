//! `AuthUser` extractor: authenticates a request from its `Authorization:
//! Bearer <token>` header, rejecting with `401` when absent or invalid.

use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;
use axum::http::HeaderMap;

use crate::db;
use crate::domain::user::User;
use crate::error::AppError;
use crate::state::AppState;

/// An authenticated user, resolved from the bearer token.
pub struct AuthUser(pub User);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = bearer_token(&parts.headers).ok_or(AppError::Unauthorized)?;

        let user_id = db::tokens::authenticate(&state.db, token)
            .await?
            .ok_or(AppError::Unauthorized)?;

        let user = db::users::find_by_id(&state.db, user_id)
            .await?
            .ok_or(AppError::Unauthorized)?;

        Ok(AuthUser(user))
    }
}

/// Extracts the bearer credential from the `Authorization` header, if present.
pub fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
}
