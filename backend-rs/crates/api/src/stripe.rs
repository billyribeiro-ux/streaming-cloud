//! Minimal Stripe client over the shared `reqwest` client.
//!
//! Only the handful of calls the platform needs (customers, Checkout, Billing
//! Portal) plus webhook signature verification — deliberately avoiding the
//! heavyweight `async-stripe` dependency tree for a small, auditable surface.

use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::Sha256;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

const API_BASE: &str = "https://api.stripe.com";

/// Webhook signatures older than this (seconds) are rejected (replay defense).
const WEBHOOK_TOLERANCE_SECONDS: i64 = 300;

type HmacSha256 = Hmac<Sha256>;

async fn post_form(state: &AppState, path: &str, form: &[(&str, &str)]) -> AppResult<Value> {
    let response = state
        .http
        .post(format!("{API_BASE}{path}"))
        .bearer_auth(&state.config.stripe_secret)
        .form(form)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("stripe {path} request failed: {e}")))?;

    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "stripe {path} -> {status}: {text}"
        )));
    }

    serde_json::from_str(&text)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("stripe {path} decode failed: {e}")))
}

fn extract_string(value: &Value, key: &str) -> AppResult<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("stripe response missing `{key}`")))
}

pub async fn create_customer(state: &AppState, name: &str, email: &str) -> AppResult<String> {
    let value = post_form(state, "/v1/customers", &[("name", name), ("email", email)]).await?;
    extract_string(&value, "id")
}

#[allow(clippy::too_many_arguments)]
pub async fn create_checkout_session(
    state: &AppState,
    customer: &str,
    price: &str,
    success_url: &str,
    cancel_url: &str,
    organization_id: &str,
    plan_id: &str,
) -> AppResult<String> {
    let value = post_form(
        state,
        "/v1/checkout/sessions",
        &[
            ("mode", "subscription"),
            ("customer", customer),
            ("line_items[0][price]", price),
            ("line_items[0][quantity]", "1"),
            ("success_url", success_url),
            ("cancel_url", cancel_url),
            ("metadata[organization_id]", organization_id),
            ("metadata[plan_id]", plan_id),
            (
                "subscription_data[metadata][organization_id]",
                organization_id,
            ),
            ("subscription_data[metadata][plan_id]", plan_id),
        ],
    )
    .await?;
    extract_string(&value, "url")
}

pub async fn create_portal_session(
    state: &AppState,
    customer: &str,
    return_url: &str,
) -> AppResult<String> {
    let value = post_form(
        state,
        "/v1/billing_portal/sessions",
        &[("customer", customer), ("return_url", return_url)],
    )
    .await?;
    extract_string(&value, "url")
}

/// Verifies a `Stripe-Signature` header against the raw request body, with a
/// timestamp tolerance to defend against replays. Constant-time comparison.
pub fn verify_webhook(secret: &str, payload: &[u8], signature_header: &str, now: i64) -> bool {
    let mut timestamp: Option<i64> = None;
    let mut signatures: Vec<&str> = Vec::new();

    for part in signature_header.split(',') {
        match part.split_once('=') {
            Some(("t", value)) => timestamp = value.parse().ok(),
            Some(("v1", value)) => signatures.push(value),
            _ => {}
        }
    }

    let Some(t) = timestamp else { return false };
    if (now - t).abs() > WEBHOOK_TOLERANCE_SECONDS {
        return false;
    }

    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(t.to_string().as_bytes());
    mac.update(b".");
    mac.update(payload);
    let expected = hex_lower(&mac.finalize().into_bytes());

    signatures
        .iter()
        .any(|candidate| constant_time_eq(candidate.as_bytes(), expected.as_bytes()))
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter()
        .zip(b.iter())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn webhook_signature_roundtrip() {
        let secret = "whsec_test";
        let payload = br#"{"id":"evt_1","type":"checkout.session.completed"}"#;
        let t = 1_700_000_000_i64;

        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(t.to_string().as_bytes());
        mac.update(b".");
        mac.update(payload);
        let sig = hex_lower(&mac.finalize().into_bytes());
        let header = format!("t={t},v1={sig}");

        assert!(verify_webhook(secret, payload, &header, t));
        // Tampered body fails.
        assert!(!verify_webhook(secret, b"{}", &header, t));
        // Stale timestamp fails.
        assert!(!verify_webhook(secret, payload, &header, t + 10_000));
    }
}
