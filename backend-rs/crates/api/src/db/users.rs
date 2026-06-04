//! User repository: lookups, registration, profile and credential updates.
//!
//! Queries are static string literals (sqlx 0.9 requires `SqlSafeStr`); all
//! dynamic data is passed via bind parameters, never string interpolation.

use rand::distr::Alphanumeric;
use rand::Rng;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::user::User;
use crate::error::AppResult;

/// Data required to create a new user (password already hashed).
pub struct NewUser {
    pub name: String,
    pub email: String,
    pub password_hash: String,
}

/// Optional profile fields; `None` leaves the existing value unchanged.
#[derive(Default)]
pub struct ProfileUpdate {
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub timezone: Option<String>,
}

pub async fn find_by_email(pool: &PgPool, email: &str) -> AppResult<Option<User>> {
    Ok(sqlx::query_as::<_, User>(
        "SELECT id, email, password, name, display_name, avatar_url, timezone, \
                email_verified_at, last_login_at, created_at, updated_at \
         FROM users WHERE email = $1 AND deleted_at IS NULL",
    )
    .bind(email)
    .fetch_optional(pool)
    .await?)
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> AppResult<Option<User>> {
    Ok(sqlx::query_as::<_, User>(
        "SELECT id, email, password, name, display_name, avatar_url, timezone, \
                email_verified_at, last_login_at, created_at, updated_at \
         FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?)
}

pub async fn email_exists(pool: &PgPool, email: &str) -> AppResult<bool> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL)",
    )
    .bind(email)
    .fetch_one(pool)
    .await?;
    Ok(exists)
}

/// Registers a user together with their owning organization, mirroring the
/// Laravel `AuthController::register` transaction (user + organization + owner
/// membership), atomically.
pub async fn register(pool: &PgPool, new: NewUser) -> AppResult<User> {
    let mut tx = pool.begin().await?;

    let user_id = Uuid::new_v4();
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, email, password, name, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, now(), now()) \
         RETURNING id, email, password, name, display_name, avatar_url, timezone, \
                   email_verified_at, last_login_at, created_at, updated_at",
    )
    .bind(user_id)
    .bind(&new.email)
    .bind(&new.password_hash)
    .bind(&new.name)
    .fetch_one(&mut *tx)
    .await?;

    let org_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO organizations (id, name, slug, created_at, updated_at) \
         VALUES ($1, $2, $3, now(), now())",
    )
    .bind(org_id)
    .bind(format!("{}'s Organization", new.name))
    .bind(make_slug(&new.name))
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO organization_members \
         (id, organization_id, user_id, role, accepted_at, created_at, updated_at) \
         VALUES ($1, $2, $3, 'owner'::organization_role, now(), now(), now())",
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(user)
}

pub async fn update_profile(pool: &PgPool, id: Uuid, update: ProfileUpdate) -> AppResult<User> {
    Ok(sqlx::query_as::<_, User>(
        "UPDATE users SET \
            name = COALESCE($2, name), \
            display_name = COALESCE($3, display_name), \
            avatar_url = COALESCE($4, avatar_url), \
            timezone = COALESCE($5, timezone), \
            updated_at = now() \
         WHERE id = $1 AND deleted_at IS NULL \
         RETURNING id, email, password, name, display_name, avatar_url, timezone, \
                   email_verified_at, last_login_at, created_at, updated_at",
    )
    .bind(id)
    .bind(update.name)
    .bind(update.display_name)
    .bind(update.avatar_url)
    .bind(update.timezone)
    .fetch_one(pool)
    .await?)
}

pub async fn update_password(pool: &PgPool, id: Uuid, password_hash: &str) -> AppResult<()> {
    sqlx::query("UPDATE users SET password = $2, updated_at = now() WHERE id = $1")
        .bind(id)
        .bind(password_hash)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn touch_last_login(pool: &PgPool, id: Uuid) -> AppResult<()> {
    sqlx::query("UPDATE users SET last_login_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Builds a URL-safe, reasonably-unique organization slug from a display name.
fn make_slug(name: &str) -> String {
    let base: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    let base = base.trim_matches('-');
    let suffix: String = rand::rng()
        .sample_iter(Alphanumeric)
        .take(6)
        .map(|b| char::from(b).to_ascii_lowercase())
        .collect();

    if base.is_empty() {
        format!("org-{suffix}")
    } else {
        format!("{base}-{suffix}")
    }
}
