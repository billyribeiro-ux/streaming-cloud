# Trading Room Streaming Platform: Tech Stack Audit & Migration Plan

## Context

This platform is a private (NOT SaaS) real-time trading room app deployed on Hetzner Cloud. The goal: beat LiveKit Cloud on every dimension that matters for zero-latency voice and video across multiple simultaneous rooms. This is a Distinguished Principal Engineer-level audit with hard architectural calls.

**Date**: April 9, 2026

---

## Current Stack Audit

| Layer | Current | Assessment |
|---|---|---|
| Frontend | React 19 + Vite 8 + TailwindCSS + Zustand + mediasoup-client 3.18 | Adequate but not optimal for real-time video grid |
| Backend API | Laravel 12 (PHP 8.3) + Sanctum + Cashier + Horizon | Overkill for non-SaaS; not on latency path |
| Signaling | Node.js 22 + Express 5 + ws + TypeScript (2,500 LOC) | **Bottleneck** -- GC pauses, single-threaded event loop |
| SFU | Mediasoup 3.19 (C++ core, Node.js wrapper, 1,200 LOC) | **Excellent** -- 500 consumers/core, 2x faster than LiveKit |
| Database | PostgreSQL (Neon) + Redis + PgBouncer | Appropriate |
| TURN/STUN | Coturn | Standard, works |
| Storage | Cloudflare R2 | Good |
| CI/CD | GitHub Actions + Docker Compose | Needs Helm charts eventually |

### Critical Gaps vs LiveKit
- VP8-only codecs (no VP9/AV1/H.264)
- No DataChannels / SCTP
- No speaker detection (mediasoup has built-in AudioLevelObserver, just not wired)
- No E2E encryption
- No recording / egress
- No WHIP/WHEP ingress
- No SIP bridge
- No AI agent framework
- No distributed multi-node rooms
- No jitter buffer tuning or bandwidth estimation config
- Bespoke signaling protocol with no correlation IDs (race conditions under load)

---

## 6 Hard Architectural Decisions

### 1. KEEP Mediasoup -- Do NOT migrate SFU to Rust or LiveKit

**Rationale**: Mediasoup C++ core delivers 500 consumers/core vs LiveKit's ~100 video tracks/core (Go with GC). This 2x advantage is real and measured. The Rust SFU ecosystem (str0m: 538 stars, not production SFU; atm0s: interesting but adds mesh latency; webrtc-rs: v0.20 still in dev) is not battle-tested for a trading room where a crash during market hours is catastrophic.

**Action**: Upgrade mediasoup configuration to unlock VP9/AV1/H.264, SVC layers, DataChannels, and AudioLevelObserver. These are config/wiring changes, not rewrites.

### 2. MIGRATE React 19 --> Svelte 5 / SvelteKit (Phase 3)

**Rationale**: For a trading room with 50-200 video tiles, UI framework overhead directly impacts perceived latency:
- Svelte 5 runtime: 1.6KB vs React's 42KB (25x smaller)
- Svelte Runes: fine-grained reactivity compiles to surgical DOM updates -- a single participant's audio level change doesn't trigger reconciliation across the entire grid
- 65% smaller bundles, faster hydration, lower memory
- The current `useWebRTC.ts` (684 lines of useState/useCallback/useRef) becomes ~200 lines of Svelte stores + `$effect` runes
- The `VideoGrid.tsx` (358 lines with useMemo to avoid re-renders) becomes ~150 lines with automatic fine-grained updates

**Why Phase 3, not Phase 1**: SFU and signaling improvements deliver 10x more latency reduction than frontend framework. Do the hard infrastructure work first.

### 3. MIGRATE Node.js Signaling --> Rust (Axum + Tokio + tokio-tungstenite) (Phase 1)

**Rationale**: The signaling server is on the critical path for every WebRTC connection. A full media setup requires 6-8 signaling round-trips (auth, join, create-send-transport, connect-send-transport, produce, create-recv-transport, connect-recv-transport, consume). Node.js adds per-message overhead: JSON.parse -> async handler -> HTTP call to SFU -> JSON.stringify. Under load with 200 participants, GC pauses (2-15ms) and event loop saturation translate directly to join latency.

Rust eliminates GC entirely, handles WebSocket connections across multiple OS threads, and uses zero-copy message parsing. Conservative estimate: 5-15ms saved per round-trip = 40-120ms total setup reduction.

