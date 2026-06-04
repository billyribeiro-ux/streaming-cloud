//! HTTP layer: router assembly and cross-cutting middleware.
//!
//! Domain route groups (`/v1/auth`, `/v1/rooms`, …) are mounted here as they
//! are implemented in later phases.

mod alerts;
mod analytics;
mod auth;
mod chat;
mod guard;
mod health;
mod metrics;
mod organizations;
mod rooms;
mod rooms_live;
mod workspaces;

use std::time::Duration;

use axum::http::{HeaderValue, StatusCode};
use axum::routing::get;
use axum::Router;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;

use crate::state::AppState;

/// Assembles the full API route table (no middleware, no state). Kept separate
/// so it can be built in tests to assert the table is conflict-free.
fn api_routes() -> Router<AppState> {
    Router::new()
        .merge(health::routes())
        .merge(auth::routes())
        .merge(organizations::routes())
        .merge(workspaces::routes())
        .merge(rooms::routes())
        .merge(rooms_live::routes())
        .merge(chat::routes())
        .merge(alerts::routes())
        .merge(analytics::routes())
        .route("/metrics", get(metrics::render))
}

/// Builds the application router with shared middleware applied.
pub fn router(state: AppState) -> Router {
    let cors = cors_layer(&state.config.cors_origins);

    api_routes()
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(30),
        ))
        .layer(cors)
        .with_state(state)
}

/// Derives the CORS policy from configuration: an explicit allow-list in
/// production, or a permissive policy when no origins are configured (dev).
fn cors_layer(origins: &[String]) -> CorsLayer {
    if origins.is_empty() {
        return CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);
    }

    let allowed: Vec<HeaderValue> = origins
        .iter()
        .filter_map(|origin| origin.parse().ok())
        .collect();

    CorsLayer::new()
        .allow_origin(allowed)
        .allow_methods(Any)
        .allow_headers(Any)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn router_table_is_conflict_free() {
        // `matchit` panics on conflicting routes/parameter names at construction;
        // building the full table here fails the test rather than at runtime.
        let _ = api_routes();
    }
}
