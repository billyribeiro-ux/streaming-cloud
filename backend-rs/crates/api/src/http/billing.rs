//! Billing endpoints (parity with the Laravel `BillingController` +
//! `StripeWebhookController`): plans, Checkout, Billing Portal, current
//! subscription, and the signed Stripe webhook.

use axum::body::Bytes;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use garde::Validate;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::db;
use crate::db::subscriptions::UpsertSubscription;
use crate::domain::plan::Plan;
use crate::error::{AppError, AppResult};
use crate::http::guard;
use crate::state::AppState;
use crate::stripe;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/v1/plans", get(plans))
        .route("/v1/billing/subscribe", post(subscribe))
        .route("/v1/billing/portal", post(portal))
        .route("/v1/billing/subscription", get(subscription))
        .route("/v1/webhooks/stripe", post(webhook))
}

async fn plans(State(state): State<AppState>, _user: AuthUser) -> AppResult<Json<Vec<Plan>>> {
    Ok(Json(db::plans::list_active(&state.db).await?))
}

#[derive(Debug, Deserialize, Validate)]
struct SubscribeRequest {
    #[garde(skip)]
    organization_id: Uuid,
    #[garde(skip)]
    plan_id: Uuid,
    #[garde(skip)]
    billing_period: Option<String>,
}

async fn subscribe(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(req): Json<SubscribeRequest>,
) -> AppResult<Json<Value>> {
    guard::ensure_member(&state, req.organization_id, user.id).await?;

    let plan = db::plans::find(&state.db, req.plan_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let yearly = req.billing_period.as_deref() == Some("yearly");
    let price_id = if yearly {
        plan.stripe_price_id_yearly
    } else {
        plan.stripe_price_id_monthly
    }
    .ok_or_else(|| AppError::Validation("this plan has no price for that billing period".into()))?;

    let customer = ensure_customer(&state, req.organization_id, &user.name, &user.email).await?;

    let success_url = format!("{}/settings/billing?status=success", state.config.app_url);
    let cancel_url = format!("{}/settings/billing?status=cancelled", state.config.app_url);

    let checkout_url = stripe::create_checkout_session(
        &state,
        &customer,
        &price_id,
        &success_url,
        &cancel_url,
        &req.organization_id.to_string(),
        &req.plan_id.to_string(),
    )
    .await?;

    Ok(Json(json!({ "checkout_url": checkout_url })))
}

#[derive(Debug, Deserialize)]
struct PortalRequest {
    organization_id: Uuid,
}

async fn portal(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(req): Json<PortalRequest>,
) -> AppResult<Json<Value>> {
    guard::ensure_member(&state, req.organization_id, user.id).await?;

    let customer = db::organizations::stripe_customer_id(&state.db, req.organization_id)
        .await?
        .ok_or_else(|| AppError::Validation("no billing account for this organization".into()))?;

    let return_url = format!("{}/settings/billing", state.config.app_url);
    let portal_url = stripe::create_portal_session(&state, &customer, &return_url).await?;

    Ok(Json(json!({ "portal_url": portal_url })))
}

#[derive(Debug, Deserialize)]
struct SubscriptionQuery {
    organization_id: Uuid,
}

async fn subscription(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(q): Query<SubscriptionQuery>,
) -> AppResult<Json<Value>> {
    guard::ensure_member(&state, q.organization_id, user.id).await?;

    let subscription = db::subscriptions::find_for_org(&state.db, q.organization_id).await?;
    let plan = match subscription.as_ref().and_then(|s| s.plan_id) {
        Some(plan_id) => db::plans::find(&state.db, plan_id).await?,
        None => None,
    };
    let has_active = subscription.as_ref().is_some_and(|s| s.is_active());

    Ok(Json(json!({
        "subscription": subscription,
        "plan": plan,
        "has_active_subscription": has_active,
    })))
}

/// Stripe webhook. Verifies the signature against the raw body, then syncs
/// subscription state. Always returns `200` for handled/ignored events so
/// Stripe does not retry indefinitely on events we don't care about.
async fn webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> AppResult<StatusCode> {
    let signature = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    if !stripe::verify_webhook(
        &state.config.stripe_webhook_secret,
        &body,
        signature,
        Utc::now().timestamp(),
    ) {
        return Err(AppError::Unauthorized);
    }

    let event: Value = serde_json::from_slice(&body)
        .map_err(|_| AppError::Validation("invalid payload".into()))?;
    let event_type = event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let object = event
        .pointer("/data/object")
        .cloned()
        .unwrap_or(Value::Null);

    match event_type {
        "checkout.session.completed" => {
            if let (Some(org), Some(sub_id)) = (
                meta_uuid(&object, "organization_id"),
                object.get("subscription").and_then(Value::as_str),
            ) {
                db::subscriptions::upsert(
                    &state.db,
                    UpsertSubscription {
                        organization_id: org,
                        plan_id: meta_uuid(&object, "plan_id"),
                        stripe_subscription_id: sub_id.to_string(),
                        status: "active".to_string(),
                        current_period_start: None,
                        current_period_end: None,
                        cancelled_at: None,
                    },
                )
                .await?;
            }
        }
        "customer.subscription.updated" | "customer.subscription.deleted" => {
            if let (Some(org), Some(sub_id)) = (
                meta_uuid(&object, "organization_id"),
                object.get("id").and_then(Value::as_str),
            ) {
                let status = object
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("incomplete")
                    .to_string();
                db::subscriptions::upsert(
                    &state.db,
                    UpsertSubscription {
                        organization_id: org,
                        plan_id: meta_uuid(&object, "plan_id"),
                        stripe_subscription_id: sub_id.to_string(),
                        status,
                        current_period_start: epoch(&object, "current_period_start"),
                        current_period_end: epoch(&object, "current_period_end"),
                        cancelled_at: epoch(&object, "canceled_at"),
                    },
                )
                .await?;
            }
        }
        _ => {}
    }

    Ok(StatusCode::OK)
}

/// Resolves the organization's Stripe customer, creating and persisting one on
/// first use.
async fn ensure_customer(
    state: &AppState,
    org_id: Uuid,
    name: &str,
    email: &str,
) -> AppResult<String> {
    if let Some(existing) = db::organizations::stripe_customer_id(&state.db, org_id).await? {
        return Ok(existing);
    }
    let customer = stripe::create_customer(state, name, email).await?;
    db::organizations::set_stripe_customer(&state.db, org_id, &customer).await?;
    Ok(customer)
}

fn meta_uuid(object: &Value, key: &str) -> Option<Uuid> {
    object
        .pointer(&format!("/metadata/{key}"))
        .and_then(Value::as_str)
        .and_then(|s| Uuid::parse_str(s).ok())
}

fn epoch(object: &Value, key: &str) -> Option<DateTime<Utc>> {
    object
        .get(key)
        .and_then(Value::as_i64)
        .and_then(|secs| DateTime::from_timestamp(secs, 0))
}
