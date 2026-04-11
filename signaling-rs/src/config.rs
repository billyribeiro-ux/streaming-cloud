//! Configuration loaded from environment variables.
//!
//! Env vars intentionally match the Node.js `.env.example` so that the same
//! deployment configuration works for both servers during the migration window.

use std::env;

/// Top-level server configuration.
#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub host: String,
    pub jwt_secret: String,
    /// Shared secret used by Laravel SignalingService to authenticate control-
    /// plane HTTP requests **and** to verify participant JWTs when
    /// `SIGNALING_SERVER_SECRET` is set.
    pub control_plane_secret: String,
    /// Comma-separated list of SFU node origins (e.g. `http://localhost:4000`).
    pub sfu_nodes: Vec<String>,
    pub redis_url: String,
    pub database_url: String,
    pub cors_origins: Vec<String>,
    pub log_level: String,
}

impl Config {
    /// Build a [`Config`] from the current process environment.
    ///
    /// Call [`dotenvy::dotenv()`] **before** invoking this so that `.env` files
    /// are loaded.
    pub fn from_env() -> Self {
        Self {
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3000),
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            jwt_secret: env::var("JWT_SECRET").unwrap_or_else(|_| "dev-jwt-secret".into()),
            control_plane_secret: env::var("SIGNALING_SERVER_SECRET")
                .or_else(|_| env::var("SFU_SECRET"))
                .unwrap_or_else(|_| "dev-secret".into()),
            sfu_nodes: parse_csv(&env::var("SFU_NODES").unwrap_or_else(|_| "localhost:4000".into())),
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into()),
            database_url: env::var("DATABASE_URL").unwrap_or_default(),
            cors_origins: parse_csv(
                &env::var("CORS_ORIGINS").unwrap_or_else(|_| "http://localhost:5173".into()),
            ),
            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".into()),
        }
    }
}

fn parse_csv(s: &str) -> Vec<String> {
    s.split(',')
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty())
        .collect()
}
