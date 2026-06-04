//! User domain model and its public projection.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

/// A user row as stored in Postgres. Carries the password hash, so it must
/// never be serialised directly to a client — use [`UserResponse`] for that.
///
/// This is the full persistence projection; not every audit column is read by
/// the current endpoints (later phases surface them), so dead-code analysis is
/// relaxed for the row model.
#[derive(Debug, Clone, FromRow)]
#[allow(dead_code)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password: String,
    pub name: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub timezone: Option<String>,
    pub email_verified_at: Option<DateTime<Utc>>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// The client-safe projection of a [`User`] (no credentials).
#[derive(Debug, Clone, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub timezone: Option<String>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            name: user.name,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            timezone: user.timezone,
        }
    }
}
