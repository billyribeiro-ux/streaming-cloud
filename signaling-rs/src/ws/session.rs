//! Per-connection client state and the global client registry.
//!
//! Mirrors `ConnectedClient` from `signaling/src/services/SignalingServer.ts`.

use std::collections::HashSet;
use std::sync::Arc;

use dashmap::DashMap;
use tokio::sync::mpsc;

use crate::services::auth::AuthenticatedUser;
use crate::ws::protocol::ServerMessage;

/// Sender half kept per client. The WebSocket write loop reads from the
/// receiver. We use an mpsc channel so that any task can send to a client
/// without holding a lock on the WebSocket itself.
pub type ClientSender = mpsc::UnboundedSender<ServerMessage>;

/// State attached to a single WebSocket connection.
#[derive(Debug)]
pub struct ConnectedClient {
    pub id: String,
    pub sender: ClientSender,
    pub user: Option<AuthenticatedUser>,
    pub room_id: Option<String>,
    pub participant_id: Option<String>,
    pub transport_ids: HashSet<String>,
    pub producer_ids: HashSet<String>,
    pub consumer_ids: HashSet<String>,
    pub ip: String,
}

/// Thread-safe registry of all live WebSocket clients, keyed by client ID.
#[derive(Debug, Clone, Default)]
pub struct ClientRegistry {
    inner: Arc<DashMap<String, ConnectedClient>>,
}

impl ClientRegistry {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(DashMap::new()),
        }
    }

    pub fn insert(&self, client: ConnectedClient) {
        self.inner.insert(client.id.clone(), client);
    }

    pub fn remove(&self, client_id: &str) -> Option<ConnectedClient> {
        self.inner.remove(client_id).map(|(_, c)| c)
    }

    /// Send a message to a specific client.
    pub fn send_to(&self, client_id: &str, msg: ServerMessage) {
        if let Some(client) = self.inner.get(client_id) {
            let _ = client.sender.send(msg);
        }
    }

    /// Broadcast a message to every client in `room_id`, **except**
    /// `exclude_client_id`.
    pub fn broadcast_to_room(
        &self,
        room_id: &str,
        exclude_client_id: &str,
        msg: ServerMessage,
    ) {
        for entry in self.inner.iter() {
            let client = entry.value();
            if client.room_id.as_deref() == Some(room_id) && client.id != exclude_client_id {
                let _ = client.sender.send(msg.clone());
            }
        }
    }

    /// Send to every client in a room (no exclusion). Used for active-speaker
    /// and score forwarding.
    pub fn broadcast_to_room_all(&self, room_id: &str, msg: ServerMessage) {
        for entry in self.inner.iter() {
            let client = entry.value();
            if client.room_id.as_deref() == Some(room_id) {
                let _ = client.sender.send(msg.clone());
            }
        }
    }

    /// Send to a specific participant within a room.
    pub fn send_to_participant(
        &self,
        room_id: &str,
        participant_id: &str,
        msg: ServerMessage,
    ) {
        for entry in self.inner.iter() {
            let client = entry.value();
            if client.room_id.as_deref() == Some(room_id)
                && client.participant_id.as_deref() == Some(participant_id)
            {
                let _ = client.sender.send(msg);
                return;
            }
        }
    }

    /// Disconnect all clients in a room (used by control API room close).
    pub fn disconnect_clients_in_room(&self, room_id: &str) {
        for entry in self.inner.iter() {
            if entry.value().room_id.as_deref() == Some(room_id) {
                // Dropping the sender causes the write loop to detect a
                // closed channel and terminate the WebSocket.
                // We cannot drop through DashMap iter – instead we close the
                // channel which has the same effect.
                entry.value().sender.closed();
            }
        }
        // Collect IDs to remove to avoid borrow issues
        let ids: Vec<String> = self
            .inner
            .iter()
            .filter(|e| e.value().room_id.as_deref() == Some(room_id))
            .map(|e| e.key().clone())
            .collect();
        for id in ids {
            self.inner.remove(&id);
        }
    }

    /// Disconnect a specific user in a room (moderation).
    pub fn disconnect_user_in_room(&self, room_id: &str, user_id: &str) {
        let ids: Vec<String> = self
            .inner
            .iter()
            .filter(|e| {
                let c = e.value();
                c.room_id.as_deref() == Some(room_id)
                    && c.user.as_ref().map(|u| u.id.as_str()) == Some(user_id)
            })
            .map(|e| e.key().clone())
            .collect();
        for id in ids {
            self.inner.remove(&id);
        }
    }

    /// Broadcast a moderator mute request to a user in a room.
    pub fn broadcast_mute_request(
        &self,
        room_id: &str,
        user_id: &str,
        media_type: &str,
    ) {
        let msg = ServerMessage::Error(crate::ws::protocol::ErrorData {
            message: format!("Moderator requested {media_type} mute"),
            code: Some("MODERATOR_MUTE".to_string()),
            media_type: Some(media_type.to_string()),
        });
        for entry in self.inner.iter() {
            let c = entry.value();
            if c.room_id.as_deref() == Some(room_id)
                && c.user.as_ref().map(|u| u.id.as_str()) == Some(user_id)
            {
                let _ = c.sender.send(msg.clone());
            }
        }
    }

    /// Mutably access a client by ID.  The caller receives a `RefMut` guard
    /// which must be dropped promptly to avoid blocking other tasks.
    pub fn get_mut(
        &self,
        client_id: &str,
    ) -> Option<dashmap::mapref::one::RefMut<'_, String, ConnectedClient>> {
        self.inner.get_mut(client_id)
    }

    pub fn get(
        &self,
        client_id: &str,
    ) -> Option<dashmap::mapref::one::Ref<'_, String, ConnectedClient>> {
        self.inner.get(client_id)
    }

    /// Clear stale participant state from other clients with the same
    /// participant ID (reconnection cleanup).
    pub fn clear_stale_participant(
        &self,
        participant_id: &str,
        keep_client_id: &str,
    ) {
        for mut entry in self.inner.iter_mut() {
            let c = entry.value_mut();
            if c.participant_id.as_deref() == Some(participant_id) && c.id != keep_client_id {
                c.room_id = None;
                c.participant_id = None;
                c.transport_ids.clear();
                c.producer_ids.clear();
                c.consumer_ids.clear();
            }
        }
    }
}
