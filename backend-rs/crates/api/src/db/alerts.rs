//! Alert repository.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::alert::Alert;
use crate::error::AppResult;

pub struct NewAlert {
    pub room_id: Uuid,
    pub user_id: Uuid,
    pub alert_type: String,
    pub title: String,
    pub message: String,
    pub priority: String,
}

pub async fn list(pool: &PgPool, room_id: Uuid) -> AppResult<Vec<Alert>> {
    Ok(sqlx::query_as::<_, Alert>(
        "SELECT * FROM alerts WHERE room_id = $1 ORDER BY created_at DESC",
    )
    .bind(room_id)
    .fetch_all(pool)
    .await?)
}

pub async fn create(pool: &PgPool, new: NewAlert) -> AppResult<Alert> {
    Ok(sqlx::query_as::<_, Alert>(
        "INSERT INTO alerts (id, room_id, user_id, type, title, message, priority, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(new.room_id)
    .bind(new.user_id)
    .bind(&new.alert_type)
    .bind(&new.title)
    .bind(&new.message)
    .bind(&new.priority)
    .fetch_one(pool)
    .await?)
}

pub async fn room_id_of(pool: &PgPool, id: Uuid) -> AppResult<Option<Uuid>> {
    Ok(
        sqlx::query_scalar("SELECT room_id FROM alerts WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?,
    )
}

/// Deletes an alert, returning the room id it belonged to, if found.
pub async fn delete(pool: &PgPool, id: Uuid) -> AppResult<Option<Uuid>> {
    Ok(
        sqlx::query_scalar("DELETE FROM alerts WHERE id = $1 RETURNING room_id")
            .bind(id)
            .fetch_optional(pool)
            .await?,
    )
}
