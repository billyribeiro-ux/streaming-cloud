//! HTTP client to the Mediasoup SFU control plane.
//!
//! Mirrors `signaling/src/utils/sfuHttp.ts` – every call uses Bearer auth with
//! the `SIGNALING_SERVER_SECRET` / `SFU_SECRET` token and targets the SFU node
//! HTTP origin stored per-room.

use reqwest::Client;
use serde::de::DeserializeOwned;
use serde_json::Value;
use tracing::error;

/// Reusable HTTP client for SFU requests.
#[derive(Debug, Clone)]
pub struct SfuProxy {
    client: Client,
    control_secret: String,
}

/// Transport creation response from the SFU.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SfuTransportCreated {
    pub id: String,
    #[serde(rename = "iceParameters")]
    pub ice_parameters: Value,
    #[serde(rename = "iceCandidates")]
    pub ice_candidates: Value,
    #[serde(rename = "dtlsParameters")]
    pub dtls_parameters: Value,
    #[serde(rename = "sctpParameters")]
    pub sctp_parameters: Option<Value>,
}

/// Consumer creation response from the SFU.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SfuConsumerCreated {
    pub id: String,
    #[serde(rename = "producerId")]
    pub producer_id: String,
    pub kind: String,
    #[serde(rename = "rtpParameters")]
    pub rtp_parameters: Value,
    #[serde(rename = "appData")]
    pub app_data: Value,
}

/// Data-producer creation response from the SFU.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SfuDataProducerCreated {
    pub id: String,
    #[serde(rename = "sctpStreamParameters")]
    pub sctp_stream_parameters: Value,
    pub label: String,
    pub protocol: String,
    #[serde(rename = "appData")]
    pub app_data: Value,
}

/// Data-consumer creation response from the SFU.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SfuDataConsumerCreated {
    pub id: String,
    #[serde(rename = "dataProducerId")]
    pub data_producer_id: String,
    #[serde(rename = "sctpStreamParameters")]
    pub sctp_stream_parameters: Value,
    pub label: String,
    pub protocol: String,
    #[serde(rename = "appData")]
    pub app_data: Value,
}

/// ICE restart response.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SfuIceRestarted {
    #[serde(rename = "iceParameters")]
    pub ice_parameters: Value,
}

/// Router allocation response from SFU manager.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SfuRoomAllocation {
    pub node: String,
    #[serde(rename = "routerId")]
    pub router_id: String,
    #[serde(rename = "httpOrigin")]
    pub http_origin: String,
    #[serde(rename = "rtpCapabilities")]
    pub rtp_capabilities: Value,
    #[serde(rename = "iceServers")]
    pub ice_servers: Option<Value>,
}

/// Producer creation response (just an id).
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SfuProducerCreated {
    pub id: String,
}

impl SfuProxy {
    pub fn new(control_secret: String) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("failed to build reqwest client");

