//! Room session repository (a session spans one live broadcast of a room).

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;

/// Opens a new session for a room and returns its id.
pub async fn open(pool: &PgPool, room_id: Uuid, host_user_id: Uuid) -> AppResult<Uuid> {
    Ok(sqlx::query_scalar(
        "INSERT INTO room_sessions (id, room_id, host_user_id, started_at) \
         VALUES ($1, $2, $3, now()) RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind(room_id)
    .bind(host_user_id)
    .fetch_one(pool)
    .await?)
}

/// Returns the currently-open session id for a room, if any.
pub async fn active_id(pool: &PgPool, room_id: Uuid) -> AppResult<Option<Uuid>> {
    Ok(sqlx::query_scalar(
        "SELECT id FROM room_sessions \
         WHERE room_id = $1 AND ended_at IS NULL \
         ORDER BY started_at DESC LIMIT 1",
    )
    .bind(room_id)
    .fetch_optional(pool)
    .await?)
}

/// Closes any open session(s) for a room.
pub async fn close_active(pool: &PgPool, room_id: Uuid) -> AppResult<()> {
    sqlx::query(
        "UPDATE room_sessions SET ended_at = now() WHERE room_id = $1 AND ended_at IS NULL",
    )
    .bind(room_id)
    .execute(pool)
    .await?;
    Ok(())
}
