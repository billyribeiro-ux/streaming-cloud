# Migration Plan — Full Svelte 5 / SvelteKit Frontend + Rust (Axum/Tokio/sqlx) Backend

> **Status:** Proposed (planning artifact). No production code is changed by this document.
> **Date:** June 4, 2026 · **Target stack versions:** latest stable as of this date (see `stack.md`).
> **Authoring standard:** principal / L7+ — idiomatic, clean, observable, testable, incrementally shippable.

---

## 1. Context — why this is being done

The platform today runs **two** frontends and a PHP backend:

- `frontend/` — the **real, production React 19** SPA (16 routes, complex WebRTC/mediasoup room, E2EE, admin, billing).
- `frontend-svelte/` — a **partial SvelteKit scaffold** (the room store, `signaling.ts`, and `media-client.ts` are already ported to framework-agnostic TS + Svelte 5 runes; most pages are missing).
- `backend/` — a **mature Laravel 13** SaaS API: ~50 endpoints across 11 domains, 17 Postgres tables, Sanctum tokens, Stripe (Cashier) billing, Horizon queues, Redis, Cloudflare R2.
- `signaling-rs/` — an **existing Rust (Axum 0.8 + Tokio) signaling service** that already establishes our Rust idioms (config, JWT auth, `dashmap` state, `reqwest` SFU proxy, `tracing`, graceful shutdown). **This is our reference for the new Rust backend.**

**Goal:** Make the **entire frontend** Svelte 5 / SvelteKit (latest syntax) and **rewrite the Laravel backend** in Rust + Axum + Tokio + **sqlx** (plus the supporting crates below), to a distinguished-engineer standard — idiomatic, clean, professional, with continuous correctness auditing via MCP tooling at every step.

**Out of scope (deliberately kept):** the Node `sfu/` (mediasoup C++ core — keep), `recorder/`, and `signaling-rs/` itself. The tech-stack audit (`docs/TECH_STACK_AUDIT.md`) is explicit that **mediasoup must not be rewritten in Rust**.

> ⚠️ **Decision flag — read before committing budget.** `docs/TECH_STACK_AUDIT.md` explicitly recommends **AGAINST** migrating Laravel → Rust ("DO NOT migrate Laravel to Rust for 12+ months — not on the latency-critical path; payoff near-zero; rewrite effort enormous"). This plan **proceeds anyway per your explicit instruction**, but treats the backend rewrite as a months-long strangler-fig migration (§6), not a big-bang. The frontend Svelte migration is endorsed by the audit (Phase 3) and is lower-risk.

---

## 2. Tooling — the MCP "audit-as-you-go" workflow (installed)

Both MCP servers are installed and registered in **`.mcp.json`** (project-scoped, committed):

| Server | Command | Purpose | Key tools |
|--------|---------|---------|-----------|
| **svelte** (official) | `npx -y @sveltejs/mcp` | Authoritative Svelte 5 / SvelteKit docs + idiomatic-code linting | `list-sections`, `get-documentation`, `svelte-autofixer`, `playground-link` |
| **rust** (`Vaiz/rust-mcp-server` v0.3.8, `cargo install`ed to `~/.cargo/bin`) | `rust-mcp-server` | Run idiomatic Rust gates as tools | wraps `cargo clippy`, `cargo fmt`, `cargo check`, `cargo test`, `cargo doc`, `cargo-hack` |

**Definition of Done (per file / per PR) — enforced via MCP, non-negotiable:**

- **Every Svelte component / `.svelte.ts` module** → pass `svelte-autofixer` (zero suggestions) before it is considered done; consult `get-documentation` whenever an API is uncertain rather than guessing.
- **Every Rust crate change** → `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo check`, `cargo test` all green via the rust MCP server; `cargo-hack` for feature-matrix crates.
- These mirror the CI gates already in `.github/workflows/ci-cd.yml` (`cargo clippy -D warnings`, `cargo fmt --check`, `sv check`).

---

## 3. Target architecture

```
                         ┌──────────────────────────────────────────┐
  Browser ──── HTTPS ───▶│  SvelteKit (adapter-node, SSR + BFF)      │
                         │  • hooks.server.ts → cookie session auth  │
                         │  • +page.server.ts load / form actions    │
                         │  • room page: ssr=false (WebRTC, browser)  │
                         └───────────────┬───────────────┬──────────┘
                            REST (server-side fetch)   WS (browser → signaling)
                                         │               │
                         ┌───────────────▼───────┐   ┌───▼─────────────────────┐
                         │  Rust API (Axum/Tokio) │   │ signaling-rs (existing) │
                         │  sqlx → Postgres       │   │  → sfu/ (mediasoup)     │
                         │  redis, async-stripe,  │   └─────────────────────────┘
                         │  aws-sdk-s3 (R2), apalis│
                         └───────────┬────────────┘
                            shared Postgres (Neon) + Redis  ← same DB during cutover
```

