# Media Infrastructure — Self-Hosted Realtime (Path A: Hetzner + coturn)

How to host the **live screenshare + voice** plane yourself for **true realtime,
no buffering** — sub‑~200 ms glass‑to‑glass. This is the LiveKit‑equivalent
layer; the repo already ships the SFU (`sfu/`, mediasoup), the signaling control
plane (`signaling-rs`/`signaling`), TURN config (`infrastructure/docker/coturn`),
and the egress recorder (`recorder/`). You are **not** paying a per‑minute WebRTC
SaaS — only flat infrastructure.

> **Why this is realtime:** media flows **browser → SFU → browsers over WebRTC
> (SRTP/UDP)** — the same path LiveKit/Zoom use. There is **no HLS/DASH/RTMP** on
> the live path (those add 2–30 s of buffering). HLS/recording is **egress only**
> and never sits between participants.

---

## 1. Providers to sign up for (Path A)

### Realtime / latency-critical (must self-host on low-latency infra)
| Service | Purpose | Sign up | Recommended |
|---|---|---|---|
| **Hetzner Cloud** — SFU host | mediasoup SFU (the media engine) | hetzner.com/cloud | **CCX** dedicated‑CPU (see §3) |
| **Hetzner Cloud** — TURN host | coturn NAT‑traversal fallback | same | CX22, or co‑locate on the SFU box |
| **Hetzner Cloud** — App host | Rust API + SvelteKit + signaling + Redis | same | CX32 / CPX31 |
| **Cloudflare** (free) | DNS, TLS origin certs, WAF for the web tier (**not** the media path) | cloudflare.com | Free plan |
| **Domain registrar** | hostnames | any | ~$10–15/yr |

> Pick the Hetzner **location closest to your audience** — latency is dominated by
> round‑trip to the SFU: `nbg1`/`fsn1`/`hel1` (EU), `ash` (US‑East), `hil`
> (US‑West), `sin` (Singapore). One region per audience; go multi‑region only for
> a global audience (§9).

### Non‑realtime (off the media path — can be anywhere)
These never touch live media, so latency is irrelevant. See
`SUBSCRIPTIONS_AND_TIERS.md` for full setup.
- **Neon** (Postgres), **Stripe** (billing), **Cloudflare R2** (file storage).
- **Optional managed TURN** instead of coturn: **Cloudflare Calls TURN** (cheapest/free‑ish) or **Metered.ca**.

---

## 2. Latency budget (target)

| Hop | Target |
|---|---|
| Capture + encode (browser) | 5–20 ms |
| Uplink RTT to SFU | 10–40 ms (region‑local) |
| SFU forward (mediasoup C++) | **0.1–1 ms** |
| Downlink to viewers | 10–40 ms |
| Jitter buffer + decode + paint | 30–80 ms |
| **Total glass‑to‑glass** | **~80–180 ms** (LAN/region), <250 ms cross‑region |

Everything below exists to protect this budget.

---

## 3. Server specs

| Role | Hetzner type | Specs | Notes |
|---|---|---|---|
| **SFU** | **CCX23/CCX33** (dedicated vCPU) | 4–8 dedicated vCPU, 16–32 GB | **Dedicated CPU is non‑negotiable** — shared vCPU causes jitter spikes during contention. ~200–500 video consumers/core. |
| **TURN** | CX22 (or on the SFU box) | 2 vCPU, 4 GB | Mostly bandwidth; only ~10–20 % of sessions relay. |
| **App** | CX32 / CPX31 | 4 vCPU, 8 GB | Rust API + SvelteKit + signaling + Redis (not latency‑critical). |

mediasoup runs **one worker per vCPU**; the container needs `--cap-add=SYS_NICE`
(already set in compose) so workers can raise scheduling priority.

---

## 4. Network, ports & firewall

Open on the **SFU host**:
| Port(s) | Proto | Purpose |
|---|---|---|
| `40000–49999` | **UDP** (primary) + TCP (fallback) | mediasoup RTC media (ICE) — see §6 for the recommended widened range |
| `4000` | TCP | SFU control-plane HTTP (internal/private only) |

Open on the **TURN host** (from `coturn/turnserver.conf`):
| Port(s) | Proto | Purpose |
|---|---|---|
| `3478` | UDP + TCP | STUN/TURN |
| `5349` | UDP + TCP | TURN over TLS (`turns:`) for restrictive networks |
| `49152–49200` | UDP | TURN relay range (widen for scale, see §7) |

