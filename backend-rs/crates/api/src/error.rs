//! Unified application error type — the shared error vocabulary for the API.
//!
//! Every fallible handler returns [`AppResult`]; errors render as RFC 7807
//! `application/problem+json` with an appropriate status code, and server-side
//! faults are logged with their full cause chain.
//!
//! This module is the foundation contract: its variants and the [`AppResult`]
//! alias are consumed by domain handlers as they land (B1 auth, B2 rooms, …),
//! so the unused-until-then surface is allowed deliberately here rather than
//! scattered across call sites.
#![allow(dead_code)]

use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("resource not found")]
    NotFound,

    #[error("authentication required")]
    Unauthorized,

    #[error("insufficient permissions")]
    Forbidden,

    #[error("validation failed: {0}")]
    Validation(String),

    #[error("database error")]
    Database(#[from] sqlx::Error),

    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}

impl AppError {
    fn status(&self) -> StatusCode {
        match self {
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::Unauthorized => StatusCode::UNAUTHORIZED,
            AppError::Forbidden => StatusCode::FORBIDDEN,
            AppError::Validation(_) => StatusCode::UNPROCESSABLE_ENTITY,
            AppError::Database(_) | AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status();

        // Server faults carry the underlying cause; never leak it to the client.
        if status.is_server_error() {
            tracing::error!(error = ?self, "request failed");
        }

        let detail = if status.is_server_error() {
            "internal server error".to_string()
        } else {
            self.to_string()
        };

        let body = Json(json!({
            "type": "about:blank",
            "title": status.canonical_reason().unwrap_or("Error"),
            "status": status.as_u16(),
            "detail": detail,
        }));

        let mut response = (status, body).into_response();
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/problem+json"),
        );
        response
    }
}

impl From<garde::Report> for AppError {
    fn from(report: garde::Report) -> Self {
        AppError::Validation(report.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