Key decisions:
- **SvelteKit is a BFF**: tokens live in **httpOnly cookies**, never in client JS (security upgrade over the current `localStorage` token in React). Browser → SvelteKit server → Rust API.
- **Same database** is used by Laravel and Rust simultaneously during cutover (sqlx maps the existing schema), enabling per-endpoint strangler migration with zero data migration.
- The **WebSocket signaling path is unchanged** — the browser still talks directly to `signaling-rs`; only the control-plane HTTP caller (Laravel `SignalingService`) is reimplemented in the Rust API.

---

## 4. Frontend track — React → Svelte 5 / SvelteKit

### 4.1 Idiomatic choices (verified against the Svelte MCP docs)

| Concern | React (today) | Svelte 5 / SvelteKit target | Notes |
|---|---|---|---|
| Rendering/adapter | Vite SPA | **`@sveltejs/adapter-node`, SSR on**; `export const ssr = false` only on the live-room page | Enables server auth + SEO; room stays client-only for WebRTC |
| Routing | react-router-dom v7 | File-based routes (`+page.svelte`, `+layout.svelte`) | `kit/routing`, `kit/advanced-routing` |
| Auth guard | `ProtectedRoute` + localStorage | `hooks.server.ts` populates `event.locals.user`; `+layout.server.ts` guards | `kit/hooks`, `kit/auth` |
| State | Zustand | **Svelte 5 runes** (`$state`/`$derived`/`$effect`) in `.svelte.ts`; `SvelteMap` for participants; **`setContext` for any request-scoped state** (avoid module-level mutable state — SSR leakage) | `kit/state-management` (explicit SSR warning), room store already ported |
| Data fetching | @tanstack/react-query | `load` (`+page.ts` / `+page.server.ts`) + `invalidate`/`depends` | `kit/load` |
| Mutations/forms | react-hook-form + zod | **Form actions + `use:enhance`**, zod validation server-side | `kit/form-actions`, progressive enhancement |
| (Optional, later) | — | Experimental **remote functions** (`.remote.ts`, since SvelteKit 2.27) | **Not adopted initially** — still experimental per MCP docs; revisit once stable |
| Headless UI | @radix-ui/react-* | **bits-ui** (Svelte headless) + Tailwind; Toast via `melt`/bits | Closest Radix-equivalent for Svelte |
| Icons | lucide-react | **lucide-svelte** | same icon set |
| Utils | clsx, tailwind-merge, date-fns, zod | **unchanged** (framework-agnostic) | reuse as-is |
| WebRTC | `useWebRTC.ts` (1050 LOC), `useSignaling.ts` (390 LOC) | extend existing `frontend-svelte/src/lib/{signaling,media-client}.ts` classes, driven by runes + `$effect`; **fix the 500ms `setTimeout` race** (audit Phase-0 bug — wait for the `authenticated` event) | hardest piece; classes already isolated |
| Styling | Tailwind v4 + custom theme | Tailwind v4 via `@tailwindcss/vite` (already wired) | port `tailwind.config.js` theme tokens |
| Testing | Vitest | Vitest (`vitest-browser-svelte`) + **Playwright** e2e + `sv check` | `cli/vitest`, `cli/playwright` |

### 4.2 Frontend phases (each phase ends green on `sv check` + `svelte-autofixer` + Playwright smoke)

- **F0 — Foundation:** upgrade `frontend-svelte` to `adapter-node`; add `hooks.server.ts` (session cookie → `locals.user`), `app.d.ts` locals typing, Tailwind theme port, `lib/api` BFF client (server-side `fetch` to Rust API with cookie token), bits-ui + lucide-svelte. Establish auth `.svelte.ts` store via context.
- **F1 — Auth & shell:** `/login`, `/register`, `/forgot-password` (form actions + zod); `DashboardLayout`/`AuthLayout`/`RoomLayout` as `+layout.svelte`; nav, toasts, error boundary (`<svelte:boundary>`), 404/403 pages.
- **F2 — Rooms & live (critical path):** rooms list/detail/create (`load` + actions); finish the **live room** page + `VideoTile`/`VideoGrid`/`RoomControls`/`ParticipantList`/`ChatPanel`; wire `signaling.ts`/`media-client.ts` via runes; port E2EE; fix the join race bug.
- **F3 — Settings, billing, admin:** profile/org/billing settings; admin dashboard/users/analytics (lazy-load the chart component); file uploader + rich-text editor equivalents.
- **F4 — Cutover & decommission React:** route production traffic to SvelteKit; remove `frontend/`; update `infrastructure/docker/Dockerfile.frontend`, compose, CI matrix, README to the SvelteKit build.

---

