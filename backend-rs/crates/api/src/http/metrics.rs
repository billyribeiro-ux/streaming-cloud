//! Prometheus metrics endpoint (`/metrics`), parity with the Laravel
//! `MetricsController`. Renders the process-wide recorder installed at startup.

use axum::extract::State;

use crate::state::AppState;

/// Renders metrics in the Prometheus text exposition format.
pub async fn render(State(state): State<AppState>) -> String {
    state.metrics.render()
}
