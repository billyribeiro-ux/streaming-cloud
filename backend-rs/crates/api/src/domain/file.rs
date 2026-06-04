//! Room file domain model.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct RoomFile {
    pub id: Uuid,
    pub room_id: Uuid,
    pub uploaded_by: Uuid,
    pub file_name: String,
    pub r2_key: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
