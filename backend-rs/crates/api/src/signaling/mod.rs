//! Signaling control-plane integration.
//!
//! Two responsibilities, mirroring the Laravel `SignalingService` and the
//! existing `signaling-rs` service:
//!   * [`token`] mints short-lived HS256 client tokens the browser presents to
//!     the signaling WebSocket.
//!   * [`sfu`] is the HTTP control-plane client (allocate/close/remove/mute),
//!     authenticated with the shared signaling secret.

pub mod sfu;
pub mod token;
