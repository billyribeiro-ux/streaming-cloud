# Technology Stack

> **Snapshot date:** June 4, 2026
> Every package, library, and dependency below is pinned to its **latest stable release as of June 4, 2026**.
> **The only deliberately fixed runtime is Node.js, locked to `24.16.0`** (the latest Node release) across every service, Dockerfile, CI job, and `engines` field — no exceptions.

---

## Runtimes & Languages

| Runtime / Language | Version | Notes |
|--------------------|---------|-------|
| Node.js            | **24.16.0** | Pinned everywhere (Dockerfiles, CI `node-version`, `engines`) |
| PHP                | **8.5** | Backend runtime (`php:8.5-fpm-alpine`, CI `php-version: 8.5`) |
| Rust               | stable (1.94+) | `signaling-rs` (edition 2021) |
| TypeScript         | **6.0.3** | All Node/Svelte services |

---

## Backend — Laravel SaaS API (`backend/`) — ⛔ DECOMMISSIONED

> Replaced by the Rust API (`backend-rs/`, see below). Retained here only as a
> record of the original dependency pinning. The `backend/` directory has been
> removed.

PHP **^8.5** · Laravel **13**

### Runtime dependencies (composer.json)
| Package | Constraint |
|---------|------------|
| laravel/framework | ^13.13 |
| laravel/sanctum | ^4.3 |
| laravel/cashier | ^16.5 |
| laravel/horizon | ^5.47 |
| laravel/scout | ^11.2 |
| laravel/telescope | ^5.20 |
| guzzlehttp/guzzle | ^7.11 |
| aws/aws-sdk-php | ^3.384 |
| predis/predis | ^3.5 |
| firebase/php-jwt | ^7.0 |
| spatie/laravel-permission | ^8.0 |
| spatie/laravel-activitylog | ^5.0 |
| spatie/laravel-data | ^4.23 |
| spatie/laravel-query-builder | ^7.3 |
| league/flysystem-aws-s3-v3 | ^3.34 |
| lorisleiva/laravel-actions | ^2.10 |

### Dev dependencies
| Package | Constraint |
|---------|------------|
| fakerphp/faker | ^1.24 |
| laravel/pint | ^1.29 |
| laravel/sail | ^1.62 |
| mockery/mockery | ^1.6 |
| nunomaduro/collision | ^8.9 |
| phpunit/phpunit | ^13.1 |
| larastan/larastan | ^3.10 |
| pestphp/pest | ^4.7 |
| pestphp/pest-plugin-laravel | ^4.1 |

---

## React Frontend (`frontend/`) — ⛔ DECOMMISSIONED

> Replaced by the SvelteKit frontend (`frontend-svelte/`, below). Retained here
> only as a record of the original dependency pinning. The `frontend/` directory
> has been removed.

Node **24.16.0** · React **19** · Vite **8** · TypeScript **6**

### Dependencies
| Package | Constraint |
|---------|------------|
| react | ^19.2.7 |
| react-dom | ^19.2.7 |
| react-router-dom | ^7.16.0 |
| @supabase/supabase-js | ^2.107.0 |
| mediasoup-client | ^3.20.0 |
| zustand | ^5.0.14 |
| @tanstack/react-query | ^5.101.0 |
| @radix-ui/react-dialog | ^1.1.15 |
| @radix-ui/react-dropdown-menu | ^2.1.16 |
| @radix-ui/react-avatar | ^1.1.11 |
| @radix-ui/react-tooltip | ^1.2.8 |
| @radix-ui/react-switch | ^1.2.6 |
| @radix-ui/react-slider | ^1.3.6 |
| @radix-ui/react-tabs | ^1.1.13 |
| @radix-ui/react-toast | ^1.2.15 |
| class-variance-authority | ^0.7.1 |
| clsx | ^2.1.1 |
| tailwind-merge | ^3.6.0 |
| lucide-react | ^1.17.0 |
| date-fns | ^4.4.0 |
| zod | ^4.4.3 |
| react-hook-form | ^7.77.0 |
| @hookform/resolvers | ^5.4.0 |

### Dev dependencies
| Package | Constraint |
|---------|------------|
| @types/react | ^19.2.16 |
| @types/react-dom | ^19.2.3 |
| @typescript-eslint/eslint-plugin | ^8.60.1 |
| @typescript-eslint/parser | ^8.60.1 |
| @tailwindcss/forms | ^0.5.11 |
| @tailwindcss/typography | ^0.5.19 |
| @vitejs/plugin-react | ^6.0.2 |
| autoprefixer | ^10.5.0 |
| eslint | ^10.4.1 |
| eslint-plugin-react-hooks | ^7.1.1 |
| postcss | ^8.5.15 |
| tailwindcss | ^4.3.0 |
| typescript | ^6.0.3 |
| vite | ^8.0.16 |
| vitest | ^4.1.8 |
| @testing-library/react | ^16.3.2 |
| @testing-library/jest-dom | ^6.9.1 |

