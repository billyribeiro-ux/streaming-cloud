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
