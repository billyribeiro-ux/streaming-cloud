//! Liveness and readiness probes (parity with the Laravel `HealthController`):
//! `/health`, `/health/live`, `/health/ready`, `/health/detailed`.

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};

use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(live))
        .route("/health/live", get(live))
        .route("/health/ready", get(ready))
        .route("/health/detailed", get(detailed))
}

/// Liveness: the process is up and the event loop is responsive.
async fn live() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

/// Readiness: the process can serve traffic, i.e. its dependencies answer.
async fn ready(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    let db_ok = database_reachable(&state).await;
    let status = if db_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    let body = json!({
        "status": if db_ok { "ready" } else { "degraded" },
        "database": db_ok,
    });

    (status, Json(body))
}

/// Detailed diagnostics for dashboards; always `200` so it can be scraped even
/// while a dependency is degraded.
async fn detailed(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "tradingroom-api",
        "version": env!("CARGO_PKG_VERSION"),
        "checks": {
            "database": database_reachable(&state).await,
        },
    }))
}

/// Cheap connectivity check against Postgres.
async fn database_reachable(state: &AppState) -> bool {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await
        .is_ok()
}
