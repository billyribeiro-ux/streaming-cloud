# Setup Keys & Accounts — Step-by-Step Checklist

A from-zero walkthrough to obtain every secret and account this app needs, with the
exact value → environment-variable mapping. Tick each box as you go.

There are **three kinds** of values:

- 🔐 **Self-generated** — random strings you create locally. No signup.
- 🧩 **Account-supplied** — copied from a provider dashboard.
- 🖥️ **Infra-supplied** — produced when you provision a server (e.g. its public IP).

> **Fastest path:** you can run the *entire* stack locally with only the
> 🔐 self-generated values (see §0 and the "Run locally first" box at the end).
> Sign up for the paid providers only when you're ready for production.

---

## 0. Self-generated secrets (do this first — no accounts)

Generate each value and paste it into `.env`. `JWT_SECRET` and `SIGNALING_SECRET`
**must be identical** everywhere they appear (API ⇄ signaling).

```bash
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → SIGNALING_SECRET   (share with signaling service)
openssl rand -hex 32   # → TURN_AUTH_SECRET   (coturn static-auth-secret)
openssl rand -hex 16   # → REDIS_PASSWORD
```

- [ ] `JWT_SECRET` set (same value in API and signaling)
- [ ] `SIGNALING_SECRET` set (same value in API and signaling)
- [ ] `TURN_AUTH_SECRET` set (→ coturn `static-auth-secret`)
- [ ] `REDIS_PASSWORD` set

---

## 1. Domain  🧩  (~$10–15/yr)

Buy a domain at any registrar (Cloudflare Registrar, Namecheap, Porkbun).

- [ ] Domain purchased → gives you `app.`, `api.`, `signaling.`, `turn.`, `sfu1.` subdomains
- [ ] Set `APP_URL=https://app.<domain>`
- [ ] Set `CORS_ORIGINS=https://app.<domain>`
- [ ] Set `API_URL=https://api.<domain>` (frontend BFF → API)
- [ ] Set `PUBLIC_SIGNALING_URL=wss://signaling.<domain>/ws`

---

## 2. Cloudflare (DNS + TLS + WAF)  🧩  (free)

Sign up at cloudflare.com → **Add a site** → point your registrar's nameservers at
Cloudflare. No paid key required.

- [ ] Domain added to Cloudflare; nameservers updated
- [ ] DNS records created (see `docs/MEDIA_INFRASTRUCTURE.md` §8):
  - [ ] `app` / `api` / `signaling` → **proxied** (orange cloud) OK
  - [ ] `turn` and `sfu1` → **DNS-only** (grey cloud) — WebRTC UDP can't be proxied
- [ ] TLS mode set to **Full (strict)**

---

## 3. Hetzner Cloud (servers — Path A self-host)  🖥️  (~$30–60/mo per box)

Sign up at console.hetzner.cloud → create a project → create servers.

- [ ] **SFU box**: CCX23 or CCX33 (**dedicated** vCPU) — note its public IPv4
- [ ] **App box**: CX32 / CPX31 (API + frontend + signaling + Redis)
- [ ] **TURN**: co-locate on SFU box, or a small CX22 — note its public IPv4
- [ ] Set `SFU_ANNOUNCED_IP=<SFU box public IPv4>`
- [ ] Set `SFU_NODES=sfu1.<domain>:4000` (how signaling reaches the SFU)
- [ ] Set `TURN_EXTERNAL_IP=<TURN box public IPv4>` (coturn `external-ip`)
- [ ] Firewall: open `40000–49999` UDP+TCP (SFU), `3478`/`5349` + relay range (TURN),
      `80`/`443` (app). See `docs/MEDIA_INFRASTRUCTURE.md` §4.

> Redis and coturn are **self-hosted** from `infrastructure/docker/docker-compose.yml`
> — no Redis/TURN SaaS keys needed unless you choose to outsource them.

---

## 4. Neon (Postgres)  🧩  (free to start → ~$19/mo)

neon.tech → sign up → **New Project**.

- [ ] Project created
- [ ] Console → **Connection Details** → copy the **pooled** connection string
- [ ] Set `DATABASE_URL=postgresql://…@…neon.tech/neondb?sslmode=require`
- [ ] Run migrations: `sqlx migrate run --source backend-rs/crates/api/migrations` (or `make migrate`)
- [ ] Seed the `plans` table (SQL in `SUBSCRIPTIONS_AND_TIERS.md` §2.3)