        Self {
            client,
            control_secret,
        }
    }

    /// Generic SFU fetch mirroring `sfuFetch<T>()` in the Node.js codebase.
    async fn sfu_fetch<T: DeserializeOwned>(
        &self,
        sfu_origin: &str,
        path: &str,
        method: reqwest::Method,
        body: Option<Value>,
    ) -> Result<T, String> {
        let origin = sfu_origin.trim_end_matches('/');
        let path = if path.starts_with('/') {
            path.to_string()
        } else {
            format!("/{path}")
        };
        let url = format!("{origin}{path}");

        let mut req = self
            .client
            .request(method.clone(), &url)
            .header("Authorization", format!("Bearer {}", self.control_secret))
            .header("Accept", "application/json")
            .header("Content-Type", "application/json");

        if let Some(b) = body {
            req = req.json(&b);
        }

        let res = req.send().await.map_err(|e| {
            error!(%e, %url, "SFU request failed");
            format!("SFU {method} {path} failed: {e}")
        })?;

        let status = res.status();
        let text = res.text().await.unwrap_or_default();

        if !status.is_success() {
            error!(%status, %text, %url, "SFU request returned error");
            return Err(format!("SFU {method} {path} failed: {status} {text}"));
        }

        if text.is_empty() {
            // Some SFU endpoints return empty 200 for void operations.
            // Try to deserialise an empty object – will fail for most T but
            // works for () or Option<_>.
            return serde_json::from_str("null")
                .map_err(|e| format!("SFU {method} {path}: empty body: {e}"));
        }

        serde_json::from_str(&text)
            .map_err(|e| format!("SFU {method} {path}: parse error: {e}"))
    }

    // -----------------------------------------------------------------------
    // High-level helpers matching RoomManager SFU calls
    // -----------------------------------------------------------------------

    pub async fn create_transport(
        &self,
        sfu_origin: &str,
        router_id: &str,
        direction: &str,
        sctp_capabilities: Option<Value>,
    ) -> Result<SfuTransportCreated, String> {
        let path = format!(
            "/api/routers/{}/transports",
            urlencoding::encode(router_id)
        );
        let body = serde_json::json!({
            "direction": direction,
            "sctpCapabilities": sctp_capabilities,
        });
        self.sfu_fetch(sfu_origin, &path, reqwest::Method::POST, Some(body))
            .await
    }

    pub async fn connect_transport(
        &self,
        sfu_origin: &str,
        router_id: &str,
        transport_id: &str,
        dtls_parameters: Value,
    ) -> Result<(), String> {
        let path = format!(
            "/api/routers/{}/transports/{}/connect",
            urlencoding::encode(router_id),
            urlencoding::encode(transport_id),
        );
        let body = serde_json::json!({ "dtlsParameters": dtls_parameters });
        let _: Value = self
            .sfu_fetch(sfu_origin, &path, reqwest::Method::POST, Some(body))
            .await
            .or_else(|e| {
                // Accept null/empty success
                if e.contains("empty body") || e.contains("parse error") {
                    Ok(Value::Null)
                } else {
                    Err(e)
                }
            })?;
        Ok(())
    }

    pub async fn produce(
        &self,
        sfu_origin: &str,
        router_id: &str,
        transport_id: &str,
        kind: &str,
        rtp_parameters: Value,
        app_data: Value,
    ) -> Result<SfuProducerCreated, String> {
        let path = format!(
            "/api/routers/{}/producers",
            urlencoding::encode(router_id)
        );
        let body = serde_json::json!({
            "transportId": transport_id,
            "kind": kind,
            "rtpParameters": rtp_parameters,
            "appData": app_data,
        });
        self.sfu_fetch(sfu_origin, &path, reqwest::Method::POST, Some(body))
            .await
    }

    pub async fn consume(
        &self,
        sfu_origin: &str,
        router_id: &str,
        transport_id: &str,
        producer_id: &str,
        rtp_capabilities: Value,
    ) -> Result<Option<SfuConsumerCreated>, String> {
        let path = format!(
            "/api/routers/{}/consumers",
            urlencoding::encode(router_id)
        );
        let body = serde_json::json!({
            "transportId": transport_id,
            "producerId": producer_id,
            "rtpCapabilities": rtp_capabilities,
        });
        self.sfu_fetch(sfu_origin, &path, reqwest::Method::POST, Some(body))
            .await
    }

    pub async fn resume_consumer(
        &self,
        sfu_origin: &str,
        router_id: &str,
        consumer_id: &str,
    ) -> Result<(), String> {
        let path = format!(
            "/api/routers/{}/consumers/{}/resume",
            urlencoding::encode(router_id),
            urlencoding::encode(consumer_id),
        );
        let _: Value = self
            .sfu_fetch(sfu_origin, &path, reqwest::Method::POST, None)
            .await
            .or_else(|e| {
                if e.contains("empty body") || e.contains("parse error") {
                    Ok(Value::Null)
                } else {
                    Err(e)
                }
            })?;
        Ok(())
    }

    pub async fn pause_producer(
        &self,
        sfu_origin: &str,
        router_id: &str,
        producer_id: &str,
    ) -> Result<(), String> {
        let path = format!(
            "/api/routers/{}/producers/{}/pause",
            urlencoding::encode(router_id),
            urlencoding::encode(producer_id),
        );
        let _: Value = self
            .sfu_fetch(sfu_origin, &path, reqwest::Method::POST, None)
            .await
            .or_else(|e| {
                if e.contains("empty body") || e.contains("parse error") {
                    Ok(Value::Null)
                } else {
                    Err(e)
                }
            })?;
        Ok(())
    }

    pub async fn resume_producer(
        &self,
        sfu_origin: &str,
        router_id: &str,
        producer_id: &str,
    ) -> Result<(), String> {
        let path = format!(
            "/api/routers/{}/producers/{}/resume",
            urlencoding::encode(router_id),
            urlencoding::encode(producer_id),
        );
        let _: Value = self
            .sfu_fetch(sfu_origin, &path, reqwest::Method::POST, None)
            .await
            .or_else(|e| {
                if e.contains("empty body") || e.contains("parse error") {
                    Ok(Value::Null)
                } else {
                    Err(e)
                }
            })?;
        Ok(())
    }

    pub async fn close_producer(
        &self,
        sfu_origin: &str,
        router_id: &str,
        producer_id: &str,
    ) -> Result<(), String> {
        let path = format!(
            "/api/routers/{}/producers/{}",
            urlencoding::encode(router_id),
            urlencoding::encode(producer_id),
        );
        let _: Value = self
            .sfu_fetch(sfu_origin, &path, reqwest::Method::DELETE, None)
            .await
            .or_else(|e| {
                if e.contains("empty body") || e.contains("parse error") {
                    Ok(Value::Null)
                } else {
                    Err(e)
                }
            })?;
        Ok(())
    }

    pub async fn set_preferred_layers(
        &self,
        sfu_origin: &str,
        router_id: &str,
        consumer_id: &str,
        spatial_layer: u8,
        temporal_layer: Option<u8>,
    ) -> Result<(), String> {
        let path = format!(
            "/api/routers/{}/consumers/{}/layers",
            urlencoding::encode(router_id),
            urlencoding::encode(consumer_id),
        );
        let body = serde_json::json!({
            "spatialLayer": spatial_layer,
            "temporalLayer": temporal_layer,
        });
        let _: Value = self
            .sfu_fetch(sfu_origin, &path, reqwest::Method::POST, Some(body))
            .await
            .or_else(|e| {
                if e.contains("empty body") || e.contains("parse error") {
                    Ok(Value::Null)
                } else {
                    Err(e)
                }
            })?;
        Ok(())
    }

    pub async fn restart_ice(
        &self,
        sfu_origin: &str,
        router_id: &str,
        transport_id: &str,
    ) -> Result<SfuIceRestarted, String> {
        let path = format!(
            "/api/routers/{}/transports/{}/restart-ice",
            urlencoding::encode(router_id),
            urlencoding::encode(transport_id),
        );
        self.sfu_fetch(sfu_origin, &path, reqwest::Method::POST, None)
            .await
    }

    pub async fn set_max_incoming_bitrate(
        &self,
        sfu_origin: &str,
        router_id: &str,
        transport_id: &str,
        bitrate: u64,
    ) -> Result<(), String> {
        let path = format!(
            "/api/routers/{}/transports/{}/max-bitrate",
            urlencoding::encode(router_id),
            urlencoding::encode(transport_id),
        );
        let body = serde_json::json!({ "bitrate": bitrate });
        let _: Value = self
            .sfu_fetch(sfu_origin, &path, reqwest::Method::POST, Some(body))
            .await
            .or_else(|e| {
                if e.contains("empty body") || e.contains("parse error") {
                    Ok(Value::Null)
                } else {
                    Err(e)
                }
            })?;
        Ok(())
    }

    pub async fn produce_data(
        &self,
        sfu_origin: &str,
        router_id: &str,
        transport_id: &str,
        sctp_stream_parameters: Value,
        label: &str,
        protocol: &str,
        app_data: Value,
    ) -> Result<SfuDataProducerCreated, String> {
        let path = format!(
            "/api/routers/{}/data-producers",
            urlencoding::encode(router_id)
        );
        let body = serde_json::json!({
            "transportId": transport_id,
            "sctpStreamParameters": sctp_stream_parameters,
            "label": label,
            "protocol": protocol,
            "appData": app_data,
        });
        self.sfu_fetch(sfu_origin, &path, reqwest::Method::POST, Some(body))
            .await
    }

    pub async fn consume_data(
        &self,
        sfu_origin: &str,
        router_id: &str,
        transport_id: &str,
        data_producer_id: &str,
    ) -> Result<Option<SfuDataConsumerCreated>, String> {
        let path = format!(
            "/api/routers/{}/data-consumers",
            urlencoding::encode(router_id)
        );
        let body = serde_json::json!({
            "transportId": transport_id,
            "dataProducerId": data_producer_id,
        });
        self.sfu_fetch(sfu_origin, &path, reqwest::Method::POST, Some(body))
            .await
    }

    /// Allocate a room on the least-loaded SFU node.
    ///
    /// Phase 1: round-robin against the configured `SFU_NODES` list.
    pub async fn allocate_room(
        &self,
        sfu_origin: &str,
        room_id: &str,
    ) -> Result<SfuRoomAllocation, String> {
        let path = "/api/routers";
        let body = serde_json::json!({ "roomId": room_id });
        self.sfu_fetch(sfu_origin, path, reqwest::Method::POST, Some(body))
            .await
    }

    /// Release / destroy a router on the SFU (room teardown).
    pub async fn release_room(
        &self,
        sfu_origin: &str,
        router_id: &str,
    ) -> Result<(), String> {
        let path = format!("/api/routers/{}", urlencoding::encode(router_id));
        let _: Value = self
            .sfu_fetch(sfu_origin, &path, reqwest::Method::DELETE, None)
            .await
            .or_else(|e| {
                if e.contains("empty body") || e.contains("parse error") {
                    Ok(Value::Null)
                } else {
                    Err(e)
                }
            })?;
        Ok(())
    }
}