**Migration strategy**: Run both servers simultaneously, route 5% -> 25% -> 50% -> 100% of connections to Rust over 2 weeks. Zero downtime.

### 4. DO NOT migrate Laravel to Rust (for 12+ months)

**Rationale**: Laravel handles room CRUD, auth, billing, queues. None of these are on the latency-critical media path. The signaling server mediates all real-time operations. Laravel at 100ms P99 is perfectly fine for "create a room." The rewrite effort (Eloquent models, Stripe, middleware, queue system) is enormous with near-zero latency payoff.

### 5. Microservices, NOT single binary

**Rationale**: SFU nodes are CPU-bound (need beefy dedicated CPU hardware), signaling is connection-bound (needs many lightweight instances), API is request-response (standard web scaling). Single binary means a signaling bug takes down the SFU. Keep the service separation.

### 6. Strip SaaS features -- this is a private trading room

**Rationale**: The current codebase has multi-tenancy, subscription billing (4 tiers), organization/workspace hierarchy, and SaaS landing pages. None of this is needed. Simplify: one organization, flat room list, no billing UI. This reduces frontend complexity by ~40% and removes entire controller/model layers from Laravel.

---

## LiveKit Feature Parity Map

| LiveKit Feature | Priority | Implementation Approach |
|---|---|---|
| Simulcast + SVC codecs (VP9/AV1) | **P0** | Add codecs to mediasoup config, upgrade frontend simulcast encodings with `scalabilityMode` |
| Speaker detection | **P0** | Wire mediasoup's built-in `createAudioLevelObserver()` (~70 lines) |
| DataChannels (SCTP) | **P0** | Enable SCTP on transports (config flag + signaling protocol extension) |
| Protocol correlation IDs | **P0** | Add `id` field to all signaling messages, fix race conditions in `useWebRTC.ts` |
| JWT auth + permissions | **Done** | Already implemented via Sanctum + signaling JWT |
| E2E encryption | **P1** | Insertable Streams / Encoded Transform API + key exchange via DataChannels |
| Recording / Egress | **P1** | New Rust recorder service using GStreamer-rs, PlainRtpTransport from mediasoup |
| Webhooks | **P1** | Dispatch service on room events via Laravel Horizon queue |
| Horizontal scaling (multi-node) | **P1** | Mediasoup PipeTransports between nodes, signaling server orchestrates |
| Moderation APIs | **P1** | Extend existing mute/kick with ban, hand-raise |
| WHIP/WHEP | **P2** | WHIP POST endpoint on SFU creates WebRtcTransport, returns SDP answer |
| RPC between participants | **P2** | Request/response envelope over DataChannels |
| Client SDKs (mobile) | **P2** | Framework-agnostic signaling+media client libraries, Capacitor/WebView |
| Kubernetes | **P2** | Helm charts: StatefulSet for SFU, Deployment+HPA for signaling |
| SIP bridge | **P3** | FreeSWITCH + PlainRtpTransport (only if phone dial-in needed) |
| AI agents | **P3** | Rust agent service: DataChannel + audio consumer -> STT/LLM/TTS pipeline |

---

## Phased Migration Plan

### Phase 0: Foundation Hardening (Weeks 1-3) -- Zero Risk, High Impact

No rewrites. Purely additive changes to existing codebase.

**0.1 Upgrade mediasoup codecs**
- File: `sfu/src/config/mediasoup.ts`
- Add VP9 (SVC profile-id=2), H.264 (constrained-baseline + high), AV1
- Unlocks 30-50% bandwidth savings via VP9 SVC

**0.2 Enable DataChannels (SCTP)**
- Files: `sfu/src/routers/RouterManager.ts`, `signaling/src/services/RoomManager.ts`
- Enable `enableSctp` on transports, add data channel signaling messages

**0.3 Wire AudioLevelObserver for speaker detection**
- ~70 lines across WorkerManager/RouterManager + SignalingServer
- Broadcast active speaker to all participants

**0.4 Upgrade simulcast encodings**
- File: `frontend/src/hooks/useWebRTC.ts`
- 3-layer simulcast with `scalabilityMode: 'L1T3'` hints for VP9/AV1 SVC
- Proper rid assignments: q (150kbps/4x down), h (500kbps/2x down), f (1200kbps/full)

