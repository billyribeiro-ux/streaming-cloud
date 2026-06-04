//! Room participant domain model.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct RoomParticipant {
    pub id: Uuid,
    pub room_id: Uuid,
    pub session_id: Option<Uuid>,
    pub user_id: Uuid,
    pub role: String,
    pub display_name: Option<String>,
    pub connection_state: String,
    pub joined_at: DateTime<Utc>,
    pub left_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
}