---

## Svelte Frontend (`frontend-svelte/`)

Node **24.16.0** · Svelte **5** · SvelteKit **2** · Vite **8** · TypeScript **6**

| Package | Constraint |
|---------|------------|
| mediasoup-client | ^3.20.0 |
| phosphor-svelte | ^3.1.0 (icons — bundled components, no external SVG fetch) |
| @sveltejs/adapter-static | ^3.0.10 |
| @sveltejs/kit | ^2.63.0 |
| @sveltejs/vite-plugin-svelte | ^7.1.2 |
| @tailwindcss/vite | ^4.3.0 |
| @types/node | ^25.9.1 |
| svelte | ^5.56.1 |
| svelte-check | ^4.6.0 |
| tailwindcss | ^4.3.0 |
| typescript | ^6.0.3 |
| vite | ^8.0.16 |

---

## Signaling Server — Node (`signaling/`)

Node **24.16.0** · `engines.node >=24.16.0`

### Dependencies
| Package | Constraint |
|---------|------------|
| ws | ^8.21.0 |
| pg | ^8.21.0 |
| jsonwebtoken | ^9.0.3 |
| mediasoup | ^3.20.2 |
| mediasoup-client | ^3.20.0 |
| uuid | ^14.0.0 |
| pino | ^10.3.1 |
| pino-pretty | ^13.1.3 |
| dotenv | ^17.4.2 |
| zod | ^4.4.3 |
| ioredis | ^5.11.1 |
| express | ^5.2.1 |
| helmet | ^8.2.0 |
| cors | ^2.8.6 |
| rate-limiter-flexible | ^11.1.0 |
| prom-client | ^15.1.3 |
| compression | ^1.8.1 |

### Dev dependencies
| Package | Constraint |
|---------|------------|
| @types/node | ^25.9.1 |
| @types/ws | ^8.18.1 |
| @types/pg | ^8.20.0 |
| @types/jsonwebtoken | ^9.0.10 |
| @types/express | ^5.0.6 |
| @types/cors | ^2.8.19 |
| typescript | ^6.0.3 |
| tsx | ^4.22.4 |
| vitest | ^4.1.8 |
| @vitest/coverage-v8 | ^4.1.8 |
| eslint | ^10.4.1 |
| @typescript-eslint/eslint-plugin | ^8.60.1 |
| @typescript-eslint/parser | ^8.60.1 |

---

## Signaling Server — Rust (`signaling-rs/`)

Rust edition 2021 · Axum **0.8**

| Crate | Version |
|-------|---------|
| axum | 0.8 (ws) |
| tokio | 1 (full) |
| tower-http | 0.6 (cors) |
| serde | 1 (derive) |
| serde_json | 1 |
| redis | 1 (tokio-comp, connection-manager) |
| jsonwebtoken | 10 |
| reqwest | 0.13 (json) |
| uuid | 1 (v4) |
| tracing | 0.1 |
| tracing-subscriber | 0.3 (env-filter, json) |
| dotenvy | 0.15 |
| dashmap | 6 |
| anyhow | 1 |
| thiserror | 2 |
| chrono | 0.4 (serde) |
| urlencoding | 2 |

---

## Mediasoup SFU (`sfu/`)

Node **24.16.0** · `engines.node >=24.16.0`

### Dependencies
| Package | Constraint |
|---------|------------|
| mediasoup | ^3.20.2 |
| express | ^5.2.1 |
| helmet | ^8.2.0 |
| cors | ^2.8.6 |
| pino | ^10.3.1 |
| pino-pretty | ^13.1.3 |
| dotenv | ^17.4.2 |
| uuid | ^14.0.0 |
| ioredis | ^5.11.1 |

### Dev dependencies
| Package | Constraint |
|---------|------------|
| @types/node | ^25.9.1 |
| @types/express | ^5.0.6 |
| @types/cors | ^2.8.19 |
| typescript | ^6.0.3 |
| tsx | ^4.22.4 |
| vitest | ^4.1.8 |
| eslint | ^10.4.1 |
| @typescript-eslint/eslint-plugin | ^8.60.1 |
| @typescript-eslint/parser | ^8.60.1 |

---

## Recording Service (`recorder/`)

Node **24.16.0** · `engines.node >=24.16.0`

### Dependencies
| Package | Constraint |
|---------|------------|
| express | ^5.2.1 |
| helmet | ^8.2.0 |
| cors | ^2.8.6 |
| pino | ^10.3.1 |
| pino-pretty | ^13.1.3 |
| dotenv | ^17.4.2 |
| uuid | ^14.0.0 |
| fluent-ffmpeg | ^2.1.3 |