---

## 5. Cloudflare R2 (file storage)  🧩  (free 10 GB → usage)

In the Cloudflare dashboard → **R2** → **Create bucket**, then **Manage R2 API Tokens**.

- [ ] Bucket created → set `R2_BUCKET=<bucket name>`
- [ ] API token created → set `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`
- [ ] Set `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`
- [ ] Set `R2_REGION=auto`
- [ ] (Optional public bucket) set `R2_PUBLIC_URL=https://files.<domain>`

---

## 6. Stripe (billing)  🧩  (no monthly fee; 2.9% + $0.30/txn)

stripe.com → sign up → **stay in Test mode** until you've verified the flow.

- [ ] Developers → **API keys**:
  - [ ] Secret key (`sk_test_…`) → `STRIPE_SECRET`
  - [ ] Publishable key (`pk_test_…`) → `STRIPE_KEY` (frontend)
- [ ] Create **Products + monthly/yearly Prices** for Starter / Professional / Business
      (`SUBSCRIPTIONS_AND_TIERS.md` §2.2) → put the `price_…` IDs in the `plans` table
- [ ] Developers → **Webhooks** → add endpoint `https://api.<domain>/v1/webhooks/stripe`
      with events `checkout.session.completed`, `customer.subscription.updated`,
      `customer.subscription.deleted`
- [ ] Copy the webhook **signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`
- [ ] When live: repeat in **Live mode** and swap to `sk_live_…` / `pk_live_…`

---

## 7. Optional (skip until needed)

- [ ] **Transactional email** (Resend / Postmark / SES) — verification & receipts
- [ ] **Observability** — `OTEL_EXPORTER_OTLP_ENDPOINT` → self-hosted Jaeger (in compose) or Grafana Cloud
- [ ] **Sentry** — `SENTRY_DSN`

---

## Value → environment-variable quick reference

| Value | Env var(s) | Source |
|-------|-----------|--------|
| JWT signing secret | `JWT_SECRET` | 🔐 `openssl rand -hex 32` |
| Signaling shared secret | `SIGNALING_SECRET` | 🔐 `openssl rand -hex 32` |
| TURN shared secret | `TURN_AUTH_SECRET` | 🔐 `openssl rand -hex 32` |
| Redis password | `REDIS_PASSWORD` | 🔐 `openssl rand -hex 16` |
| Postgres URL | `DATABASE_URL` | 🧩 Neon |
| Stripe secret / publishable / webhook | `STRIPE_SECRET`, `STRIPE_KEY`, `STRIPE_WEBHOOK_SECRET` | 🧩 Stripe |
| R2 credentials | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_REGION` | 🧩 Cloudflare R2 |
| SFU public IP | `SFU_ANNOUNCED_IP` | 🖥️ Hetzner SFU box |
| SFU address for signaling | `SFU_NODES` | 🖥️ `sfu1.<domain>:4000` |
| TURN public IP | `TURN_EXTERNAL_IP` | 🖥️ Hetzner TURN box |
| App / API / signaling URLs | `APP_URL`, `API_URL`, `CORS_ORIGINS`, `PUBLIC_SIGNALING_URL` | 🧩 your domain |

---

## Run locally first (zero paid accounts)

```bash
cp .env.example .env          # fill in only the §0 openssl secrets
make docker-up                # Postgres + Redis + signaling + SFU + coturn, all local
```

- Postgres, Redis, coturn run in Docker — no Neon / Upstash / TURN SaaS needed.
- Stripe: use **test** keys + `stripe listen --forward-to localhost:8080/v1/webhooks/stripe`.
- R2: only needed once you exercise file uploads.

Verify realtime media: open `chrome://webrtc-internals`, join a room, confirm the
`candidate-pair` is `host`/`srflx` (**not** `relay`) and RTT is low. Details in
`docs/MEDIA_INFRASTRUCTURE.md` §10.

---

_Related docs: `SUBSCRIPTIONS_AND_TIERS.md` (services + in-app tiers),
`docs/MEDIA_INFRASTRUCTURE.md` (realtime SFU/TURN), `DEPLOYMENT_GUIDE.md` (full deploy)._
