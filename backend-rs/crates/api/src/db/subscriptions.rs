//! Subscription repository.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::subscription::Subscription;
use crate::error::AppResult;

pub async fn find_for_org(pool: &PgPool, org_id: Uuid) -> AppResult<Option<Subscription>> {
    Ok(sqlx::query_as::<_, Subscription>(
        "SELECT * FROM subscriptions WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(org_id)
    .fetch_optional(pool)
    .await?)
}

/// Fields synced from a Stripe subscription/checkout event.
pub struct UpsertSubscription {
    pub organization_id: Uuid,
    pub plan_id: Option<Uuid>,
    pub stripe_subscription_id: String,
    pub status: String,
    pub current_period_start: Option<DateTime<Utc>>,
    pub current_period_end: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
}

/// Inserts or updates a subscription keyed by its Stripe subscription id.
pub async fn upsert(pool: &PgPool, s: UpsertSubscription) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO subscriptions \
         (organization_id, plan_id, stripe_subscription_id, status, \
          current_period_start, current_period_end, cancelled_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         ON CONFLICT (stripe_subscription_id) DO UPDATE SET \
            status = EXCLUDED.status, \
            plan_id = COALESCE(EXCLUDED.plan_id, subscriptions.plan_id), \
            current_period_start = EXCLUDED.current_period_start, \
            current_period_end = EXCLUDED.current_period_end, \
            cancelled_at = EXCLUDED.cancelled_at, \
            updated_at = now()",
    )
    .bind(s.organization_id)
    .bind(s.plan_id)
    .bind(&s.stripe_subscription_id)
    .bind(&s.status)
    .bind(s.current_period_start)
    .bind(s.current_period_end)
    .bind(s.cancelled_at)
    .execute(pool)
    .await?;
    Ok(())
}
