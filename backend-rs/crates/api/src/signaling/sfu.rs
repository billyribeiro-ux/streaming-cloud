//! Signaling/SFU control-plane HTTP client.
//!
//! Calls are authenticated with the shared signaling secret. Teardown calls
//! (`close_room`, `remove_participant`, `mute_participant`) are best-effort: a
//! signaling outage must not block a user from ending or leaving a room, so
//! failures are logged and swallowed. Allocation surfaces its result so the
//! caller can hand SFU coordinates to the client.

use serde_json::{json, Value};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Allocates SFU resources for a room and returns the signaling response
/// (router/node coordinates), which is forwarded to the client.
pub async fn allocate_room(state: &AppState, room_id: Uuid) -> AppResult<Value> {
    post(state, "/api/rooms/allocate", &json!({ "room_id": room_id })).await
}

/// Best-effort: closes all signaling/SFU resources for a room.
pub async fn close_room(state: &AppState, room_id: Uuid) {
    best_effort(
        state,
        &format!("/api/rooms/{room_id}/close"),
        &json!({}),
        "close_room",
    )
    .await;
}

/// Best-effort: detaches a participant from the SFU.
pub async fn remove_participant(state: &AppState, room_id: Uuid, user_id: Uuid) {
    best_effort(
        state,
        &format!("/api/rooms/{room_id}/participants/{user_id}/remove"),
        &json!({}),
        "remove_participant",
    )
    .await;
}

/// Best-effort: mutes a participant's audio/video at the SFU.
pub async fn mute_participant(state: &AppState, room_id: Uuid, user_id: Uuid, kind: &str) {
    best_effort(
        state,
        &format!("/api/rooms/{room_id}/participants/{user_id}/mute"),
        &json!({ "kind": kind }),
        "mute_participant",
    )
    .await;
}

async fn post(state: &AppState, path: &str, body: &Value) -> AppResult<Value> {
    let url = format!("{}{}", state.config.signaling_url, path);
    let response = state
        .http
        .post(&url)
        .bearer_auth(&state.config.signaling_secret)
        .json(body)
        .send()
        .await
        .map_err(|e| {
            AppError::Internal(anyhow::anyhow!("signaling request to {path} failed: {e}"))
        })?;

    if !response.status().is_success() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "signaling {path} returned {}",
            response.status()
        )));
    }

    response
        .json::<Value>()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("signaling {path} decode failed: {e}")))
}

async fn best_effort(state: &AppState, path: &str, body: &Value, op: &str) {
    if let Err(error) = post(state, path, body).await {
        tracing::warn!(%op, %error, "signaling control-plane call failed (ignored)");
    }
}
