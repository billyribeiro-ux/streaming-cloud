//! Wire-protocol types – must produce the **exact** same JSON as the Node.js
//! signaling server (see `signaling/src/types/signaling.ts`).
//!
//! The over-the-wire format is `{ "event": "<name>", "data": { … } }` which we
//! model with `#[serde(tag = "event", content = "data")]` adjacently-tagged
//! enums.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Client → Server
// ---------------------------------------------------------------------------

/// Every message the client may send over the WebSocket.
#[derive(Debug, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum ClientMessage {
    #[serde(rename = "authenticate")]
    Authenticate(AuthenticateData),

    #[serde(rename = "join-room")]
    JoinRoom(JoinRoomData),

    #[serde(rename = "leave-room")]
    LeaveRoom,

    #[serde(rename = "create-transport")]
    CreateTransport(CreateTransportData),

    #[serde(rename = "connect-transport")]
    ConnectTransport(ConnectTransportData),

    #[serde(rename = "produce")]
    Produce(ProduceData),

    #[serde(rename = "consume")]
    Consume(ConsumeData),

    #[serde(rename = "resume-consumer")]
    ResumeConsumer(ResumeConsumerData),

    #[serde(rename = "pause-producer")]
    PauseProducer(PauseProducerData),

    #[serde(rename = "resume-producer")]
    ResumeProducer(ResumeProducerData),

    #[serde(rename = "close-producer")]
    CloseProducer(CloseProducerData),

    #[serde(rename = "set-preferred-layers")]
    SetPreferredLayers(SetPreferredLayersData),

    #[serde(rename = "set-max-bitrate")]
    SetMaxBitrate(SetMaxBitrateData),

    #[serde(rename = "get-router-rtp-capabilities")]
    GetRouterRtpCapabilities(GetRouterRtpCapabilitiesData),

    #[serde(rename = "restart-ice")]
    RestartIce(RestartIceData),

    #[serde(rename = "produce-data")]
    ProduceData(ProduceDataData),

    #[serde(rename = "consume-data")]
    ConsumeData(ConsumeDataData),
}

