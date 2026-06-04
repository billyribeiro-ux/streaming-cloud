//! Shared application state. `AppState` is cheap to clone (the Postgres pool and
//! the Prometheus handle are internally reference-counted) and is handed to
//! every handler via `axum`'s `State` extractor.

use std::sync::Arc;
use std::time::Duration;

use metrics_exporter_prometheus::PrometheusHandle;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: PgPool,
    pub metrics: PrometheusHandle,
}

impl AppState {
    /// Builds the shared state. The pool is created lazily, so startup does not
    /// block on database availability — connections are established on first use
    /// and surfaced through the `/health/ready` probe.
    pub fn new(config: Config, metrics: PrometheusHandle) -> anyhow::Result<Self> {
        let db = PgPoolOptions::new()
            .max_connections(20)
            .min_connections(2)
            .acquire_timeout(Duration::from_secs(30))
            .connect_lazy(&config.database_url)?;

        Ok(Self {
            config: Arc::new(config),
            db,
            metrics,
        })
    }
}