## 5. Backend track — Laravel → Rust (Axum + Tokio + sqlx)

### 5.1 Crate selection (idiomatic, latest stable; reuse signaling-rs choices where they exist)

| Concern | Crate(s) | Rationale |
|---|---|---|
| HTTP framework | **axum 0.8** + **tower** / **tower-http** (cors, trace, compression, timeout, request-id, limit), **axum-extra** (cookies, typed headers) | matches `signaling-rs`; mature, Tokio-native |
| Async runtime | **tokio 1** (full) | reuse |
| Database | **sqlx 0.9** (Postgres, `query!`/`query_as!` compile-time checked), `PgPool`, **sqlx-cli** migrations | requested; compile-time SQL safety; maps existing schema, no data migration |
| Types | **uuid 1** (v4, serde), **chrono 0.4** (serde), **serde_json** | schema uses UUID PKs + JSONB + timestamptz |
| Password hashing | **argon2** (+ **bcrypt** verify shim for legacy hashes; re-hash on login) | L7 upgrade; preserves existing Laravel bcrypt logins during transition |
| API tokens (Sanctum parity) | hand-rolled: 64-char random (`rand`), store SHA-256 (`sha2`) of token; custom `FromRequestParts` extractor | bit-for-bit compatible with `personal_access_tokens` |
| Signaling JWT | **jsonwebtoken 10** (HS256) | reuse `signaling-rs/src/services/auth.rs` verbatim pattern |
| Billing | **async-stripe** | Checkout sessions, Billing Portal, **webhook signature verification**; replaces Cashier (hand-roll the subscription state machine) |
| Background jobs | **apalis** (Redis/Postgres backend) | replaces Horizon — recordings status, email, Stripe webhook retries, audit fan-out |
| Cache / Redis | **redis 1** (tokio-comp) | reuse signaling-rs choice; participant cache (5s TTL), plans, sessions |
| Object storage (R2) | **aws-sdk-s3** with custom endpoint | R2 is S3-compatible; presigned upload/download URLs |
| Config | typed `Config` struct via **figment** (env + file) or reuse signaling-rs `dotenvy` pattern | one validated config, fail-fast on missing secrets |
| Errors | **thiserror** (domain) + an `AppError: IntoResponse` mapping to **RFC 7807 problem+json** | clean error taxonomy, consistent API errors |
| Validation | **garde** (or `validator`) | replaces Laravel FormRequests |
| Observability | **tracing** + **tracing-subscriber** (json) + `tower-http::trace` + **tracing-opentelemetry** (OTLP → existing Jaeger) + **metrics** + **metrics-exporter-prometheus** (`/metrics` parity) | matches `IMPLEMENTATION_CHECKLIST.md` observability bar |
| Testing | `#[sqlx::test]` (isolated test DB), `tokio::test`, **reqwest** integration tests, **testcontainers** (Postgres/Redis) in CI | high-confidence, hermetic |

### 5.2 Crate/workspace layout (clean architecture, small focused crates)

```
backend-rs/                      # new Cargo workspace
├── Cargo.toml                   # [workspace] members
├── crates/
│   ├── domain/                  # pure types, enums, business rules (no I/O)
│   ├── db/                      # sqlx repositories, migrations/, FromRow structs
│   ├── auth/                    # token issuance/verification, password hashing, extractors
│   ├── billing/                 # async-stripe wrappers, webhook handling, subscription FSM
│   ├── jobs/                    # apalis workers (recordings, email, audit, webhooks)
│   └── api/                     # axum bin: routers, handlers, middleware, error mapping, main.rs
└── migrations/                  # sqlx migrations (seeded from docs/migrations + existing schema)
```
- Mirror the **11 domains / ~50 endpoints** from the backend audit (auth, billing, rooms, workspaces, chat, alerts, files, analytics, health/metrics, Stripe webhook, signaling control-plane).
- Map the **17 tables** to `FromRow` structs; DB enums (`room_status`, `participant_role`, …) → Rust enums with `sqlx::Type`.
- Reuse `signaling-rs` patterns: `Arc`-shared `AppState { pg: PgPool, redis, config, http }`, graceful shutdown (`tokio::signal` SIGTERM/Ctrl-C), structured `tracing`.

### 5.3 Backend phases (each ends green on the rust-MCP gate: fmt + clippy -Dwarnings + check + test)

