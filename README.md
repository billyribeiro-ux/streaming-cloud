# Trading Room SaaS Platform

Enterprise-grade, multi-tenant Trading Room SaaS with ultra-low latency WebRTC streaming powered by Mediasoup SFU cluster architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRADING ROOM SAAS PLATFORM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐  │
│   │  React   │────▶│  Signaling   │────▶│  Mediasoup  │────▶│  TURN    │  │
│   │ Frontend │     │   Server     │     │  SFU Cluster│     │  Server  │  │
│   └──────────┘     └──────────────┘     └─────────────┘     └──────────┘  │
│        │                  │                    │                           │
│        │                  │                    │                           │
│        ▼                  ▼                    ▼                           │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │                       Supabase (Auth + Realtime + DB)            │    │
│   └──────────────────────────────────────────────────────────────────┘    │
│        │                                                                   │
│        ▼                                                                   │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│   │  Laravel 12  │────▶│    Redis     │────▶│ Cloudflare   │             │
│   │  SaaS API    │     │    Cache     │     │  R2 Storage  │             │
│   └──────────────┘     └──────────────┘     └──────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Backend - Core SaaS
- **Laravel 12** (PHP 8.3) - Core SaaS API
- **Laravel Cashier** - Stripe Billing integration
- **Laravel Sanctum** - API authentication
- **Laravel Horizon** - Queue management
- **PostgreSQL** via Supabase
- **Redis** - Caching and queues

### Realtime & Media
- **Node.js 20+** with TypeScript
- **Mediasoup v3** - SFU (Selective Forwarding Unit)
- **WebRTC** - Real-time media streaming
- **Coturn** - TURN/STUN server

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Zustand** - State management
- **mediasoup-client** - WebRTC client

### Infrastructure
- **Hetzner Cloud** - Primary hosting
- **Cloudflare** - CDN, DNS, WAF
- **Cloudflare R2** - Object storage
- **Docker** - Containerization
- **GitHub Actions** - CI/CD

## Project Structure

```
streaming-cloud/
├── backend/                    # Laravel 12 SaaS API
│   ├── app/
│   │   ├── Http/Controllers/   # API Controllers
│   │   ├── Models/             # Eloquent Models
│   │   ├── Services/           # Business Logic
│   │   ├── Jobs/               # Queue Jobs
│   │   └── Policies/           # Authorization
│   ├── config/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── routes/
│
├── signaling/                  # Node.js Signaling Server
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── services/
│       │   ├── SignalingServer.ts
│       │   ├── RoomManager.ts
│       │   └── AuthService.ts
│       └── types/
│
├── sfu/                        # Mediasoup SFU Cluster
│   └── src/
│       ├── workers/
│       │   └── WorkerManager.ts
│       ├── routers/
│       │   └── RouterManager.ts
│       └── transports/
│
├── frontend/                   # React Frontend
│   └── src/
│       ├── components/
│       │   ├── room/
│       │   ├── dashboard/
│       │   └── ui/
│       ├── hooks/
│       │   └── useWebRTC.ts
│       ├── stores/
│       │   └── roomStore.ts
│       └── services/
│
├── infrastructure/             # DevOps & Infrastructure
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   └── Dockerfile.*
│   ├── terraform/
│   └── scripts/
│
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md
│   └── DATABASE_SCHEMA.md
│
└── .github/
    └── workflows/
        └── ci-cd.yml
```

## Features

### Multi-Tenant Architecture
- Organizations (tenants) with isolated data
- Workspaces for team organization
- Row-Level Security (RLS) via Supabase
- Role-based access control (Owner, Admin, Host, Co-Host, Moderator, Viewer)

### WebRTC Streaming
- Ultra-low latency video/audio streaming
- Simulcast for adaptive quality
- Screen sharing support
- Multiple concurrent rooms per organization

### SaaS Features
- Stripe subscription billing
- Multiple pricing tiers (Starter, Professional, Business, Enterprise)
- Usage-based limits enforcement
- API access for integrations

