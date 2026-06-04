//! Platform-admin queries (cross-tenant; admin-only).

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::error::AppResult;

#[derive(Debug, Serialize, FromRow)]
pub struct AdminUserRow {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub is_admin: bool,
    pub created_at: DateTime<Utc>,
}

/// Platform-wide counts: (users, organizations, rooms, live rooms).
pub async fn platform_stats(pool: &PgPool) -> AppResult<(i64, i64, i64, i64)> {
    let users: i64 = sqlx::query_scalar("SELECT count(*) FROM users WHERE deleted_at IS NULL")
        .fetch_one(pool)
        .await?;
    let organizations: i64 = sqlx::query_scalar("SELECT count(*) FROM organizations")
        .fetch_one(pool)
        .await?;
    let rooms: i64 = sqlx::query_scalar("SELECT count(*) FROM rooms")
        .fetch_one(pool)
        .await?;
    let live_rooms: i64 =
        sqlx::query_scalar("SELECT count(*) FROM rooms WHERE status = 'live'::room_status")
            .fetch_one(pool)
            .await?;
    Ok((users, organizations, rooms, live_rooms))
}

pub async fn list_users(pool: &PgPool, limit: i64, offset: i64) -> AppResult<Vec<AdminUserRow>> {
    Ok(sqlx::query_as::<_, AdminUserRow>(
        "SELECT id, email, name, is_admin, created_at FROM users \
         WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?)
}

pub async fn count_users(pool: &PgPool) -> AppResult<i64> {
    Ok(
        sqlx::query_scalar("SELECT count(*) FROM users WHERE deleted_at IS NULL")
            .fetch_one(pool)
            .await?,
    )
}
