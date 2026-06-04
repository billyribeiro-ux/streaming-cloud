//! Plan repository.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::plan::Plan;
use crate::error::AppResult;

pub async fn list_active(pool: &PgPool) -> AppResult<Vec<Plan>> {
    Ok(sqlx::query_as::<_, Plan>(
        "SELECT * FROM plans WHERE is_active = true ORDER BY price_monthly_cents",
    )
    .fetch_all(pool)
    .await?)
}

pub async fn find(pool: &PgPool, id: Uuid) -> AppResult<Option<Plan>> {
    Ok(
        sqlx::query_as::<_, Plan>("SELECT * FROM plans WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?,
    )
}
