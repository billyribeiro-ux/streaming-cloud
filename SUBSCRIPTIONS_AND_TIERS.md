# Subscriptions, Services & Tiers — End-to-End Setup

Everything you need to sign up for (external services) and configure (the in-app
plan catalog) to run **Trading Room** end-to-end: Rust API (`backend-rs`),
SvelteKit frontend (`frontend-svelte`), Node signaling + mediasoup SFU,
recorder, Postgres, Redis, and TURN.

There are **two kinds of "subscriptions"** here:

1. **External service subscriptions** — third-party accounts the platform depends on (§1).
2. **In-app subscription tiers** — the plans *your customers* buy, defined in Stripe + the `plans` table (§2).

---

## 1. External service subscriptions (accounts you must create)

| # | Service | Required? | What it powers | Recommended tier | Approx. cost |
|---|---------|-----------|----------------|------------------|--------------|
| 1 | **Neon** (Postgres) | ✅ Required | Primary database (all app data) | Free to start → **Launch** in prod | $0 → **$19/mo** |
| 2 | **Stripe** | ✅ Required (billing) | Checkout, Billing Portal, subscription webhooks | Standard (no monthly fee) | **2.9% + $0.30** per txn |
| 3 | **Cloudflare R2** | ✅ Required (file uploads) | Room file storage via presigned URLs | Free tier → usage | $0 (10 GB free) → **~$5–10/mo** |
| 4 | **TURN/STUN server** | ✅ Required (WebRTC) | NAT traversal so calls connect across networks | Self-host **coturn** (incl. in compose) **or** managed | $0 (self-host) or usage |
| 5 | **Compute / hosting** | ✅ Required | Runs the API, frontend, signaling, **SFU**, TURN | **Hetzner** (or any VPS/cloud) — needs public IP + open UDP | **~$52/mo** (2 servers) |
| 6 | **Redis** | ✅ Required | Signaling/SFU coordination & cache | Self-host (incl. in compose) **or** Upstash/Redis Cloud | $0 (self-host) → ~$10/mo |
| 7 | **Domain + TLS** | ✅ Required | Public hostnames + HTTPS/WSS | Any registrar; TLS via Let's Encrypt/Cloudflare (free) | **$10–15/yr** |
| 8 | **Cloudflare** (DNS/CDN/WAF) | ⭐ Recommended | DNS, CDN, WAF, TLS | Free plan is sufficient | $0 |
| 9 | **Transactional email** | ⭐ Recommended | Email verification / password reset / receipts | Resend / Postmark / SES / Mailgun | $0–$15/mo |
| 10 | **GitHub** (Actions + GHCR) | ⭐ Recommended | CI (tests/clippy/svelte-check) + image registry | Free for the included usage | $0 |
| 11 | **Observability** (OTLP) | ⚪ Optional | Distributed tracing | Self-host **Jaeger** (incl. in compose) or Grafana Cloud/Honeycomb | $0 → usage |
| 12 | **Codecov** | ⚪ Optional | CI coverage upload (`CODECOV_TOKEN`) | Free for the included usage | $0 |
| 13 | **Slack** | ⚪ Optional | Deploy notifications (incoming webhook) | Free | $0 |

> **Minimum to run end-to-end:** Neon + Stripe + Cloudflare R2 + a TURN server +
> one VPS (with Redis) + a domain. Estimated base: **~$60–85/month** plus Stripe
> fees.

### 1.1 What each service maps to (env vars)

| Service | Env vars (where) |
|---------|------------------|
| Neon Postgres | `DATABASE_URL` (api-rs, signaling) |
| Redis | `REDIS_URL` (signaling, sfu) |
| Stripe | `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_KEY` (publishable, frontend); price IDs → `plans` table |
| Cloudflare R2 | `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_REGION` (api-rs) |
| TURN | `TURN_SERVER_URL`, `TURN_SERVER_USERNAME`, `TURN_SERVER_CREDENTIAL` |
| Signaling control-plane | `SIGNALING_URL`, `SIGNALING_SECRET`, `JWT_SECRET`, `SIGNALING_WS_URL`/`PUBLIC_SIGNALING_URL` (frontend) |
| SFU | `SFU_NODES`, `SFU_ANNOUNCED_IP`, `SFU_NODE_ID` |
| Frontend (BFF) | `API_URL` (server-side → api-rs), `PUBLIC_SIGNALING_URL` |
| App base URL | `APP_URL`, `CORS_ORIGINS` |
| Observability | `OTEL_EXPORTER_OTLP_ENDPOINT` (optional, e.g. `http://jaeger:4318`) |

---

## 2. In-app subscription tiers (your product's plans)

These are the plans customers subscribe to. Each must exist in **two places**,
kept in sync:

1. **Stripe** — one **Product** per paid tier, each with a **monthly** and a
   **yearly** recurring **Price**.
2. **Postgres `plans` table** — one row per tier, holding the limits + the
   Stripe price IDs (`stripe_price_id_monthly`, `stripe_price_id_yearly`).

### 2.1 Recommended tier catalog

`-1` means **unlimited**. Annual price ≈ 10× monthly (2 months free).

