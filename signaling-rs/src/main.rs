//! Trading Room – Rust signaling server entry point.
//!
//! Boots the Axum HTTP / WebSocket server using configuration from
//! environment variables (loaded via `dotenvy`).

mod config;
mod services;
mod ws;

use std::net::SocketAddr;

use axum::{
    extract::WebSocketUpgrade,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use tokio::signal;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing::{info, warn};

use crate::config::Config;

/// GET /health – lightweight liveness probe.
async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok" }))
}

/// GET /ws – WebSocket upgrade endpoint.
async fn ws_upgrade(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(|socket| async move {
        // TODO: wire up full session handling from ws::session
        let _ = socket;
    })
}

/// Wait for SIGTERM (or SIGINT) for graceful shutdown.
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    warn!("Shutdown signal received – starting graceful shutdown");
}

#[tokio::main]
async fn main() {
    // Load .env file if present (ignored in production containers).
    let _ = dotenvy::dotenv();

    let cfg = Config::from_env();

    // --- Secret validation (non-dev) ----------------------------------------
    cfg.validate_secrets();

    // Initialise structured logging.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| cfg.log_level.clone().into()),
        )
        .json()
        .init();

    // CORS layer ---------------------------------------------------------------
    let origins: Vec<_> = cfg
        .cors_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    // Router -------------------------------------------------------------------
    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws_upgrade))
        .layer(cors);

    let addr = SocketAddr::new(cfg.host.parse().unwrap_or([0, 0, 0, 0].into()), cfg.port);

    info!("Signaling server listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind TCP listener");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");
}