Open on the **App host**: `80`, `443` (HTTP/WSS).

> **Critical for realtime:** the SFU must advertise its **public IP** in ICE
> candidates via `MEDIASOUP_ANNOUNCED_IP`. If it advertises `0.0.0.0`/a private
> IP, remote peers can't reach it directly and **fall back to TURN relay — adding
> a hop and latency**, or fail outright.

---

## 5. ✅ Config corrections (applied)

Two mismatches in the original compose/SFU config would have **broken direct
connectivity and forced TURN relay** (extra latency) or failed calls. **Both are
now fixed** in `infrastructure/docker/docker-compose.yml`:

1. **Env‑name mismatch (fixed).** `sfu/src/config/*.ts` reads
   `MEDIASOUP_ANNOUNCED_IP`, `MEDIASOUP_RTC_MIN_PORT`, `MEDIASOUP_RTC_MAX_PORT`,
   but the compose previously set `ANNOUNCED_IP`, `RTC_MIN_PORT`, `RTC_MAX_PORT`
   — so the SFU silently ignored them and fell back to defaults (no announced IP,
   ports 10000–59999). The compose vars are now renamed to the `MEDIASOUP_*`
   names. `sfu/.env.example` and `.env.example` were corrected too.
2. **Port range (fixed).** The range is now a single ~10k‑port window
   (`40000–49999`) for both the worker and the firewall.

**Applied fix (best latency): the SFU runs with host networking** on its
dedicated box — no Docker UDP NAT, no per‑port publish explosion, lowest latency:

```yaml
# infrastructure/docker/docker-compose.yml — sfu service (as shipped)
sfu:
  network_mode: host          # bind host ports directly (no Docker NAT)
  environment:
    - MEDIASOUP_ANNOUNCED_IP=${SFU_ANNOUNCED_IP}   # the host's PUBLIC IPv4
    - MEDIASOUP_RTC_MIN_PORT=40000
    - MEDIASOUP_RTC_MAX_PORT=49999
    # host networking → reach Redis via its host-published port:
    - REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379
```

> **Note on host networking:** the SFU no longer joins the Docker bridge, so
> `SFU_NODES` (used by signaling to reach the SFU control-plane) must point at the
> SFU host's reachable address (e.g. `sfu1.<domain>:4000`), not the bridge service
> name. On a single dev box, the host-published `4000` works. If you ever revert
> to bridge networking, publish the **exact same** UDP+TCP range you set in
> `MEDIASOUP_RTC_MIN/MAX_PORT`.

---

## 6. Realtime media tuning

**Transport**
- WebRTC SRTP over **UDP first**; TCP and TURN are fallbacks only.
- Keep TURN as **UDP relay** (`turns:`/TCP only for locked‑down networks) — TCP
  relay adds head‑of‑line blocking and latency.
- A **~10k‑port UDP range** (40000–49999) supports far more concurrent ICE
  connections than the current 101‑port window — widen it (§5).

**Codecs** (already configured in `sfu/src/config/mediasoup.ts`)
- **Voice:** Opus with **inband FEC** (packet‑loss resilience), **DTX**
  (silence suppression → less bandwidth/jitter), **20 ms ptime**. Wire
  `useinbandfec=1; usedtx=1` and `maxaveragebitrate≈32–64 kbps` on the producer.
- **Camera video:** VP9 **SVC** (preferred, 30–50 % savings) or VP8 **simulcast**;
  **H.264** included for Safari/iOS; **AV1** for capable clients.
- **Screenshare:** publish with `track.contentHint = 'detail'` (text/slides) or
  `'motion'` (video); use a **higher bitrate + lower frame rate** (e.g.
  1.5–4 Mbps, 5–15 fps for slides, 30 fps for motion) and **don't downscale**
  shared resolution. The live page already passes screenshare simulcast layers.

**Per‑viewer adaptation**
- Simulcast/SVC lets the SFU forward the **right layer per viewer** so one slow
  viewer never stalls others. Wire mediasoup `AudioLevelObserver` for active‑
  speaker (already recommended in the tech audit) and set consumer
  `preferredLayers` from the UI tile size.

**Low playout delay**
- Minimize the receiver jitter buffer for interactivity (set
  `playoutDelayHint`/`jitterBufferTarget` low on consumers); the jitter buffer is
  the single biggest tunable in the budget (§2).