### Room Features
- Real-time chat (Supabase Realtime)
- Trading alerts and announcements
- File uploads (Cloudflare R2)
- Participant management
- Recording support (Business+ plans)

## Subscription Plans

| Feature | Starter | Professional | Business | Enterprise |
|---------|---------|--------------|----------|------------|
| Price | $49/mo | $149/mo | $449/mo | Custom |
| Workspaces | 1 | 3 | 10 | Unlimited |
| Rooms | 3 | 10 | 50 | Unlimited |
| Hosts | 1 | 3 | 10 | Unlimited |
| Viewers/Room | 50 | 200 | 1,000 | Unlimited |
| Storage | 5GB | 25GB | 100GB | 1TB |
| Recording | - | ✓ | ✓ | ✓ |
| SSO | - | - | ✓ | ✓ |
| API Access | - | ✓ | ✓ | ✓ |

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- PHP 8.3+
- Supabase account
- Stripe account
- Cloudflare account (for R2)

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/your-org/streaming-cloud.git
cd streaming-cloud
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Configure environment variables (see `.env.example` for all options)

4. Start services with Docker:
```bash
cd infrastructure/docker
docker compose up -d
```

### Development

#### Backend (Laravel)
```bash
cd backend
composer install
php artisan migrate
php artisan serve
```

#### Signaling Server
```bash
cd signaling
npm install
npm run dev
```

#### SFU Node
```bash
cd sfu
npm install
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Documentation

### Authentication
All API requests require authentication via Supabase JWT token:
```
Authorization: Bearer <supabase-jwt-token>
```

### Key Endpoints

#### Organizations
- `GET /api/v1/organizations` - List user's organizations
- `POST /api/v1/organizations` - Create organization
- `GET /api/v1/organizations/{id}` - Get organization details

#### Rooms
- `GET /api/v1/organizations/{org}/rooms` - List rooms
- `POST /api/v1/organizations/{org}/rooms` - Create room
- `POST /api/v1/organizations/{org}/rooms/{room}/start` - Start stream
- `POST /api/v1/organizations/{org}/rooms/{room}/join` - Join room
- `POST /api/v1/organizations/{org}/rooms/{room}/end` - End stream

#### Subscriptions
- `GET /api/v1/subscriptions/plans` - List available plans
- `POST /api/v1/subscriptions` - Create subscription
- `POST /api/v1/subscriptions/portal` - Get billing portal URL

## Deployment

### Production Deployment (Hetzner)

1. Provision servers:
   - CPX41 (8 vCPU, 16GB) - SFU Server
   - CX22 (2 vCPU, 4GB) - Signaling, API, TURN

2. Configure DNS in Cloudflare:
   - `tradingroom.io` → Frontend
   - `api.tradingroom.io` → Laravel API
   - `signaling.tradingroom.io` → Signaling Server
   - `sfu-*.tradingroom.io` → SFU Nodes
   - `turn.tradingroom.io` → TURN Server

3. Deploy via GitHub Actions (automatic on push to `main`)

### Scaling

- **Horizontal**: Add more SFU nodes for increased capacity
- **Load Balancing**: AWS ALB or Hetzner Load Balancer
- **Redis Cluster**: For high-availability caching
- **Read Replicas**: Supabase supports read replicas for scale

## Monitoring

### Health Endpoints
- `GET /health` - All services expose health checks
- Prometheus metrics available at `/metrics`

### Logging
- Structured JSON logging
- Aggregation via Loki/Grafana
- Error tracking via Sentry

### Key Metrics
- WebRTC: RTT, packet loss, jitter, bitrate
- Business: Active rooms, concurrent viewers, stream hours
- Infrastructure: CPU, memory, network

## Security

- TLS 1.3 for all connections
- DTLS/SRTP for WebRTC media encryption
- JWT authentication via Supabase
- Row-Level Security for data isolation
- Rate limiting on all endpoints
- Input validation and sanitization

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Proprietary - All rights reserved.

## Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@tradingroom.io