### Dev dependencies
| Package | Constraint |
|---------|------------|
| @types/node | ^25.9.1 |
| @types/express | ^5.0.6 |
| @types/cors | ^2.8.19 |
| @types/fluent-ffmpeg | ^2.1.28 |
| typescript | ^6.0.3 |
| tsx | ^4.22.4 |
| vitest | ^4.1.8 |
| eslint | ^10.4.1 |
| @typescript-eslint/eslint-plugin | ^8.60.1 |
| @typescript-eslint/parser | ^8.60.1 |

---

## Backend API — Rust (`backend-rs/`) — Laravel rewrite

Axum + Tokio + sqlx Cargo workspace; the active rewrite of the Laravel API
(strangler migration). Full endpoint parity: auth, organizations, workspaces,
rooms (CRUD + lifecycle + signaling control-plane), chat, alerts, analytics,
billing (Stripe), files (R2), health, metrics.

| Crate | Version |
|-------|---------|
| axum | 0.8 |
| tokio | 1 (full) |
| tower-http | 0.6 (trace, cors, compression, timeout) |
| sqlx | 0.9 (postgres, tls-rustls, uuid, chrono, json) |
| serde / serde_json | 1 |
| uuid | 1 · chrono | 0.4 |
| argon2 | 0.5 (+ password-hash getrandom) · bcrypt | 0.19 (legacy verify) |
| jsonwebtoken | 10 · sha2 | 0.10 · hmac | 0.12 · rand | 0.9 |
| reqwest | 0.13 (json, form, rustls) — Stripe + SFU control-plane |
| garde | 0.23 (derive, email) — validation |
| thiserror | 2 · anyhow | 1 |
| tracing | 0.1 · tracing-subscriber | 0.3 · metrics-exporter-prometheus | 0.18 |
| dotenvy | 0.15 |

Notable L7 choices: Sanctum-compatible tokens; Argon2id with transparent
legacy-bcrypt rehash; a lean Stripe REST client + HMAC webhook verification
(no `async-stripe`); a KAT-tested SigV4 presigner for R2 (no `aws-sdk-s3`);
RFC 7807 problem+json errors; a router-conflict test; soft-cancel for rooms.

---

## Infrastructure — Docker Base Images

| Image | Tag | Used by |
|-------|-----|---------|
| node | **24.16.0-alpine** | frontend, signaling, recorder, **frontend-svelte** builds |
| node | **24.16.0-bookworm** / **24.16.0-bookworm-slim** | sfu (native mediasoup build) |
| rust | **1-bookworm** | **api-rs** build stage |
| debian | **bookworm-slim** | **api-rs** runtime |
| php | **8.5-fpm-alpine** | backend (Laravel, being decommissioned) |
| composer | **2** | backend build stage |
| nginx | **alpine** (1.31 mainline) | frontend serve, backend |
| postgres | **18-alpine** | CI test DB |
| redis | **8-alpine** | cache / queue / CI |
| jaegertracing/all-in-one | **1.76.0** | distributed tracing |
| coturn/coturn | **latest** | TURN/STUN |
| edoburu/pgbouncer | **latest** | connection pooling |

### Host / OS
| Item | Version |
|------|---------|
| Deployment OS | Ubuntu **24.04 LTS** |
| Managed Postgres (Neon) | **18** |

---

## CI/CD — GitHub Actions (`.github/workflows/ci-cd.yml`)

| Action | Version |
|--------|---------|
| actions/checkout | v6 |
| actions/setup-node | v6 (node 24.16.0) |
| actions/cache | v5 |
| shivammathur/setup-php | v2 (PHP 8.5) |
| codecov/codecov-action | v6 |
| docker/setup-buildx-action | v4 |
| docker/login-action | v4 |
| docker/metadata-action | v6 |
| docker/build-push-action | v7 |
| aquasecurity/trivy-action | 0.36.0 |
| github/codeql-action | v4 |
| webfactory/ssh-agent | v0.10.0 |
| slackapi/slack-github-action | v3.0.3 |
| dtolnay/rust-toolchain | stable |
| Swatinem/rust-cache | v2 |

---

## Notes on major upgrades

Several dependencies crossed major-version boundaries while pinning to the latest release. These may require code-level follow-up:

- **ESLint 8 → 10** — ESLint 9+ defaults to the flat config (`eslint.config.js`); the legacy `.eslintrc.cjs` may need migration.
- **TypeScript 5 → 6** — review for newly-enforced strictness / removed deprecated flags.
- **PHP 8.3 → 8.5** and **Laravel deps** (Cashier 15→16, Scout 10→11, predis 2→3, php-jwt 6→7, spatie permission 6→8, activitylog 4→5, query-builder 6→7, PHPUnit 11→13, Pest 3→4, Larastan 2→3) — run `composer update` + test suite.
- **Rust `redis` 0.29 → 1**, **`jsonwebtoken` 9 → 10**, **`reqwest` 0.12 → 0.13** — verify the async API surfaces still compile.
- **uuid 13 → 14** (Node) and **slack-github-action v1 → v3** (input format changed to `webhook` / `webhook-type`, already updated in the workflow).
