//! Plan domain model.

use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Plan {
    pub id: Uuid,
    pub name: String,
    pub display_name: String,
    pub price_monthly_cents: i32,
    pub price_yearly_cents: i32,
    pub stripe_price_id_monthly: Option<String>,
    pub stripe_price_id_yearly: Option<String>,
    pub max_workspaces: i32,
    pub max_rooms: i32,
    pub max_hosts_per_room: i32,
    pub max_viewers_per_room: i32,
    pub max_storage_gb: i32,
    pub features: serde_json::Value,
    pub is_active: bool,
}
