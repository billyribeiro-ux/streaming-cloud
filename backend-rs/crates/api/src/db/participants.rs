//! Room participant repository.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::participant::RoomParticipant;
use crate::error::AppResult;

pub struct JoinParticipant {
    pub room_id: Uuid,
    pub session_id: Option<Uuid>,
    pub user_id: Uuid,
    pub role: String,
    pub display_name: Option<String>,
}

/// Joins a user to a room. Any prior active presence for the same user is
/// marked as left first (reconnect semantics), then a fresh row is inserted.
pub async fn join(pool: &PgPool, p: JoinParticipant) -> AppResult<RoomParticipant> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        "UPDATE room_participants SET left_at = now(), connection_state = 'disconnected' \
         WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL",
    )
    .bind(p.room_id)
    .bind(p.user_id)
    .execute(&mut *tx)
    .await?;

    let participant = sqlx::query_as::<_, RoomParticipant>(
        "INSERT INTO room_participants \
         (id, room_id, session_id, user_id, role, display_name, connection_state, joined_at) \
         VALUES ($1, $2, $3, $4, $5, $6, 'connected', now()) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(p.room_id)
    .bind(p.session_id)
    .bind(p.user_id)
    .bind(&p.role)
    .bind(p.display_name)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(participant)
}

/// Marks a user's active presence in a room as left.
pub async fn leave(pool: &PgPool, room_id: Uuid, user_id: Uuid) -> AppResult<()> {
    sqlx::query(
        "UPDATE room_participants SET left_at = now(), connection_state = 'disconnected' \
         WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL",
    )
    .bind(room_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_active(pool: &PgPool, room_id: Uuid) -> AppResult<Vec<RoomParticipant>> {
    Ok(sqlx::query_as::<_, RoomParticipant>(
        "SELECT * FROM room_participants \
         WHERE room_id = $1 AND left_at IS NULL ORDER BY joined_at",
    )
    .bind(room_id)
    .fetch_all(pool)
    .await?)
}
