//! Shared authorization guards for room-scoped resources.

use uuid::Uuid;

use crate::db;
use crate::domain::room::Room;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Ensures the user belongs to `org_id`, otherwise `403 Forbidden`.
pub(crate) async fn ensure_member(state: &AppState, org_id: Uuid, user_id: Uuid) -> AppResult<()> {
    if db::organizations::is_member(&state.db, org_id, user_id).await? {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

/// Loads a room and authorizes the user against its organization, returning the
/// room on success (`404` if missing, `403` if the user is not a member).
pub(crate) async fn room_authorized(
    state: &AppState,
    room_id: Uuid,
    user_id: Uuid,
) -> AppResult<Room> {
    let room = db::rooms::find_by_id(&state.db, room_id)
        .await?
        .ok_or(AppError::NotFound)?;
    ensure_member(state, room.organization_id, user_id).await?;
    Ok(room)
}
