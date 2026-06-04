//! Chat message repository.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::chat::ChatMessage;
use crate::error::AppResult;

pub struct NewMessage {
    pub room_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub message_type: String,
}

/// Lists visible (non-deleted) messages for a room, most recent first.
pub async fn list(
    pool: &PgPool,
    room_id: Uuid,
    limit: i64,
    offset: i64,
) -> AppResult<Vec<ChatMessage>> {
    Ok(sqlx::query_as::<_, ChatMessage>(
        "SELECT * FROM chat_messages \
         WHERE room_id = $1 AND is_deleted = false \
         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(room_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?)
}

pub async fn create(pool: &PgPool, new: NewMessage) -> AppResult<ChatMessage> {
    Ok(sqlx::query_as::<_, ChatMessage>(
        "INSERT INTO chat_messages (id, room_id, user_id, content, type, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, now(), now()) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(new.room_id)
    .bind(new.user_id)
    .bind(&new.content)
    .bind(&new.message_type)
    .fetch_one(pool)
    .await?)
}

/// Soft-deletes a message. Returns the room id it belonged to, if found.
pub async fn soft_delete(pool: &PgPool, id: Uuid) -> AppResult<Option<Uuid>> {
    Ok(sqlx::query_scalar(
        "UPDATE chat_messages SET is_deleted = true, updated_at = now() \
         WHERE id = $1 RETURNING room_id",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?)
}

pub async fn room_id_of(pool: &PgPool, id: Uuid) -> AppResult<Option<Uuid>> {
    Ok(
        sqlx::query_scalar("SELECT room_id FROM chat_messages WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?,
    )
}