// --- payload structs -------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct AuthenticateData {
    pub token: String,
    #[serde(rename = "organizationId")]
    pub organization_id: String,
    #[serde(rename = "deviceInfo")]
    pub device_info: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct JoinRoomData {
    #[serde(rename = "roomId")]
    pub room_id: String,
    pub role: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "rtpCapabilities")]
    pub rtp_capabilities: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransportData {
    pub direction: TransportDirection,
    #[serde(rename = "sctpCapabilities")]
    pub sctp_capabilities: Option<Value>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TransportDirection {
    Send,
    Recv,
}

#[derive(Debug, Deserialize)]
pub struct ConnectTransportData {
    #[serde(rename = "transportId")]
    pub transport_id: String,
    #[serde(rename = "dtlsParameters")]
    pub dtls_parameters: Value,
}

#[derive(Debug, Deserialize)]
pub struct ProduceData {
    #[serde(rename = "transportId")]
    pub transport_id: String,
    pub kind: MediaKind,
    #[serde(rename = "rtpParameters")]
    pub rtp_parameters: Value,
    #[serde(rename = "appData")]
    pub app_data: Option<Value>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Audio,
    Video,
}

#[derive(Debug, Deserialize)]
pub struct ConsumeData {
    #[serde(rename = "producerId")]
    pub producer_id: String,
    #[serde(rename = "rtpCapabilities")]
    pub rtp_capabilities: Value,
}

#[derive(Debug, Deserialize)]
pub struct ResumeConsumerData {
    #[serde(rename = "consumerId")]
    pub consumer_id: String,
}

#[derive(Debug, Deserialize)]
pub struct PauseProducerData {
    #[serde(rename = "producerId")]
    pub producer_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ResumeProducerData {
    #[serde(rename = "producerId")]
    pub producer_id: String,
}

#[derive(Debug, Deserialize)]
pub struct CloseProducerData {
    #[serde(rename = "producerId")]
    pub producer_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SetPreferredLayersData {
    #[serde(rename = "consumerId")]
    pub consumer_id: String,
    #[serde(rename = "spatialLayer")]
    pub spatial_layer: u8,
    #[serde(rename = "temporalLayer")]
    pub temporal_layer: Option<u8>,
}

#[derive(Debug, Deserialize)]
pub struct SetMaxBitrateData {
    #[serde(rename = "transportId")]
    pub transport_id: String,
    pub bitrate: u64,
}

#[derive(Debug, Deserialize)]
pub struct GetRouterRtpCapabilitiesData {
    #[serde(rename = "roomId")]
    pub room_id: String,
}

#[derive(Debug, Deserialize)]
pub struct RestartIceData {
    #[serde(rename = "transportId")]
    pub transport_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ProduceDataData {
    #[serde(rename = "transportId")]
    pub transport_id: String,
    #[serde(rename = "sctpStreamParameters")]
    pub sctp_stream_parameters: Value,
    pub label: String,
    pub protocol: String,
    #[serde(rename = "appData")]
    pub app_data: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct ConsumeDataData {
    #[serde(rename = "dataProducerId")]
    pub data_producer_id: String,
}

// ---------------------------------------------------------------------------
// Server → Client
// ---------------------------------------------------------------------------

/// Every message the server may send over the WebSocket.
///
/// The JSON produced by this enum matches the Node.js `ServerMessage` exactly.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum ServerMessage {
    #[serde(rename = "welcome")]
    Welcome(WelcomeData),

    #[serde(rename = "authenticated")]
    Authenticated(AuthenticatedData),

    #[serde(rename = "room-joined")]
    RoomJoined(RoomJoinedData),

    #[serde(rename = "transport-created")]
    TransportCreated(TransportCreatedData),

    #[serde(rename = "transport-connected")]
    TransportConnected(TransportConnectedData),

    #[serde(rename = "produced")]
    Produced(ProducedData),

    #[serde(rename = "consumer-created")]
    ConsumerCreated(ConsumerCreatedData),

    #[serde(rename = "consumer-resumed")]
    ConsumerResumed(ConsumerResumedData),

    #[serde(rename = "new-producer")]
    NewProducer(NewProducerData),

    #[serde(rename = "participant-joined")]
    ParticipantJoined(ParticipantJoinedData),

    #[serde(rename = "participant-left")]
    ParticipantLeft(ParticipantLeftData),

    #[serde(rename = "producer-paused")]
    ProducerPaused(ProducerPausedData),

    #[serde(rename = "producer-resumed")]
    ProducerResumed(ProducerResumedData),

    #[serde(rename = "producer-closed")]
    ProducerClosed(ProducerClosedData),

    #[serde(rename = "router-rtp-capabilities")]
    RouterRtpCapabilities(RouterRtpCapabilitiesData),

    #[serde(rename = "ice-restarted")]
    IceRestarted(IceRestartedData),

    #[serde(rename = "active-speaker")]
    ActiveSpeaker(ActiveSpeakerData),

    #[serde(rename = "score")]
    Score(ScoreData),

    #[serde(rename = "data-produced")]
    DataProduced(DataProducedData),

    #[serde(rename = "data-consumer-created")]
    DataConsumerCreated(DataConsumerCreatedData),

    #[serde(rename = "new-data-producer")]
    NewDataProducer(NewDataProducerData),

    #[serde(rename = "error")]
    Error(ErrorData),
}

// --- server payload structs ------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct WelcomeData {
    #[serde(rename = "clientId")]
    pub client_id: String,
    #[serde(rename = "serverTime")]
    pub server_time: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuthenticatedData {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "organizationId")]
    pub organization_id: String,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RoomJoinedData {
    #[serde(rename = "roomId")]
    pub room_id: String,
    #[serde(rename = "participantId")]
    pub participant_id: String,
    #[serde(rename = "routerRtpCapabilities")]
    pub router_rtp_capabilities: Value,
    pub participants: Vec<ParticipantInfo>,
    #[serde(rename = "sfuNode")]
    pub sfu_node: String,
    #[serde(rename = "isReconnect")]
    pub is_reconnect: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantInfo {
    pub id: String,
    #[serde(rename = "odUserId")]
    pub od_user_id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub role: String,
    pub producers: Vec<ProducerInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProducerInfo {
    pub id: String,
    pub kind: MediaKind,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransportCreatedData {
    #[serde(rename = "transportId")]
    pub transport_id: String,
    pub direction: TransportDirection,
    #[serde(rename = "iceParameters")]
    pub ice_parameters: Value,
    #[serde(rename = "iceCandidates")]
    pub ice_candidates: Value,
    #[serde(rename = "dtlsParameters")]
    pub dtls_parameters: Value,
    #[serde(rename = "sctpParameters")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sctp_parameters: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransportConnectedData {
    #[serde(rename = "transportId")]
    pub transport_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProducedData {
    #[serde(rename = "producerId")]
    pub producer_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConsumerCreatedData {
    #[serde(rename = "consumerId")]
    pub consumer_id: String,
    #[serde(rename = "producerId")]
    pub producer_id: String,
    pub kind: MediaKind,
    #[serde(rename = "rtpParameters")]
    pub rtp_parameters: Value,
    #[serde(rename = "appData")]
    pub app_data: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConsumerResumedData {
    #[serde(rename = "consumerId")]
    pub consumer_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NewProducerData {
    #[serde(rename = "producerId")]
    pub producer_id: String,
    #[serde(rename = "producerUserId")]
    pub producer_user_id: String,
    #[serde(rename = "participantId")]
    pub participant_id: String,
    pub kind: MediaKind,
    #[serde(rename = "appData")]
    pub app_data: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParticipantJoinedData {
    #[serde(rename = "participantId")]
    pub participant_id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub role: String,
    #[serde(rename = "isReconnect")]
    pub is_reconnect: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParticipantLeftData {
    #[serde(rename = "participantId")]
    pub participant_id: String,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProducerPausedData {
    #[serde(rename = "producerId")]
    pub producer_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProducerResumedData {
    #[serde(rename = "producerId")]
    pub producer_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProducerClosedData {
    #[serde(rename = "producerId")]
    pub producer_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RouterRtpCapabilitiesData {
    #[serde(rename = "rtpCapabilities")]
    pub rtp_capabilities: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct IceRestartedData {
    #[serde(rename = "transportId")]
    pub transport_id: String,
    #[serde(rename = "iceParameters")]
    pub ice_parameters: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActiveSpeakerData {
    #[serde(rename = "participantId")]
    pub participant_id: String,
    pub volume: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScoreData {
    #[serde(rename = "type")]
    pub score_type: String,
    pub id: String,
    pub score: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct DataProducedData {
    #[serde(rename = "dataProducerId")]
    pub data_producer_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DataConsumerCreatedData {
    #[serde(rename = "dataConsumerId")]
    pub data_consumer_id: String,
    #[serde(rename = "dataProducerId")]
    pub data_producer_id: String,
    #[serde(rename = "sctpStreamParameters")]
    pub sctp_stream_parameters: Value,
    pub label: String,
    pub protocol: String,
    #[serde(rename = "appData")]
    pub app_data: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct NewDataProducerData {
    #[serde(rename = "dataProducerId")]
    pub data_producer_id: String,
    #[serde(rename = "participantId")]
    pub participant_id: String,
    pub label: String,
    pub protocol: String,
    #[serde(rename = "appData")]
    pub app_data: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct ErrorData {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(rename = "mediaType")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_type: Option<String>,
}
