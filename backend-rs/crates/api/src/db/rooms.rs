//! Room repository.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::room::{Room, RoomStatus};
use crate::error::AppResult;
use crate::util::slugify;

pub struct NewRoom {
    pub workspace_id: Uuid,
    pub organization_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub recording_enabled: bool,
    pub is_public: bool,
    pub created_by: Uuid,
}

#[derive(Default)]
pub struct RoomUpdate {
    pub name: Option<String>,
    pub description: Option<String>,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub recording_enabled: Option<bool>,
    pub settings: Option<serde_json::Value>,
}

/// Lists rooms across the given organizations, optionally filtered by status.
pub async fn list(
    pool: &PgPool,
    org_ids: &[Uuid],
    status: Option<RoomStatus>,
    limit: i64,
    offset: i64,
) -> AppResult<Vec<Room>> {
    Ok(sqlx::query_as::<_, Room>(
        "SELECT * FROM rooms \
         WHERE organization_id = ANY($1) AND ($2::room_status IS NULL OR status = $2) \
         ORDER BY created_at DESC LIMIT $3 OFFSET $4",
    )
    .bind(org_ids)
    .bind(status)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?)
}

pub async fn count(pool: &PgPool, org_ids: &[Uuid], status: Option<RoomStatus>) -> AppResult<i64> {
    Ok(sqlx::query_scalar(
        "SELECT count(*) FROM rooms \
         WHERE organization_id = ANY($1) AND ($2::room_status IS NULL OR status = $2)",
    )
    .bind(org_ids)
    .bind(status)
    .fetch_one(pool)
    .await?)
}

pub async fn list_public(pool: &PgPool, limit: i64, offset: i64) -> AppResult<Vec<Room>> {
    Ok(sqlx::query_as::<_, Room>(
        "SELECT * FROM rooms WHERE is_public = true ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?)
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> AppResult<Option<Room>> {
    Ok(
        sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn create(pool: &PgPool, new: NewRoom) -> AppResult<Room> {
    Ok(sqlx::query_as::<_, Room>(
        "INSERT INTO rooms \
         (id, workspace_id, organization_id, name, description, slug, \
          scheduled_start, scheduled_end, recording_enabled, is_public, created_by, \
          created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now()) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(new.workspace_id)
    .bind(new.organization_id)
    .bind(&new.name)
    .bind(new.description)
    .bind(slugify(&new.name))
    .bind(new.scheduled_start)
    .bind(new.scheduled_end)
    .bind(new.recording_enabled)
    .bind(new.is_public)
    .bind(new.created_by)
    .fetch_one(pool)
    .await?)
}

pub async fn update(pool: &PgPool, id: Uuid, upd: RoomUpdate) -> AppResult<Room> {
    Ok(sqlx::query_as::<_, Room>(
        "UPDATE rooms SET \
            name = COALESCE($2, name), \
            description = COALESCE($3, description), \
            scheduled_start = COALESCE($4, scheduled_start), \
            scheduled_end = COALESCE($5, scheduled_end), \
            recording_enabled = COALESCE($6, recording_enabled), \
            settings = COALESCE($7, settings), \
            updated_at = now() \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(upd.name)
    .bind(upd.description)
    .bind(upd.scheduled_start)
    .bind(upd.scheduled_end)
    .bind(upd.recording_enabled)
    .bind(upd.settings)
    .fetch_one(pool)
    .await?)
}

/// Transitions a room to `live`, stamping `actual_start` on first go-live.
pub async fn mark_live(pool: &PgPool, id: Uuid) -> AppResult<Room> {
    Ok(sqlx::query_as::<_, Room>(
        "UPDATE rooms SET status = 'live'::room_status, \
            actual_start = COALESCE(actual_start, now()), updated_at = now() \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(pool)
    .await?)
}

/// Transitions a room to `ended`, stamping `actual_end`.
pub async fn mark_ended(pool: &PgPool, id: Uuid) -> AppResult<Room> {
    Ok(sqlx::query_as::<_, Room>(
        "UPDATE rooms SET status = 'ended'::room_status, \
            actual_end = now(), updated_at = now() \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(pool)
    .await?)
}

/// Soft-cancels a room (preserves history, sessions, recordings, and chat).
/// We never hard-delete rooms — the audit trail and recording references must
/// survive.
pub async fn cancel(pool: &PgPool, id: Uuid) -> AppResult<()> {
    sqlx::query(
        "UPDATE rooms SET status = 'cancelled'::room_status, updated_at = now() WHERE id = $1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}
