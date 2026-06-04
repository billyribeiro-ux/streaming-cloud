//! Organization-membership queries used for authorization.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::organization::Organization;
use crate::error::AppResult;

/// Returns every organization the user belongs to (client-facing subset).
pub async fn list_for_user(pool: &PgPool, user_id: Uuid) -> AppResult<Vec<Organization>> {
    Ok(sqlx::query_as::<_, Organization>(
        "SELECT o.id, o.name, o.slug FROM organizations o \
         JOIN organization_members m ON m.organization_id = o.id \
         WHERE m.user_id = $1 ORDER BY o.created_at",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?)
}

/// Returns the ids of every organization the user belongs to.
pub async fn member_org_ids(pool: &PgPool, user_id: Uuid) -> AppResult<Vec<Uuid>> {
    Ok(
        sqlx::query_scalar("SELECT organization_id FROM organization_members WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(pool)
            .await?,
    )
}

/// Whether the user is a member of the given organization.
pub async fn is_member(pool: &PgPool, organization_id: Uuid, user_id: Uuid) -> AppResult<bool> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM organization_members \
         WHERE organization_id = $1 AND user_id = $2)",
    )
    .bind(organization_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?)
}
