//! Room file repository.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::file::RoomFile;
use crate::error::AppResult;

pub struct NewFile {
    pub room_id: Uuid,
    pub uploaded_by: Uuid,
    pub file_name: String,
    pub r2_key: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
}

pub async fn create(pool: &PgPool, new: NewFile) -> AppResult<RoomFile> {
    Ok(sqlx::query_as::<_, RoomFile>(
        "INSERT INTO room_files \
         (id, room_id, uploaded_by, file_name, r2_key, file_size, mime_type, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(new.room_id)
    .bind(new.uploaded_by)
    .bind(&new.file_name)
    .bind(&new.r2_key)
    .bind(new.file_size)
    .bind(new.mime_type)
    .fetch_one(pool)
    .await?)
}

pub async fn list(pool: &PgPool, room_id: Uuid) -> AppResult<Vec<RoomFile>> {
    Ok(sqlx::query_as::<_, RoomFile>(
        "SELECT * FROM room_files WHERE room_id = $1 AND is_deleted = false ORDER BY created_at DESC",
    )
    .bind(room_id)
    .fetch_all(pool)
    .await?)
}

pub async fn find(pool: &PgPool, id: Uuid) -> AppResult<Option<RoomFile>> {
    Ok(sqlx::query_as::<_, RoomFile>(
        "SELECT * FROM room_files WHERE id = $1 AND is_deleted = false",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?)
}

pub async fn soft_delete(pool: &PgPool, id: Uuid) -> AppResult<()> {
    sqlx::query("UPDATE room_files SET is_deleted = true, updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