**0.5 Add protocol correlation IDs**
- File: `signaling/src/types/signaling.ts`
- Add `id` field to ClientMessage/ServerMessage, echo in responses
- Fix `waitForProducerId()` race condition in useWebRTC.ts

**0.6 Jitter buffer and audio tuning (QUICK WIN)**
- Configure Opus with FEC enabled, DTX for silence suppression
- Set `opusFec: true` in codec options for packet loss resilience
- Tune playout delay via mediasoup consumer `rtpParameters`
- Add `nackEnabled: true` for video to enable retransmission

**0.7 Bandwidth estimation tuning**
- Enable Transport-Wide Congestion Control (TWcc) on transports
- Configure `initialAvailableOutgoingBitrate` on WebRtcTransport (default 600kbps is too conservative for trading)
- Set to 1500kbps for faster ramp-up

**0.8 Real-time quality monitoring**
- Add consumer stats collection: RTT, packet loss, jitter, bitrate per consumer
- Expose `/metrics` endpoint with Prometheus counters for MOS score estimation
- Alert on packet loss >2% or jitter >30ms

### Phase 1: Rust Signaling Server (Weeks 4-10)

**1.1 New crate: `signaling-rs/`**
```
signaling-rs/
  Cargo.toml          # axum 0.8, tokio, tokio-tungstenite, serde, redis, sqlx, jsonwebtoken
  src/
    main.rs           # Axum app, graceful shutdown
    config.rs         # Env-based config
    ws/
      handler.rs      # WebSocket upgrade + connection lifecycle
      protocol.rs     # Serde types mirroring signaling.ts exactly
      session.rs      # Per-connection state
    services/
      auth.rs         # JWT verify + PG membership check (sqlx compile-time queries)
      room_manager.rs # In-memory room state + SFU HTTP proxy
      sfu_proxy.rs    # reqwest client to SFU nodes
      redis.rs        # Node registry, room-router mapping
      rate_limiter.rs # Token bucket per-IP/per-user
      speaker.rs      # Audio level distribution
    api/
      control.rs      # HTTP control API (called by Laravel)
```

**1.2 Protocol compatibility**: Exact same JSON wire format. `#[serde(tag = "event", content = "data")]` enums. Frontend works unchanged.

**1.3 Gradual cutover**: 5% -> 25% -> 50% -> 100% over 2 weeks with error rate monitoring.

### Phase 2: Recording, E2EE, Multi-Node (Weeks 11-18)

**2.1 Recording / Egress service** (`recorder-rs/`)
- GStreamer-rs pipeline consuming PlainRtpTransport from mediasoup
- Room composite mode: decode, composite, encode H.264/AAC, mux MP4, upload R2
- Track export mode: individual tracks without compositing
- Triggered via signaling server control API

**2.2 End-to-End Encryption**
- WebRTC Insertable Streams / Encoded Transform API
- SFrame encryption in browser, mediasoup forwards opaque payloads
- Key exchange via DataChannels, rotation on participant join/leave

**2.3 Pipe Transports for multi-node rooms**
- Mediasoup `createPipeTransport()` between routers on different nodes
- Signaling server orchestrates based on consumer count thresholds

**2.4 WHIP/WHEP ingress endpoint**
- `POST /api/rooms/:roomId/whip` on SFU, accepts SDP offer, returns answer
- Enables OBS, ffmpeg, hardware encoder publishing

### Phase 3: Svelte 5 Frontend (Weeks 19-26)

**3.1 Extract framework-agnostic libraries**
- `@tradingroom/signaling-client` -- WebSocket client, protocol types
- `@tradingroom/media-client` -- mediasoup-client Device/Transport/Producer/Consumer lifecycle

**3.2 New SvelteKit app** (`frontend-svelte/`)
- SvelteKit 2.x + Svelte 5 Runes + TailwindCSS 4
- Start with Room Live page (most performance-sensitive)
- Svelte stores replace Zustand, `$effect` replaces useCallback/useRef

**3.3 Page-by-page migration**, then decommission React frontend

### Phase 4: Advanced Features (Weeks 27-36)

- Webhooks dispatch service
- SIP bridge (FreeSWITCH) -- only if phone dial-in needed
- AI agent service (Rust, STT/LLM/TTS pipeline)
- Kubernetes Helm charts (StatefulSet for SFU, Deployment+HPA for signaling)

