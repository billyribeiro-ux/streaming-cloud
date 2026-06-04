//! Aggregation queries backing the analytics endpoints.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::room::RoomStatus;
use crate::error::AppResult;

pub async fn workspace_count(pool: &PgPool, org_ids: &[Uuid]) -> AppResult<i64> {
    Ok(
        sqlx::query_scalar("SELECT count(*) FROM workspaces WHERE organization_id = ANY($1)")
            .bind(org_ids)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn message_count(pool: &PgPool, room_id: Uuid) -> AppResult<i64> {
    Ok(sqlx::query_scalar(
        "SELECT count(*) FROM chat_messages WHERE room_id = $1 AND is_deleted = false",
    )
    .bind(room_id)
    .fetch_one(pool)
    .await?)
}

pub async fn rooms_by_status_for_org(
    pool: &PgPool,
    org_id: Uuid,
    status: RoomStatus,
) -> AppResult<i64> {
    Ok(
        sqlx::query_scalar("SELECT count(*) FROM rooms WHERE organization_id = $1 AND status = $2")
            .bind(org_id)
            .bind(status)
            .fetch_one(pool)
            .await?,
    )
}
