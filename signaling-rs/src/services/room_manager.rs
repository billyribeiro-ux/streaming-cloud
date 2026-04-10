//! Room state management – mirrors `signaling/src/services/RoomManager.ts`.
//!
//! In-memory room state with `RwLock<HashMap>` (single-process) that proxies
//! media operations to the Mediasoup SFU via [`super::sfu_proxy::SfuProxy`].

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use serde_json::Value;
use tracing::{error, info};

use super::sfu_proxy::SfuProxy;
use crate::services::auth::AuthenticatedUser;
use crate::ws::protocol::{MediaKind, ParticipantInfo, ProducerInfo};

// ---------------------------------------------------------------------------
// Internal state types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ProducerState {
    pub id: String,
    pub kind: MediaKind,
    pub source: String,
    pub paused: bool,
}

#[derive(Debug, Clone)]
pub struct ConsumerState {
    pub id: String,
    pub producer_id: String,
    pub kind: MediaKind,
    pub paused: bool,
}

#[derive(Debug, Clone)]
pub struct RoomParticipant {
    pub id: String,
    pub od_user_id: String,
    pub display_name: String,
    pub role: String,
    pub rtp_capabilities: Option<Value>,
    pub send_transport_id: Option<String>,
    pub recv_transport_id: Option<String>,
    pub producers: HashMap<String, ProducerState>,
    pub consumers: HashMap<String, ConsumerState>,
}

#[derive(Debug, Clone)]
pub struct RoomState {
    pub id: String,
    pub sfu_node: String,
    pub sfu_http_origin: String,
    pub router_id: String,
    pub router_rtp_capabilities: Value,
    pub participants: HashMap<String, RoomParticipant>,
}

/// Return value from [`RoomManager::join_room`].
pub struct JoinRoomResult {
    pub participant_id: String,
    pub router_rtp_capabilities: Value,
    pub sfu_node: String,
    pub is_reconnect: bool,
}

/// Consumer creation result forwarded from the SFU.
pub struct ConsumerCreated {
    pub id: String,
    pub producer_id: String,
    pub kind: String,
    pub rtp_parameters: Value,
    pub app_data: Value,
}

/// Data-producer creation result.
pub struct DataProducerCreated {
    pub id: String,
}

/// Data-consumer creation result.
pub struct DataConsumerCreated {
    pub id: String,
    pub data_producer_id: String,
    pub sctp_stream_parameters: Value,
    pub label: String,
    pub protocol: String,
    pub app_data: Value,
}

// ---------------------------------------------------------------------------
// RoomManager
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct RoomManager {
    rooms: Arc<RwLock<HashMap<String, RoomState>>>,
    sfu_proxy: SfuProxy,
    /// First SFU node origin used for room allocation in Phase 1 (round-robin
    /// is left for a later phase).
    sfu_nodes: Vec<String>,
}

