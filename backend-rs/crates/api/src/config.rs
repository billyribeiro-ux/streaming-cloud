//! Process configuration, loaded and validated from the environment once at
//! startup. A later phase may layer this with `figment`; for the foundation a
//! small, explicit, fail-fast loader keeps the surface obvious.

use std::env;

use anyhow::Context;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub log_level: String,
    pub cors_origins: Vec<String>,
    /// Base URL of the signaling control-plane (Rust `signaling-rs`).
    pub signaling_url: String,
    /// Shared secret presented as a bearer token on control-plane calls.
    pub signaling_secret: String,
    /// HS256 key used to mint short-lived client signaling tokens.
    pub jwt_secret: String,
    /// Public base URL of the frontend (for Stripe redirect URLs).
    pub app_url: String,
    /// Stripe secret API key.
    pub stripe_secret: String,
    /// Stripe webhook signing secret (`whsec_…`).
    pub stripe_webhook_secret: String,
    /// Cloudflare R2 (S3-compatible) object storage.
    pub r2_endpoint: String,
    pub r2_bucket: String,
    pub r2_access_key: String,
    pub r2_secret_key: String,
    pub r2_region: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            host: env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: parse_env("API_PORT", 8080)?,
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                "postgres://postgres:postgres@localhost:5432/tradingroom".to_string()
            }),
            log_level: env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
            signaling_url: env::var("SIGNALING_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            signaling_secret: env::var("SIGNALING_SECRET")
                .unwrap_or_else(|_| "dev-signaling-secret".to_string()),
            jwt_secret: env::var("JWT_SECRET").unwrap_or_else(|_| "dev-jwt-secret".to_string()),
            app_url: env::var("APP_URL").unwrap_or_else(|_| "http://localhost:5173".to_string()),
            stripe_secret: env::var("STRIPE_SECRET").unwrap_or_default(),
            stripe_webhook_secret: env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default(),
            r2_endpoint: env::var("R2_ENDPOINT").unwrap_or_default(),
            r2_bucket: env::var("R2_BUCKET").unwrap_or_default(),
            r2_access_key: env::var("R2_ACCESS_KEY_ID").unwrap_or_default(),
            r2_secret_key: env::var("R2_SECRET_ACCESS_KEY").unwrap_or_default(),
            r2_region: env::var("R2_REGION").unwrap_or_else(|_| "auto".to_string()),
            cors_origins: env::var("CORS_ORIGINS")
                .map(|raw| {
                    raw.split(',')
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default(),
        })
    }
}

/// Parses a numeric environment variable, falling back to `default` when unset.
fn parse_env<T>(key: &str, default: T) -> anyhow::Result<T>
where
    T: std::str::FromStr,
    T::Err: std::error::Error + Send + Sync + 'static,
{
    match env::var(key) {
        Ok(raw) => raw
            .parse()
            .with_context(|| format!("invalid value for {key}: {raw:?}")),
        Err(_) => Ok(default),
    }
}