---

## Infrastructure Target State (Hetzner Cloud)

| Service | Server | Specs | Count | Why |
|---|---|---|---|---|
| SFU | **CCX33** | 8 dedicated vCPU, 32GB | 2 | Dedicated CPU eliminates jitter from noisy neighbors |
| Signaling (Rust) | CPX21 | 3 vCPU, 4GB | 2 | WebSocket connections, lightweight |
| Backend (Laravel) | CPX21 | 3 vCPU, 4GB | 1 | API, queues |
| TURN | CX22 | 2 vCPU, 4GB | 1 | NAT traversal |
| Redis | CX22 | 2 vCPU, 4GB | 1 | State coordination |
| Recorder | CPX31 | 4 vCPU, 8GB | on-demand | Recording pipeline |

**Critical change**: Upgrade SFU to **dedicated CPU** (CCX series). Mediasoup C++ workers need consistent CPU. Shared vCPU causes jitter spikes during contention. Non-negotiable for trading.

---

## What NOT To Do

1. **Do NOT rewrite the SFU in Rust** -- Mediasoup C++ is faster than anything you'll build
2. **Do NOT adopt LiveKit** -- you already outperform it 2x on media throughput
3. **Do NOT migrate Laravel to Rust** for at least 12 months -- not on hot path
4. **Do NOT build distributed mesh before you need it** -- start with 2 SFU nodes + pipe transports
5. **Do NOT add Kubernetes before Rust signaling is done** -- Docker Compose is fine for 2-5 servers
6. **Do NOT over-engineer for scale you don't have** -- one trading room, optimize for latency not throughput

---

## Verification Plan

### Phase 0 Verification
- Run mediasoup with VP9/AV1 codecs, verify browser negotiation in Chrome DevTools WebRTC internals (`chrome://webrtc-internals`)
- Test DataChannel send/receive between two clients
- Verify speaker detection broadcasts correct active speaker
- Measure simulcast layer switching time (<500ms target)
- Benchmark: 30 participants in a room, measure CPU, packet loss, jitter

### Phase 1 Verification
- Protocol compatibility: run the same frontend against Node.js and Rust signaling servers, verify identical behavior
- Load test: 500 concurrent WebSocket connections, measure P50/P95/P99 message latency
- Measure join-to-first-frame time: target <800ms (vs current ~1200ms estimated)
- Chaos test: kill Rust signaling server, verify clients reconnect to standby

### Phase 2 Verification
- Record a 5-minute multi-participant session, verify playback quality
- E2EE: verify SFU logs show encrypted (unreadable) payloads, clients decrypt correctly
- Multi-node: create a room spanning 2 SFU nodes, verify audio/video quality matches single-node

### Phase 3 Verification
- Svelte room page: measure Time-to-Interactive vs React version
- Video grid: 50 tiles rendering, measure frame rate and memory usage
- Lighthouse performance score target: >90

---

## Critical Files to Modify

| File | Phase | Change |
|---|---|---|
| `sfu/src/config/mediasoup.ts` | 0 | Add VP9/AV1/H.264 codecs, Opus FEC, bandwidth limits |
| `sfu/src/routers/RouterManager.ts` | 0, 2 | AudioLevelObserver, PipeTransport, WHIP, score forwarding |
| `sfu/src/workers/WorkerManager.ts` | 0 | Wire AudioLevelObserver per router |
| `signaling/src/types/signaling.ts` | 0 | Add correlation IDs, DataChannel messages |
| `signaling/src/services/SignalingServer.ts` | 0 | Speaker broadcast, DataChannel handling, score events |
| `signaling/src/services/RoomManager.ts` | 0, 2 | SCTP enable, Redis state backup, pipe transports |
| `signaling/src/utils/sfuHttp.ts` | 0 | Replace HTTP with Unix domain socket IPC |
| `frontend/src/hooks/useWebRTC.ts` | 0, 3 | Fix 500ms setTimeout, simulcast, ICE restart, reconnection |
| `frontend/src/hooks/useSignaling.ts` | 0 | Correlation ID support, event-based auth flow |
| New: `signaling-rs/` | 1 | Entire Rust signaling server |
| New: `recorder-rs/` | 2 | Recording/egress service |
| New: `frontend-svelte/` | 3 | SvelteKit replacement frontend |

---

