//! Room domain model.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "room_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RoomStatus {
    Scheduled,
    Live,
    Ended,
    Cancelled,
}

/// A room row. Contains no secrets, so it is serialised directly to clients.
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Room {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub organization_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub slug: String,
    pub status: RoomStatus,
    pub settings: serde_json::Value,
    pub scheduled_start: Option<DateTime<Utc>>,
    pub scheduled_end: Option<DateTime<Utc>>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_end: Option<DateTime<Utc>>,
    pub thumbnail_url: Option<String>,
    pub recording_enabled: bool,
    pub total_participants: i32,
    pub peak_participants: i32,
    pub total_duration_minutes: i32,
    pub is_public: bool,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
