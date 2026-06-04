//! Client signaling token minting (HS256), wire-compatible with the claims the
//! `signaling-rs` auth layer expects.

use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::Serialize;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

const TOKEN_TTL_SECONDS: i64 = 3600;

#[derive(Debug, Serialize)]
struct SignalingClaims {
    iss: String,
    sub: String,
    user_id: Uuid,
    room_id: Uuid,
    participant_id: Uuid,
    organization_id: Uuid,
    role: String,
    display_name: String,
    iat: i64,
    exp: i64,
}

/// Inputs needed to mint a participant's signaling token.
pub struct MintParams {
    pub user_id: Uuid,
    pub room_id: Uuid,
    pub participant_id: Uuid,
    pub organization_id: Uuid,
    pub role: String,
    pub display_name: String,
}

/// Mints a short-lived (1 hour) HS256 token for the signaling WebSocket.
pub fn mint(secret: &str, params: MintParams) -> AppResult<String> {
    let now = Utc::now().timestamp();
    let claims = SignalingClaims {
        iss: "tradingroom-api".to_string(),
        sub: params.user_id.to_string(),
        user_id: params.user_id,
        room_id: params.room_id,
        participant_id: params.participant_id,
        organization_id: params.organization_id,
        role: params.role,
        display_name: params.display_name,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("failed to mint signaling token: {e}")))
}