## Second Principal Engineer Review: Critical Findings & Disagreements

A second independent review challenged key assumptions and found critical bugs and missing items. This section captures those findings for a complete picture.

### BUGS FOUND IN CURRENT CODEBASE

**BUG 1: 500ms hardcoded setTimeout race condition (CRITICAL)**
- File: `frontend/src/hooks/useWebRTC.ts` lines 353-370
- The join flow does `authenticate` then `setTimeout(500)` then `join-room`
- If auth takes >500ms (Neon under load), join fails silently
- If auth takes 50ms, you waste 450ms on EVERY room join
- Fix: wait for `authenticated` event before sending `join-room` (15-line fix)

**BUG 2: RTC port range too small (PRODUCTION FAILURE)**
- Config: `rtcMinPort: 10000, rtcMaxPort: 10100` = only 100 ports
- Each transport uses one UDP port. 50 participants x 2 transports = 100 ports = zero headroom
- Fix: expand to `rtcMinPort: 10000, rtcMaxPort: 59999` (1-line fix)

**BUG 3: No failover on SFU worker death**
- `WorkerManager.handleWorkerDeath` restarts the worker but ALL routers/transports/producers/consumers are LOST
- No client notification, no reconnection, no session migration
- Room state in `RoomManager` is in-memory only -- signaling restart loses everything

**BUG 4: `connectionQuality` always 'unknown'**
- The field exists in participant type but is never populated
- `RouterManager` listens to `producer.on('score')` and `consumer.on('score')` events but only logs at debug level -- never forwards to clients

### LATENCY DEEP-DIVE: Where Milliseconds Actually Live

End-to-end audio latency breakdown (same datacenter, no TURN):

| Component | Typical | Worst Case |
|-----------|---------|------------|
| Microphone capture + OS buffer | 10-20ms | 40ms |
| Opus encoding (20ms frame) | 20ms | 20ms |
| Client WebRTC packetization | 1-2ms | 5ms |
| Network: client to SFU | 5-30ms | 100ms+ |
| SFU forwarding (mediasoup C++) | 0.1-0.5ms | 1ms |
| Network: SFU to client | 5-30ms | 100ms+ |
| **Jitter buffer (receiver)** | **20-80ms** | **200ms** |
| Opus decoding | 1ms | 2ms |
| Audio playout + OS buffer | 10-20ms | 40ms |
| **TOTAL** | **72-203ms** | **408ms+** |

**Key insight**: The jitter buffer alone is 20-80ms and is fully tunable WITHOUT any rewrite. The signaling Rust rewrite saves 0ms on steady-state audio because signaling is only involved during connection setup, not media flow.

### SECOND OPINION: DISAGREEMENTS

| Decision | First Review | Second Review | Resolution |
|----------|-------------|---------------|------------|
| Keep Mediasoup | Yes | **Yes**, but 500/core is inflated; realistic is 200-250/core at 720p VP8 simulcast | Still 2x+ better than LiveKit. Keep. |
| React -> Svelte | Phase 3 | **Skip entirely**. Video `<video>` elements are browser-managed, not React-reconciled. 42KB runtime is irrelevant for hour-long trading sessions. | YOUR CALL -- if you want Svelte for DX/code simplicity, do it. For latency, it's negligible. |
| Node.js -> Rust signaling | Phase 1 | **Deprioritize**. Node.js 22 GC pauses are 1-4ms, not 40-120ms. Real bottleneck is HTTP round-trips to SFU, not the language. | **Compromise**: Do Phase 0 quick wins first. Replace signaling-to-SFU HTTP with Unix socket IPC (saves more than Rust rewrite). Then decide if Rust is still worth it. |
| Microservices | Yes | **Simplify** -- co-locate signaling + SFU on same host, use IPC not HTTP | Makes sense for trading room scale. Keep separate processes but same machine + Unix sockets. |

### 7 QUICK WINS (deploy today, no rewrites)

1. **Fix 500ms setTimeout** -- proper event-based auth-then-join (saves 200-450ms per join, 15 lines)
2. **Add H.264 codec** -- unblocks Safari/iOS (5 lines in mediasoup config)
3. **Expand RTC port range** to 10000-59999 (1 line, prevents production failure)
4. **Set `initialAvailableOutgoingBitrate: 600000`** on transports (1 line, prevents bandwidth saturation)
5. **Enable Opus FEC** -- add `useinbandfec: 1` to Opus params (1 line, dramatically better audio under packet loss)
6. **Forward producer/consumer scores to clients** -- enables connection quality monitoring (existing events, just not forwarded)
7. **Reduce ping interval** from 30s to 10s -- faster dead client detection (3 lines)