impl RoomManager {
    pub fn new(sfu_proxy: SfuProxy, sfu_nodes: Vec<String>) -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
            sfu_proxy,
            sfu_nodes,
        }
    }

    /// Pick an SFU origin for room allocation. Phase 1: first configured node.
    fn pick_sfu_origin(&self) -> Result<String, String> {
        self.sfu_nodes
            .first()
            .cloned()
            .ok_or_else(|| "No SFU nodes configured".to_string())
    }

    // -----------------------------------------------------------------------
    // Room lifecycle
    // -----------------------------------------------------------------------

    pub async fn join_room(
        &self,
        room_id: &str,
        user: &AuthenticatedUser,
        role: &str,
        display_name: &str,
    ) -> Result<JoinRoomResult, String> {
        // Check for reconnecting participant
        let is_reconnect;
        {
            let mut rooms = self.rooms.write().await;
            let room = rooms.get_mut(room_id);

            // Detect reconnection – same userId already in the room
            if let Some(room) = room {
                let existing = room
                    .participants
                    .values()
                    .find(|p| p.od_user_id == user.id)
                    .map(|p| p.id.clone());

                if let Some(old_pid) = existing {
                    info!(
                        room_id,
                        user_id = %user.id,
                        old_participant_id = %old_pid,
                        "Reconnecting participant detected - cleaning up old entry"
                    );
                    room.participants.remove(&old_pid);
                    is_reconnect = true;
                } else {
                    is_reconnect = false;
                }

                // Room already exists – add participant
                let participant_id = format!("p-{}-{}", user.id, chrono::Utc::now().timestamp_millis());
                let participant = RoomParticipant {
                    id: participant_id.clone(),
                    od_user_id: user.id.clone(),
                    display_name: display_name.to_string(),
                    role: role.to_string(),
                    rtp_capabilities: None,
                    send_transport_id: None,
                    recv_transport_id: None,
                    producers: HashMap::new(),
                    consumers: HashMap::new(),
                };
                let rtp = room.router_rtp_capabilities.clone();
                let sfu = room.sfu_node.clone();
                room.participants.insert(participant_id.clone(), participant);

                return Ok(JoinRoomResult {
                    participant_id,
                    router_rtp_capabilities: rtp,
                    sfu_node: sfu,
                    is_reconnect,
                });
            }
        }

        // Room does not exist – allocate on SFU
        is_reconnect = false;
        let sfu_origin = self.pick_sfu_origin()?;
        let alloc = self
            .sfu_proxy
            .allocate_room(&sfu_origin, room_id)
            .await?;

        let participant_id = format!("p-{}-{}", user.id, chrono::Utc::now().timestamp_millis());
        let participant = RoomParticipant {
            id: participant_id.clone(),
            od_user_id: user.id.clone(),
            display_name: display_name.to_string(),
            role: role.to_string(),
            rtp_capabilities: None,
            send_transport_id: None,
            recv_transport_id: None,
            producers: HashMap::new(),
            consumers: HashMap::new(),
        };

        let room = RoomState {
            id: room_id.to_string(),
            sfu_node: alloc.node.clone(),
            sfu_http_origin: alloc.http_origin.clone(),
            router_id: alloc.router_id.clone(),
            router_rtp_capabilities: alloc.rtp_capabilities.clone(),
            participants: {
                let mut m = HashMap::new();
                m.insert(participant_id.clone(), participant);
                m
            },
        };

        let rtp = room.router_rtp_capabilities.clone();
        let sfu_node = room.sfu_node.clone();

        self.rooms.write().await.insert(room_id.to_string(), room);

        info!(room_id, participant_id = %participant_id, user_id = %user.id, role, "Participant joined room");

        Ok(JoinRoomResult {
            participant_id,
            router_rtp_capabilities: rtp,
            sfu_node,
            is_reconnect,
        })
    }

    pub async fn leave_room(&self, room_id: &str, participant_id: &str) {
        let mut rooms = self.rooms.write().await;
        let should_destroy = if let Some(room) = rooms.get_mut(room_id) {
            room.participants.remove(participant_id);
            room.participants.is_empty()
        } else {
            false
        };

        if should_destroy {
            if let Some(room) = rooms.remove(room_id) {
                info!(room_id, "Room closed - no participants");
                // Fire-and-forget SFU release
                let proxy = self.sfu_proxy.clone();
                let origin = room.sfu_http_origin.clone();
                let rid = room.router_id.clone();
                tokio::spawn(async move {
                    if let Err(e) = proxy.release_room(&origin, &rid).await {
                        error!(%e, "Failed to release SFU room");
                    }
                });
            }
        }
    }

    pub async fn set_participant_rtp_capabilities(
        &self,
        room_id: &str,
        participant_id: &str,
        rtp_capabilities: Value,
    ) {
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.get_mut(room_id) {
            if let Some(p) = room.participants.get_mut(participant_id) {
                p.rtp_capabilities = Some(rtp_capabilities);
            }
        }
    }

    pub async fn get_participants(&self, room_id: &str) -> Vec<ParticipantInfo> {
        let rooms = self.rooms.read().await;
        let Some(room) = rooms.get(room_id) else {
            return Vec::new();
        };

        room.participants
            .values()
            .map(|p| ParticipantInfo {
                id: p.id.clone(),
                od_user_id: p.od_user_id.clone(),
                display_name: p.display_name.clone(),
                role: p.role.clone(),
                producers: p
                    .producers
                    .values()
                    .map(|pr| ProducerInfo {
                        id: pr.id.clone(),
                        kind: pr.kind,
                        source: pr.source.clone(),
                    })
                    .collect(),
            })
            .collect()
    }

    pub async fn find_participant_by_user_id(
        &self,
        room_id: &str,
        user_id: &str,
    ) -> Option<String> {
        let rooms = self.rooms.read().await;
        rooms.get(room_id).and_then(|room| {
            room.participants
                .values()
                .find(|p| p.od_user_id == user_id)
                .map(|p| p.id.clone())
        })
    }

    pub async fn remove_participant_entry(&self, room_id: &str, participant_id: &str) {
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.get_mut(room_id) {
            room.participants.remove(participant_id);
        }
    }

    // -----------------------------------------------------------------------
    // Transport operations
    // -----------------------------------------------------------------------

    pub async fn create_transport(
        &self,
        room_id: &str,
        participant_id: &str,
        direction: &str,
        sctp_capabilities: Option<Value>,
    ) -> Result<super::sfu_proxy::SfuTransportCreated, String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;

        let t = self
            .sfu_proxy
            .create_transport(&origin, &router_id, direction, sctp_capabilities)
            .await?;

        // Record transport on participant
        {
            let mut rooms = self.rooms.write().await;
            if let Some(room) = rooms.get_mut(room_id) {
                if let Some(p) = room.participants.get_mut(participant_id) {
                    match direction {
                        "send" => p.send_transport_id = Some(t.id.clone()),
                        "recv" => p.recv_transport_id = Some(t.id.clone()),
                        _ => {}
                    }
                }
            }
        }

        Ok(t)
    }

    pub async fn connect_transport(
        &self,
        room_id: &str,
        transport_id: &str,
        dtls_parameters: Value,
    ) -> Result<(), String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;
        self.sfu_proxy
            .connect_transport(&origin, &router_id, transport_id, dtls_parameters)
            .await
    }

    // -----------------------------------------------------------------------
    // Producer operations
    // -----------------------------------------------------------------------

    pub async fn produce(
        &self,
        room_id: &str,
        participant_id: &str,
        transport_id: &str,
        kind: MediaKind,
        rtp_parameters: Value,
        app_data: Value,
    ) -> Result<String, String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;

        let kind_str = match kind {
            MediaKind::Audio => "audio",
            MediaKind::Video => "video",
        };

        let merged_app_data = if let Value::Object(mut map) = app_data {
            map.insert(
                "participantId".to_string(),
                Value::String(participant_id.to_string()),
            );
            Value::Object(map)
        } else {
            serde_json::json!({ "participantId": participant_id })
        };

        let p = self
            .sfu_proxy
            .produce(
                &origin,
                &router_id,
                transport_id,
                kind_str,
                rtp_parameters,
                merged_app_data.clone(),
            )
            .await?;

        // Track producer on participant
        let source = merged_app_data
            .get("source")
            .and_then(|v| v.as_str())
            .unwrap_or(kind_str)
            .to_string();

        {
            let mut rooms = self.rooms.write().await;
            if let Some(room) = rooms.get_mut(room_id) {
                if let Some(participant) = room.participants.get_mut(participant_id) {
                    participant.producers.insert(
                        p.id.clone(),
                        ProducerState {
                            id: p.id.clone(),
                            kind,
                            source,
                            paused: false,
                        },
                    );
                }
            }
        }

        Ok(p.id)
    }

    pub async fn consume(
        &self,
        room_id: &str,
        participant_id: &str,
        producer_id: &str,
        rtp_capabilities: Value,
    ) -> Result<Option<ConsumerCreated>, String> {
        let (origin, router_id, recv_transport_id) = {
            let rooms = self.rooms.read().await;
            let room = rooms
                .get(room_id)
                .ok_or_else(|| format!("Room not found: {room_id}"))?;
            let participant = room
                .participants
                .get(participant_id)
                .ok_or("Participant not found")?;
            let recv = participant
                .recv_transport_id
                .clone()
                .ok_or("Receive transport not created")?;
            (room.sfu_http_origin.clone(), room.router_id.clone(), recv)
        };

        let c = self
            .sfu_proxy
            .consume(
                &origin,
                &router_id,
                &recv_transport_id,
                producer_id,
                rtp_capabilities,
            )
            .await?;

        let Some(c) = c else {
            return Ok(None);
        };

        // Track consumer on participant
        let kind = match c.kind.as_str() {
            "audio" => MediaKind::Audio,
            _ => MediaKind::Video,
        };
        {
            let mut rooms = self.rooms.write().await;
            if let Some(room) = rooms.get_mut(room_id) {
                if let Some(participant) = room.participants.get_mut(participant_id) {
                    participant.consumers.insert(
                        c.id.clone(),
                        ConsumerState {
                            id: c.id.clone(),
                            producer_id: producer_id.to_string(),
                            kind,
                            paused: true,
                        },
                    );
                }
            }
        }

        Ok(Some(ConsumerCreated {
            id: c.id,
            producer_id: c.producer_id,
            kind: c.kind,
            rtp_parameters: c.rtp_parameters,
            app_data: c.app_data,
        }))
    }

    pub async fn resume_consumer(
        &self,
        room_id: &str,
        consumer_id: &str,
    ) -> Result<(), String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;
        self.sfu_proxy
            .resume_consumer(&origin, &router_id, consumer_id)
            .await
    }

    pub async fn pause_producer(
        &self,
        room_id: &str,
        producer_id: &str,
    ) -> Result<(), String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;
        self.sfu_proxy
            .pause_producer(&origin, &router_id, producer_id)
            .await
    }

    pub async fn resume_producer(
        &self,
        room_id: &str,
        producer_id: &str,
    ) -> Result<(), String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;
        self.sfu_proxy
            .resume_producer(&origin, &router_id, producer_id)
            .await
    }

    pub async fn close_producer(
        &self,
        room_id: &str,
        producer_id: &str,
    ) -> Result<(), String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;
        self.sfu_proxy
            .close_producer(&origin, &router_id, producer_id)
            .await?;

        // Remove producer from all participants in the room
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.get_mut(room_id) {
            for p in room.participants.values_mut() {
                p.producers.remove(producer_id);
            }
        }

        Ok(())
    }

    pub async fn set_preferred_layers(
        &self,
        room_id: &str,
        consumer_id: &str,
        spatial_layer: u8,
        temporal_layer: Option<u8>,
    ) -> Result<(), String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;
        self.sfu_proxy
            .set_preferred_layers(&origin, &router_id, consumer_id, spatial_layer, temporal_layer)
            .await
    }

    pub async fn set_max_incoming_bitrate(
        &self,
        room_id: &str,
        transport_id: &str,
        bitrate: u64,
    ) -> Result<(), String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;
        self.sfu_proxy
            .set_max_incoming_bitrate(&origin, &router_id, transport_id, bitrate)
            .await
    }

    pub async fn restart_ice(
        &self,
        room_id: &str,
        transport_id: &str,
    ) -> Result<Value, String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;
        let result = self
            .sfu_proxy
            .restart_ice(&origin, &router_id, transport_id)
            .await?;
        Ok(result.ice_parameters)
    }

    pub async fn get_router_rtp_capabilities(&self, room_id: &str) -> Value {
        let rooms = self.rooms.read().await;
        rooms
            .get(room_id)
            .map(|r| r.router_rtp_capabilities.clone())
            .unwrap_or(Value::Object(serde_json::Map::new()))
    }

    // -----------------------------------------------------------------------
    // DataChannel (SCTP) operations
    // -----------------------------------------------------------------------

    pub async fn produce_data(
        &self,
        room_id: &str,
        participant_id: &str,
        transport_id: &str,
        sctp_stream_parameters: Value,
        label: &str,
        protocol: &str,
        app_data: Value,
    ) -> Result<DataProducerCreated, String> {
        let (origin, router_id) = self.room_sfu_info(room_id).await?;

        let merged_app_data = if let Value::Object(mut map) = app_data {
            map.insert(
                "participantId".to_string(),
                Value::String(participant_id.to_string()),
            );
            Value::Object(map)
        } else {
            serde_json::json!({ "participantId": participant_id })
        };

        let dp = self
            .sfu_proxy
            .produce_data(
                &origin,
                &router_id,
                transport_id,
                sctp_stream_parameters,
                label,
                protocol,
                merged_app_data,
            )
            .await?;

        Ok(DataProducerCreated { id: dp.id })
    }

    pub async fn consume_data(
        &self,
        room_id: &str,
        participant_id: &str,
        data_producer_id: &str,
    ) -> Result<Option<DataConsumerCreated>, String> {
        let (origin, router_id, recv_transport_id) = {
            let rooms = self.rooms.read().await;
            let room = rooms
                .get(room_id)
                .ok_or_else(|| format!("Room not found: {room_id}"))?;
            let participant = room
                .participants
                .get(participant_id)
                .ok_or("Participant not found")?;
            let recv = participant
                .recv_transport_id
                .clone()
                .ok_or("Receive transport not created")?;
            (room.sfu_http_origin.clone(), room.router_id.clone(), recv)
        };

        let dc = self
            .sfu_proxy
            .consume_data(&origin, &router_id, &recv_transport_id, data_producer_id)
            .await?;

        let Some(dc) = dc else {
            return Ok(None);
        };

        Ok(Some(DataConsumerCreated {
            id: dc.id,
            data_producer_id: dc.data_producer_id,
            sctp_stream_parameters: dc.sctp_stream_parameters,
            label: dc.label,
            protocol: dc.protocol,
            app_data: dc.app_data,
        }))
    }

    // -----------------------------------------------------------------------
    // Room destruction (control plane)
    // -----------------------------------------------------------------------

    pub async fn destroy_room(&self, room_id: &str) {
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.remove(room_id) {
            let proxy = self.sfu_proxy.clone();
            let origin = room.sfu_http_origin;
            let rid = room.router_id;
            tokio::spawn(async move {
                if let Err(e) = proxy.release_room(&origin, &rid).await {
                    error!(%e, "Failed to release SFU room on destroy");
                }
            });
        }
    }

    pub async fn shutdown(&self) {
        let rooms = self.rooms.write().await;
        for room in rooms.values() {
            let proxy = self.sfu_proxy.clone();
            let origin = room.sfu_http_origin.clone();
            let rid = room.router_id.clone();
            tokio::spawn(async move {
                if let Err(e) = proxy.release_room(&origin, &rid).await {
                    error!(%e, "Failed to release SFU room on shutdown");
                }
            });
        }
        info!("Room manager shut down");
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    async fn room_sfu_info(&self, room_id: &str) -> Result<(String, String), String> {
        let rooms = self.rooms.read().await;
        let room = rooms
            .get(room_id)
            .ok_or_else(|| format!("Room not found: {room_id}"))?;
        Ok((room.sfu_http_origin.clone(), room.router_id.clone()))
    }
}