**SFU host OS/NIC tuning** (`/etc/sysctl.d/99-webrtc.conf`)
```
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.netdev_max_backlog = 250000
net.ipv4.udp_mem = 262144 524288 1048576
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr   # for the WSS/API tier
fs.file-max = 1000000
```
Plus `ulimit -n 1000000` (compose already sets `nofile 65536` — raise for scale),
and pin mediasoup workers to cores on the dedicated box.

**Bandwidth math (capacity planning)**
- SFU **egress per room** ≈ Σ(consumer bitrates). Example: 1 host @ 2.5 Mbps to
  100 viewers ≈ **250 Mbps** down. A CCX box on a 1–10 Gbps NIC handles this
  comfortably; Hetzner egress (~€1/TB, ~20 TB incl.) makes it cheap. Budget
  ≈ host_bitrate × viewers; add ~30 % headroom.

---

## 7. TURN (coturn) specifics

From `infrastructure/docker/coturn/turnserver.conf`:
- **`use-auth-secret` + `static-auth-secret`** → time‑limited TURN REST
  credentials (the app mints short‑lived `username:credential` pairs; never ship
  static creds to browsers). Set `TURN_AUTH_SECRET`.
- **`external-ip=${TURN_EXTERNAL_IP}`** → the TURN host's public IP (same idea as
  `MEDIASOUP_ANNOUNCED_IP`).
- **`min-port`/`max-port`** (49152–49200) → widen for concurrency.
- **TLS** (`cert`/`pkey`, port 5349) → provision certs (Let's Encrypt) so
  `turns:` works behind corporate firewalls.
- Hand clients the ICE server list (`TURN_SERVER_URL/USERNAME/CREDENTIAL`) at
  join time alongside the signaling token.

> Don't want to run coturn? Point those env vars at **Cloudflare Calls TURN** or
> **Metered.ca** instead — TURN is the only piece comfortably outsourced without
> hurting the median (P2P‑to‑SFU) path.

---

## 8. DNS records

| Record | Points to | Purpose |
|---|---|---|
| `app.<domain>` | App host | SvelteKit frontend (443) |
| `api.<domain>` | App host | Rust API (443) |
| `signaling.<domain>` | App/SFU host | signaling **WSS** |
| `turn.<domain>` | TURN host | STUN/TURN (matches `realm`/`server-name`) |
| `sfu1.<domain>` | SFU host | (optional) per‑node addressing for multi‑node |

> Put the **web/API/WSS** tiers behind Cloudflare (TLS/WAF). Leave **media UDP
> (SFU/TURN) NOT proxied** (DNS‑only / grey‑cloud) — Cloudflare's proxy doesn't
> carry WebRTC UDP, and proxying would add latency.

---

## 9. Scaling (keep it realtime as you grow)

- **Vertical first:** bigger CCX = more consumers/core. Cheapest path to thousands
  of viewers per room.
- **Horizontal:** add SFU nodes; mediasoup **PipeTransport** bridges routers
  across nodes (the audit's Phase‑1 plan); `signaling-rs` allocates a room to a
  node and load‑balances. Set `SFU_NODES` / per‑node `SFU_NODE_ID`.
- **Multi‑region:** one SFU cluster per region; route each participant to the
  nearest node; pipe between regions only when a room spans them.

---

## 10. Pre‑flight checklist

- [ ] CCX (dedicated CPU) SFU host provisioned in the audience's region.
- [ ] `MEDIASOUP_ANNOUNCED_IP` = SFU public IPv4; **env names corrected** (§5).
- [ ] SFU UDP+TCP RTC range opened **and** matches `MEDIASOUP_RTC_MIN/MAX_PORT` (host networking recommended).
- [ ] coturn up with `external-ip`, `static-auth-secret`, TLS certs; 3478/5349 + relay range open.
- [ ] sysctl UDP buffers + BBR applied; `nofile` raised; workers = vCPUs.
- [ ] DNS: app/api/signaling/turn records; media UDP **not** Cloudflare‑proxied.
- [ ] TLS on app/api/signaling (Let's Encrypt) and TURN.
- [ ] Validate: open `chrome://webrtc-internals`, confirm **`candidate-pair` is `host`/`srflx` (not `relay`)**, RTT < ~50 ms region‑local, and no growing jitter.

---

_See `SUBSCRIPTIONS_AND_TIERS.md` for the non‑realtime services (Neon, Stripe, R2)
and the in‑app plan catalog. The realtime path described here is self‑hosted —
no per‑minute media vendor required._