### THE "SHIP IN 2 WEEKS" PLAN

If we could only do 3 things to make this a production trading room:

**Days 1-4: Fix join flow + codecs**
- Fix 500ms setTimeout race condition
- Add H.264, VP9 codecs
- Expand RTC port range
- Set initialAvailableOutgoingBitrate
- Enable Opus FEC

**Days 5-10: Audio priority + quality monitoring**
- Audio-priority bandwidth allocation (never degrade audio for video)
- Adaptive simulcast layer selection (auto-downgrade video under congestion)
- Client-side jitterBufferTarget for audio (target: 20ms)
- Forward scores to clients, implement connection quality indicator
- Add maxIncomingBitrate per transport

**Days 11-14: Reconnection + failover**
- ICE restart on transport connectionstatechange === 'failed'
- Redis-backed room state (not just in-memory Maps)
- Client-side exponential backoff reconnection
- "Reconnecting..." UI state
- Server-sent room state snapshot for reconnecting clients

### TOP 3 RISKS

1. **Rust signaling rewrite takes 3x longer than estimated** and blocks all other progress. The integration surface (pg, Redis, JWT, WebSocket lifecycle, mediasoup HTTP API, rate limiting, tracing) is larger than it appears. Mitigation: do quick wins first, Rust last.

2. **No graceful degradation during high-load market moments**. When 50 traders talk simultaneously, video competes with audio, BWE oscillates, jitter buffers expand. Mitigation: implement audio-priority mode and "market event" mode that drops video to lowest simulcast layer.

3. **Single-point-of-failure signaling server**. In-memory room state (JavaScript Map) is lost on restart. `restoreRoomFromCluster` only reads router info from Redis, NOT participants/transports/producers/consumers. Mitigation: full Redis-backed room state + client-side reconnection.

---

## Research Sources

- [LiveKit SFU Documentation](https://docs.livekit.io/reference/internals/livekit-sfu/)
- [LiveKit GitHub - Go SFU v1.10.1](https://github.com/livekit/livekit)
- [LiveKit Benchmarking](https://docs.livekit.io/transport/self-hosting/benchmark/)
- [LiveKit Egress](https://docs.livekit.io/transport/media/ingress-egress/egress/)
- [LiveKit Ingress](https://docs.livekit.io/transport/media/ingress-egress/ingress/)
- [LiveKit Distributed Multi-Region](https://docs.livekit.io/transport/self-hosting/distributed/)
- [SvelteKit vs Next.js 16: 2026 Performance Benchmarks](https://www.devmorph.dev/blogs/sveltekit-vs-nextjs-16-performance-benchmarks-2026)
- [Svelte vs React: 7 Key Differences 2026](https://tech-insider.org/svelte-vs-react-2026/)
- [Rust Web Frameworks 2026: Axum vs Actix vs Rocket](https://aarambhdevhub.medium.com/rust-web-frameworks-in-2026-axum-vs-actix-web-vs-rocket-vs-warp-vs-salvo-which-one-should-you-2db3792c79a2)
- [Building High-Performance APIs with Axum and Rust (2026)](https://dasroot.net/posts/2026/04/building-high-performance-apis-axum-rust/)
- [str0m - Sans I/O WebRTC in Rust](https://github.com/algesten/str0m)
- [atm0s Media Server - Rust SFU](https://github.com/8xFF/atm0s-media-server)
- [webrtc-rs - Async WebRTC in Rust](https://github.com/webrtc-rs/webrtc)
- [WHIP RFC 9725](https://datatracker.ietf.org/doc/rfc9725/)
- [WHEP Draft](https://datatracker.ietf.org/doc/draft-ietf-wish-whep/)
- [LiveKit vs Mediasoup Performance Comparison](https://trembit.com/blog/choosing-the-right-sfu-janus-vs-mediasoup-vs-livekit-for-telemedicine-platforms/)
- [LiveKit Distributed Mesh Architecture](https://livekit.com/blog/scaling-webrtc-with-distributed-mesh/)
