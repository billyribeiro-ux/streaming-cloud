//! Tracing and metrics initialisation.
//!
//! Logs are emitted as structured JSON (filterable via `RUST_LOG`), and a
//! Prometheus recorder is installed process-wide; its handle is stored in
//! [`crate::state::AppState`] and rendered by the `/metrics` endpoint.

use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};
use opentelemetry::trace::TracerProvider as _;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::trace::{SdkTracer, SdkTracerProvider};
use opentelemetry_sdk::Resource;
use tracing_subscriber::prelude::*;
use tracing_subscriber::EnvFilter;

/// Installs the global JSON tracing subscriber. `RUST_LOG` overrides the
/// provided `default_level` when present.
///
/// When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, spans are additionally exported
/// to that OTLP/HTTP collector (e.g. the bundled Jaeger); otherwise tracing is
/// JSON-to-stdout only.
pub fn init_tracing(default_level: &str) {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(default_level));
    let fmt = tracing_subscriber::fmt::layer().json();

    if let Ok(endpoint) = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT") {
        match build_otlp_tracer(&endpoint) {
            Ok(tracer) => {
                tracing_subscriber::registry()
                    .with(filter)
                    .with(fmt)
                    .with(tracing_opentelemetry::layer().with_tracer(tracer))
                    .init();
                return;
            }
            Err(error) => {
                eprintln!("OTLP exporter init failed ({error}); continuing without span export");
            }
        }
    }

    tracing_subscriber::registry().with(filter).with(fmt).init();
}

/// Builds an OTLP/HTTP span exporter + batch tracer provider, registers it
/// globally, and returns a tracer for the tracing bridge layer.
fn build_otlp_tracer(endpoint: &str) -> anyhow::Result<SdkTracer> {
    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_endpoint(endpoint)
        .build()?;

    let provider = SdkTracerProvider::builder()
        .with_batch_exporter(exporter)
        .with_resource(
            Resource::builder()
                .with_service_name("tradingroom-api")
                .build(),
        )
        .build();

    let tracer = provider.tracer("tradingroom-api");
    opentelemetry::global::set_tracer_provider(provider);
    Ok(tracer)
}

/// Installs the process-wide Prometheus recorder and returns its render handle.
pub fn init_metrics() -> PrometheusHandle {
    PrometheusBuilder::new()
        .install_recorder()
        .expect("failed to install Prometheus recorder")
}
