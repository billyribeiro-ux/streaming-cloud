//! Trading Room SaaS API — Rust rewrite (Phase B0 foundation).
//!
//! This binary boots the Axum application: typed configuration, JSON tracing,
//! a Prometheus recorder, a lazily-connected Postgres pool, the HTTP router,
//! and graceful shutdown on `SIGTERM`/`Ctrl-C`. Domain endpoints are added in
//! later phases (B1: auth, B2: rooms, …) on top of this skeleton.

mod config;
mod error;
mod http;
mod observability;
mod state;

use std::net::SocketAddr;

use anyhow::Context;

use crate::config::Config;
use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load `.env` in development; ignore if absent (production uses real env).
    let _ = dotenvy::dotenv();

    let config = Config::from_env()?;
    observability::init_tracing(&config.log_level);
    let metrics = observability::init_metrics();

    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .context("invalid API_HOST / API_PORT")?;

    let state = AppState::new(config, metrics)?;
    let app = http::router(state);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind {addr}"))?;

    tracing::info!(%addr, version = env!("CARGO_PKG_VERSION"), "tradingroom-api listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("server error")?;

    Ok(())
}

/// Resolves when the process receives `Ctrl-C` or (on Unix) `SIGTERM`,
/// allowing in-flight requests to drain before exit.
async fn shutdown_signal() {
    use tokio::signal;

    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl-C handler");
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

    tracing::info!("shutdown signal received — draining connections");
}
