//! Authentication endpoints (parity with the Laravel `AuthController`):
//! `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/logout`,
//! `GET /v1/auth/me`, `PUT /v1/auth/profile`.

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post, put};
use axum::{Json, Router};
use garde::Validate;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::auth::extractor::bearer_token;
use crate::auth::password::{self, Verification};
use crate::auth::AuthUser;
use crate::db;
use crate::db::users::{NewUser, ProfileUpdate};
use crate::domain::user::UserResponse;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/auth/register", post(register))
        .route("/v1/auth/login", post(login))
        .route("/v1/auth/logout", post(logout))
        .route("/v1/auth/me", get(me))
        .route("/v1/auth/profile", put(update_profile))
}

#[derive(Debug, Deserialize, Validate)]
struct RegisterRequest {
    #[garde(length(min = 1, max = 255))]
    name: String,
    #[garde(email)]
    email: String,
    #[garde(length(min = 8, max = 255))]
    password: String,
}

#[derive(Debug, Deserialize, Validate)]
struct LoginRequest {
    #[garde(email)]
    email: String,
    #[garde(length(min = 1))]
    password: String,
}

#[derive(Debug, Deserialize, Validate)]
struct ProfileRequest {
    #[garde(inner(length(min = 1, max = 255)))]
    name: Option<String>,
    #[garde(inner(length(max = 255)))]
    display_name: Option<String>,
    #[garde(inner(length(max = 2048)))]
    avatar_url: Option<String>,
    #[garde(inner(length(max = 64)))]
    timezone: Option<String>,
}

#[derive(Debug, Serialize)]
struct AuthResponse {
    user: UserResponse,
    token: String,
}

async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> AppResult<(StatusCode, Json<AuthResponse>)> {
    req.validate().map_err(to_validation_error)?;

    if db::users::email_exists(&state.db, &req.email).await? {
        return Err(AppError::Validation(
            "email is already registered".to_string(),
        ));
    }

    let password_hash = password::hash_password(&req.password)?;
    let user = db::users::register(
        &state.db,
        NewUser {
            name: req.name,
            email: req.email,
            password_hash,
        },
    )
    .await?;

    let token = db::tokens::issue(&state.db, user.id, "auth").await?;

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            user: user.into(),
            token,
        }),
    ))
}

async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    req.validate().map_err(to_validation_error)?;

    let user = db::users::find_by_email(&state.db, &req.email)
        .await?
        .ok_or(AppError::Unauthorized)?;

    match password::verify_password(&req.password, &user.password) {
        Verification::Ok => {}
        Verification::OkNeedsRehash => {
            // Transparently upgrade the legacy bcrypt hash to Argon2.
            let upgraded = password::hash_password(&req.password)?;
            db::users::update_password(&state.db, user.id, &upgraded).await?;
        }
        Verification::Invalid => return Err(AppError::Unauthorized),
    }

    db::users::touch_last_login(&state.db, user.id).await?;
    let token = db::tokens::issue(&state.db, user.id, "auth").await?;

    Ok(Json(AuthResponse {
        user: user.into(),
        token,
    }))
}

async fn logout(
    State(state): State<AppState>,
    _user: AuthUser,
    headers: HeaderMap,
) -> AppResult<StatusCode> {
    if let Some(token) = bearer_token(&headers) {
        db::tokens::revoke(&state.db, token).await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn me(AuthUser(user): AuthUser) -> Json<Value> {
    Json(json!({ "user": UserResponse::from(user) }))
}

async fn update_profile(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(req): Json<ProfileRequest>,
) -> AppResult<Json<Value>> {
    req.validate().map_err(to_validation_error)?;

    let updated = db::users::update_profile(
        &state.db,
        user.id,
        ProfileUpdate {
            name: req.name,
            display_name: req.display_name,
            avatar_url: req.avatar_url,
            timezone: req.timezone,
        },
    )
    .await?;

    Ok(Json(json!({ "user": UserResponse::from(updated) })))
}

fn to_validation_error(report: garde::Report) -> AppError {
    AppError::Validation(report.to_string())
}
