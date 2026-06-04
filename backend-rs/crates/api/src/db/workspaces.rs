//! Workspace repository.

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::workspace::Workspace;
use crate::error::AppResult;
use crate::util::slugify;

pub struct NewWorkspace {
    pub organization_id: Uuid,
    pub name: String,
    pub description: Option<String>,
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> AppResult<Option<Workspace>> {
    Ok(
        sqlx::query_as::<_, Workspace>("SELECT * FROM workspaces WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn list_for_orgs(pool: &PgPool, org_ids: &[Uuid]) -> AppResult<Vec<Workspace>> {
    Ok(sqlx::query_as::<_, Workspace>(
        "SELECT * FROM workspaces WHERE organization_id = ANY($1) ORDER BY created_at DESC",
    )
    .bind(org_ids)
    .fetch_all(pool)
    .await?)
}

pub async fn create(pool: &PgPool, new: NewWorkspace) -> AppResult<Workspace> {
    Ok(sqlx::query_as::<_, Workspace>(
        "INSERT INTO workspaces (id, organization_id, name, description, slug, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, now(), now()) RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(new.organization_id)
    .bind(&new.name)
    .bind(new.description)
    .bind(slugify(&new.name))
    .fetch_one(pool)
    .await?)
}
