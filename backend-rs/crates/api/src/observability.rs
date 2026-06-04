//! Tracing and metrics initialisation.
//!
//! Logs are emitted as structured JSON (filterable via `RUST_LOG`), and a
//! Prometheus recorder is installed process-wide; its handle is stored in
//! [`crate::state::AppState`] and rendered by the `/metrics` endpoint.

use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};
use tracing_subscriber::prelude::*;
use tracing_subscriber::EnvFilter;

/// Installs the global JSON tracing subscriber. `RUST_LOG` overrides the
/// provided `default_level` when present.
pub fn init_tracing(default_level: &str) {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(default_level));

    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().json())
        .init();
}

/// Installs the process-wide Prometheus recorder and returns its render handle.
pub fn init_metrics() -> PrometheusHandle {
    PrometheusBuilder::new()
        .install_recorder()
        .expect("failed to install Prometheus recorder")
}