- **B0 — Workspace bootstrap:** `backend-rs` workspace, `AppState`, config, tracing/OTel, error type, health/metrics endpoints, `sqlx` pool + migrations validated against the live Neon schema, CI job.
- **B1 — Auth & users:** register/login/logout/me/profile; Sanctum-compatible token store; argon2 + bcrypt-legacy shim; auth extractor middleware. **Shadow-test** against Laravel for response parity.
- **B2 — Rooms & signaling control-plane:** room CRUD + lifecycle (start/end/join/leave/moderate/recordings); reimplement `SignalingService` (allocate/close/remove/mute, JWT mint) calling `signaling-rs`; participant Redis cache; policies/authorization; domain events → `apalis`.
- **B3 — Workspaces, chat, alerts, files, analytics:** remaining CRUD; R2 via `aws-sdk-s3` (presigned URLs); analytics aggregation queries.
- **B4 — Billing:** `async-stripe` Checkout + Portal; **webhook signature verification + subscription state machine** (`checkout.session.completed`, `customer.subscription.updated|deleted`); plan-limit enforcement parity.
- **B5 — Hardening:** rate limiting (`tower_governor`), circuit-breaker/retry to SFU, load test to the `IMPLEMENTATION_CHECKLIST.md` targets (API P99 <100ms, 10k concurrent), cache-hit verification.

---

## 6. Cutover strategy (strangler-fig, zero-downtime)

1. Run the Rust API **alongside** Laravel, both pointed at the **same Postgres + Redis**.
2. nginx routes **per endpoint group** to Rust as each domain reaches parity (start with `/health` + `/v1/auth`, then rooms, etc.), Laravel serves the rest.
3. For each group: **shadow traffic + response diffing** in staging → flip in production → monitor error rate/latency → keep Laravel as instant rollback for one release.
4. When all groups are on Rust: decommission `backend/`, remove its Docker/compose/CI entries, and retire Laravel-specific tables (`jobs`, `cache`, `sessions`) replaced by `apalis`/redis.
5. Frontend cutover (F4) and backend cutover are **independent** — SvelteKit can ship against Laravel first, then re-point its BFF base URL to the Rust API per-domain.

---

## 7. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Audit advises against Laravel→Rust (effort vs payoff) | High | Strangler migration, per-domain shipping; frontend value-delivers independently; revisit ROI after B2 |
| Stripe in Rust is less batteries-included than Cashier | High | Encapsulate in `billing` crate; exhaustive webhook tests with Stripe fixtures; keep Laravel billing live until B4 fully verified |
| Password-hash compatibility (bcrypt → argon2) | Med | Verify-bcrypt-then-rehash-argon2 on login; never invalidate existing sessions |
| WebRTC room is the hardest port + has a known join race bug | Med | Reuse already-isolated TS classes; fix the 500ms `setTimeout` (wait for `authenticated`); Playwright + manual `chrome://webrtc-internals` verification |
| SSR state leakage across requests | Med | `setContext`/`load`-scoped state only; no module-level mutable state (per MCP `state-management` guidance) |
| Remote functions still experimental | Low | Use stable `load` + form actions; adopt remote functions only after they stabilize |
| sqlx compile-time queries need DB at build | Low | `cargo sqlx prepare` offline mode + checked-in `.sqlx/` cache for CI |

---

## 8. Verification (end-to-end)

- **Frontend:** `sv check` (types + a11y) clean; `svelte-autofixer` clean on every component; Vitest unit; **Playwright** e2e covering login → create room → go live → second participant joins → chat/screenshare → leave; Lighthouse ≥ 90.
- **Backend:** rust-MCP gate green (`fmt`/`clippy -Dwarnings`/`check`/`test`); `#[sqlx::test]` + `testcontainers` integration suite; **contract parity** harness diffing Rust vs Laravel JSON for every endpoint on identical inputs; k6/Gatling load test to P99 targets; Stripe webhook replay tests.
- **System:** run `docker-compose` stack; smoke the full join-to-first-frame flow; confirm `/metrics` + Jaeger traces present (observability parity with `IMPLEMENTATION_CHECKLIST.md`).

---

## 9. Immediate next steps (on approval)

1. **F0 + B0 in parallel** (independent): SvelteKit `adapter-node` foundation; `backend-rs` workspace bootstrap with health/metrics + sqlx wired to the existing schema. Both land behind feature routing, nothing user-facing breaks.
2. Stand up the **contract-parity test harness** early (it de-risks every later backend phase).
3. Land the Phase-0 **WebRTC join-race fix** during F2 (also benefits the current React app if backported).

---

### Appendix A — source audits
This plan is derived from three code audits performed for it: the React-frontend inventory (16 routes, hooks, stores), the Laravel-backend inventory (11 domains / ~50 endpoints / 17 tables / Sanctum / Cashier / R2), and the docs/architecture review (`README.md`, `docs/ARCHITECTURE.md`, `docs/TECH_STACK_AUDIT.md`, `docs/DATABASE_SCHEMA.md`, `DEPLOYMENT_GUIDE.md`, `IMPLEMENTATION_CHECKLIST.md`, `stack.md`). The existing `signaling-rs/` service is the reference implementation for all backend Rust idioms.