| Tier | Monthly | Yearly | Workspaces | Rooms | Hosts/room | Viewers/room | Storage | Recording | Analytics | SSO | API | Audit logs | SLA |
|------|--------:|-------:|-----------:|------:|-----------:|-------------:|--------:|:---------:|-----------|:---:|:---:|:----------:|----:|
| **Free** | $0 | $0 | 1 | 1 | 1 | 10 | 1 GB | ✗ | basic | ✗ | ✗ | ✗ | — |
| **Starter** | $49 | $490 | 1 | 3 | 1 | 50 | 5 GB | ✗ | basic | ✗ | ✗ | ✗ | 99.5% |
| **Professional** | $149 | $1,490 | 3 | 10 | 3 | 200 | 25 GB | ✓ | advanced | ✗ | ✓ | ✗ | 99.9% |
| **Business** | $449 | $4,490 | 10 | 50 | 10 | 1,000 | 100 GB | ✓ | full | ✓ | ✓ | ✓ | 99.95% |
| **Enterprise** | Custom | Custom | ∞ | ∞ | ∞ | ∞ | ∞ | ✓ | full | ✓ | ✓ | ✓ | 99.99% |

> The **Free** tier is the default for every newly-registered organization (no
> Stripe needed). **Enterprise** is sold via sales (no public Stripe price — set
> `is_active = false` or handle manually).

### 2.2 Stripe setup (per paid tier)

For **Starter, Professional, Business** (do it in **Test mode** first, then repeat in **Live**):

1. **Dashboard → Products → Add product** — name it (e.g. `Professional Plan`).
2. Add a **recurring monthly** price and a **recurring yearly** price.
3. Copy both **Price IDs** (`price_…`) into the matching `plans` row.
4. **Dashboard → Developers → Webhooks → Add endpoint:**
   - URL: `https://api.<your-domain>/v1/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.
5. Put the **publishable** key in the frontend (`STRIPE_KEY` / `pk_…`) and the
   **secret** key in the API (`STRIPE_SECRET` / `sk_…`).

> The API auto-creates a Stripe **Customer** per organization on first checkout,
> sends `metadata.organization_id` / `metadata.plan_id` through Checkout, and the
> webhook upserts the `subscriptions` row keyed on `stripe_subscription_id`.

### 2.3 Seed the `plans` table

Prices are stored as **integer cents**. Replace the `price_…` placeholders with
the IDs from §2.2 (leave Free as `NULL`).

```sql
-- backend-rs schema: crates/api/migrations/0005_billing.sql
INSERT INTO plans
  (name, display_name, price_monthly_cents, price_yearly_cents,
   stripe_price_id_monthly, stripe_price_id_yearly,
   max_workspaces, max_rooms, max_hosts_per_room, max_viewers_per_room, max_storage_gb,
   features, is_active)
VALUES
  ('free', 'Free', 0, 0, NULL, NULL,
   1, 1, 1, 10, 1,
   '{"recording": false, "analytics": "basic", "sso": false, "api_access": false, "audit_logs": false}', true),

  ('starter', 'Starter', 4900, 49000,
   'price_STARTER_MONTHLY', 'price_STARTER_YEARLY',
   1, 3, 1, 50, 5,
   '{"recording": false, "analytics": "basic", "sso": false, "api_access": false, "audit_logs": false, "sla": "99.5"}', true),

  ('professional', 'Professional', 14900, 149000,
   'price_PRO_MONTHLY', 'price_PRO_YEARLY',
   3, 10, 3, 200, 25,
   '{"recording": true, "analytics": "advanced", "sso": false, "api_access": true, "audit_logs": false, "sla": "99.9"}', true),

  ('business', 'Business', 44900, 449000,
   'price_BUSINESS_MONTHLY', 'price_BUSINESS_YEARLY',
   10, 50, 10, 1000, 100,
   '{"recording": true, "analytics": "full", "custom_branding": true, "sso": true, "api_access": true, "audit_logs": true, "sla": "99.95"}', true),

  ('enterprise', 'Enterprise', 0, 0, NULL, NULL,
   -1, -1, -1, -1, -1,
   '{"recording": true, "analytics": "full", "custom_branding": true, "sso": true, "api_access": true, "audit_logs": true, "sla": "99.99", "dedicated_support": true}', false);
```

---

## 3. End-to-end provisioning checklist

- [ ] **Neon** project created → `DATABASE_URL` set; run `sqlx migrate run --source crates/api/migrations` (or `make migrate`).
- [ ] **Redis** reachable → `REDIS_URL` set (compose `redis` service or managed).
- [ ] **Cloudflare R2** bucket + API token → `R2_*` set.
- [ ] **Stripe** products/prices created → IDs seeded into `plans`; webhook endpoint added → `STRIPE_SECRET` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_KEY` set.
- [ ] **TURN** server running (coturn or managed) → `TURN_SERVER_*` set; UDP ports open.
- [ ] **SFU** host has a public IP → `SFU_ANNOUNCED_IP` + RTC UDP/TCP port range (10000–10100) open.
- [ ] **Domain + TLS** → `app.<domain>` (frontend), `api.<domain>` (Rust API), `signaling.<domain>` (WSS); `APP_URL`, `CORS_ORIGINS`, `PUBLIC_SIGNALING_URL` set.
- [ ] **Secrets** generated → strong `JWT_SECRET` and `SIGNALING_SECRET` (shared between the API and `signaling-rs`/signaling).
- [ ] *(Recommended)* Transactional email provider configured (only needed once email flows are enabled).
- [ ] *(Optional)* `OTEL_EXPORTER_OTLP_ENDPOINT` → Jaeger/Grafana for traces.

### Dev shortcut

Everything except Neon/Stripe/R2/TURN can run locally via
`make docker-up` (Postgres can also be local). Use Stripe **test** keys, the
Stripe CLI (`stripe listen --forward-to localhost:8080/v1/webhooks/stripe`) to
exercise webhooks, and `coturn` from the compose file for TURN.

---

_Tier limits/features above mirror `docs/DATABASE_SCHEMA.md`; the `plans` columns
match `backend-rs/crates/api/migrations/0005_billing.sql`. Adjust prices/limits to
your market — the app reads them from the DB, so changes need no code edits (only
matching Stripe prices)._
