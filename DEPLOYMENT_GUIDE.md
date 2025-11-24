# Trading Room SaaS Platform
## Complete Deployment Guide

**Version**: 1.0.0
**Last Updated**: November 24, 2025
**Estimated Time**: 4-6 hours
**Difficulty**: Intermediate

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Service Signups & Configuration](#service-signups)
3. [Environment Variables Setup](#environment-setup)
4. [Local Development Setup](#local-development)
5. [Server Provisioning](#server-provisioning)
6. [Domain & SSL Configuration](#domain-ssl)
7. [Database Migration](#database-migration)
8. [Deployment Process](#deployment)
9. [Post-Deployment Verification](#verification)
10. [Monitoring & Maintenance](#monitoring)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Skills
- [ ] Basic command line/terminal usage
- [ ] Understanding of DNS configuration
- [ ] Basic knowledge of Docker
- [ ] Git/GitHub familiarity

### Required Tools
- [ ] Git installed locally
- [ ] SSH client (Terminal on Mac/Linux, PuTTY on Windows)
- [ ] Text editor (VS Code recommended)
- [ ] Web browser

### Estimated Costs (Monthly)
- **Hetzner Servers**: $52/month
- **Supabase**: $0 (Free tier) or $25/month (Pro)
- **Cloudflare R2**: ~$5-10/month (usage-based)
- **Domain Name**: $10-15/year
- **Stripe**: Transaction fees only (2.9% + $0.30)
- **Total Base Cost**: ~$60-90/month

---

## Service Signups & Configuration

### Step 1: GitHub Account Setup (5 minutes)

**Purpose**: Version control and CI/CD

1. **Sign up** (if you don't have an account):
   - Go to: https://github.com/signup
   - Enter email, create password
   - Verify email address

2. **Create Personal Access Token** (for CI/CD):
   ```
   Settings → Developer settings → Personal access tokens → Tokens (classic)
   → Generate new token (classic)
   ```
   - Name: `Trading Room Deployment`
   - Expiration: `90 days` (or custom)
   - Scopes: ✓ `repo`, ✓ `workflow`, ✓ `write:packages`
   - Click "Generate token"
   - **SAVE THIS TOKEN** - you can't see it again!

3. **Where to store**:
   ```
   File: ~/trading-room-secrets/github-token.txt
   Keep this file SECURE and NEVER commit to git
   ```

---

### Step 2: Supabase Setup (15 minutes)

**Purpose**: Database, Authentication, Realtime

1. **Sign up**:
   - Go to: https://supabase.com
   - Click "Start your project"
   - Sign in with GitHub (recommended)

2. **Create Organization**:
   - Organization name: `Trading Room`
   - Click "Create organization"

3. **Create Project**:
   - Project name: `trading-room-production`
   - Database Password: Generate strong password
   - Region: Choose closest to your users
   - Plan: Start with Free tier
   - Click "Create new project"
   - **Wait 2-3 minutes** for provisioning

4. **Get API Keys**:
   ```
   Project Settings → API → Project API keys
   ```
   - Copy `Project URL`
   - Copy `anon public` key
   - Copy `service_role` key (secret - never expose to client!)

5. **Get Database Credentials**:
   ```
   Project Settings → Database → Connection string
   ```
   - Copy `Host` (looks like: db.xxxxxxxxxxxx.supabase.co)
   - Database name: `postgres`
   - User: `postgres`
   - Password: (the one you set in step 3)
   - Port: `5432`

6. **Get JWT Secret**:
   ```
   Project Settings → API → JWT Settings → JWT Secret
   ```
   - Copy this secret

7. **Where to store**:
   ```bash
   # Create secure file
   touch ~/trading-room-secrets/supabase.env
   chmod 600 ~/trading-room-secrets/supabase.env

   # Add to file:
   SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_JWT_SECRET=your-jwt-secret
   SUPABASE_DB_HOST=db.xxxxxxxxxxxx.supabase.co
   SUPABASE_DB_NAME=postgres
   SUPABASE_DB_USER=postgres
   SUPABASE_DB_PASSWORD=your-db-password
   ```

---

### Step 3: Stripe Setup (20 minutes)

**Purpose**: Subscription billing

1. **Sign up**:
   - Go to: https://stripe.com
   - Click "Start now"
   - Enter email, create account
   - Complete business verification (may take 24-48 hours)

2. **Activate Account**:
   - Complete business details
   - Add bank account for payouts
   - Verify identity (if required)

3. **Get API Keys**:
   ```
   Dashboard → Developers → API keys
   ```
   - **Test Mode** (for development):
     - Publishable key: `pk_test_...`
     - Secret key: `sk_test_...`
   - **Live Mode** (for production):
     - Publishable key: `pk_live_...`
     - Secret key: `sk_live_...`

4. **Create Products** (Test Mode first):
   ```
   Dashboard → Products → Add product
   ```

   **Product 1: Starter Plan**
   - Name: `Starter Plan`
   - Description: `1 workspace, 3 rooms, 50 viewers`
   - Pricing: `$49.00 USD` per month
   - Recurring: Monthly
   - Click "Save product"
   - **Copy Price ID**: `price_xxxxxxxxxxxxx`

   **Product 2: Professional Plan**
   - Name: `Professional Plan`
   - Description: `3 workspaces, 10 rooms, 200 viewers`
   - Pricing: `$149.00 USD` per month
   - Recurring: Monthly
   - **Copy Price ID**: `price_xxxxxxxxxxxxx`

   **Product 3: Business Plan**
   - Name: `Business Plan`
   - Description: `10 workspaces, 50 rooms, 1000 viewers`
   - Pricing: `$449.00 USD` per month
   - Recurring: Monthly
   - **Copy Price ID**: `price_xxxxxxxxxxxxx`

5. **Set up Webhook** (do this after deployment):
   ```
   Dashboard → Developers → Webhooks → Add endpoint
   ```
   - Endpoint URL: `https://api.tradingroom.io/webhooks/stripe`
   - Events to send:
     - ✓ `customer.subscription.created`
     - ✓ `customer.subscription.updated`
     - ✓ `customer.subscription.deleted`
     - ✓ `invoice.paid`
     - ✓ `invoice.payment_failed`
   - Click "Add endpoint"
   - **Copy Signing secret**: `whsec_xxxxxxxxxxxxx`

6. **Where to store**:
   ```bash
   touch ~/trading-room-secrets/stripe.env
   chmod 600 ~/trading-room-secrets/stripe.env

   # Test keys (for development):
   STRIPE_KEY_TEST=pk_test_xxxxxxxxxxxxx
   STRIPE_SECRET_TEST=sk_test_xxxxxxxxxxxxx

   # Live keys (for production):
   STRIPE_KEY=pk_live_xxxxxxxxxxxxx
   STRIPE_SECRET=sk_live_xxxxxxxxxxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

   # Price IDs:
   STRIPE_PRICE_STARTER_MONTHLY=price_xxxxxxxxxxxxx
   STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_xxxxxxxxxxxxx
   STRIPE_PRICE_BUSINESS_MONTHLY=price_xxxxxxxxxxxxx
   ```

---

### Step 4: Cloudflare Account (15 minutes)

**Purpose**: CDN, DNS, R2 Storage

1. **Sign up**:
   - Go to: https://dash.cloudflare.com/sign-up
   - Enter email, create password
   - Verify email

2. **Add Domain** (skip if you don't have one yet):
   ```
   Websites → Add a site
   ```
   - Enter your domain: `tradingroom.io`
   - Select Free plan
   - Follow DNS migration instructions
   - Update nameservers at your domain registrar

3. **Create R2 Bucket**:
   ```
   R2 → Create bucket
   ```
   - Bucket name: `tradingroom-files`
   - Location: Automatic
   - Click "Create bucket"

4. **Get R2 API Token**:
   ```
   R2 → Manage R2 API Tokens → Create API token
   ```
   - Token name: `Trading Room Production`
   - Permissions: ✓ `Object Read & Write`
   - TTL: Never expire
   - Click "Create API Token"
   - **Copy these immediately** (shown only once):
     - Access Key ID
     - Secret Access Key
     - Endpoint URL

5. **Configure CORS** (for R2):
   ```
   R2 → tradingroom-files → Settings → CORS Policy
   ```
   Paste this JSON:
   ```json
   [
     {
       "AllowedOrigins": ["https://tradingroom.io", "https://www.tradingroom.io"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

6. **Where to store**:
   ```bash
   touch ~/trading-room-secrets/cloudflare.env
   chmod 600 ~/trading-room-secrets/cloudflare.env

   R2_ACCESS_KEY_ID=xxxxxxxxxxxxx
   R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxx
   R2_BUCKET=tradingroom-files
   R2_ENDPOINT=https://xxxxxxxxxxxxx.r2.cloudflarestorage.com
   R2_PUBLIC_URL=https://files.tradingroom.io
   ```

---

### Step 5: Hetzner Cloud (20 minutes)

**Purpose**: Server hosting

1. **Sign up**:
   - Go to: https://console.hetzner.cloud/
   - Click "Register"
   - Enter details, verify email
   - Add payment method

2. **Create Project**:
   - Project name: `Trading Room Production`
   - Click "Create project"

3. **Generate SSH Key** (on your local machine):
   ```bash
   # Generate new SSH key
   ssh-keygen -t ed25519 -C "trading-room-servers"
   # Save to: ~/.ssh/trading_room_ed25519
   # Add passphrase (recommended)

   # Display public key (copy this)
   cat ~/.ssh/trading_room_ed25519.pub
   ```

4. **Add SSH Key to Hetzner**:
   ```
   Security → SSH Keys → Add SSH key
   ```
   - Name: `Trading Room Admin`
   - Public Key: Paste the output from above
   - Click "Add SSH key"

5. **Create Servers**:

   **Server 1: SFU Server**
   ```
   Servers → Add Server
   ```
   - Location: Choose closest to users (e.g., Ashburn, USA)
   - Image: `Ubuntu 22.04`
   - Type: `CPX41` (8 vCPU, 16GB RAM) - $34/month
   - Volume: None
   - Network: Default
   - SSH Key: ✓ Select your key
   - Name: `trading-room-sfu-1`
   - Labels: `environment=production, service=sfu`
   - Click "Create & Buy now"
   - **Copy the IPv4 address**: `xx.xx.xx.xx`

   **Server 2: API/Signaling/TURN**
   ```
   Servers → Add Server
   ```
   - Location: Same as SFU
   - Image: `Ubuntu 22.04`
   - Type: `CX22` (2 vCPU, 4GB RAM) - $6/month
   - SSH Key: ✓ Select your key
   - Name: `trading-room-app-1`
   - Labels: `environment=production, service=app`
   - Click "Create & Buy now"
   - **Copy the IPv4 address**: `yy.yy.yy.yy`

6. **Configure Firewall**:
   ```
   Firewalls → Create Firewall
   ```
   - Name: `trading-room-firewall`

   **Inbound Rules**:
   - ✓ HTTP (80) from anywhere
   - ✓ HTTPS (443) from anywhere
   - ✓ SSH (22) from your IP only
   - ✓ Custom: Port 3000 (Signaling) from anywhere
   - ✓ Custom: Port 3478 UDP (TURN) from anywhere
   - ✓ Custom: Port 10000-10100 UDP (RTC) from anywhere

   **Apply to servers**:
   - ✓ trading-room-sfu-1
   - ✓ trading-room-app-1

7. **Where to store**:
   ```bash
   touch ~/trading-room-secrets/hetzner.env
   chmod 600 ~/trading-room-secrets/hetzner.env

   # Server IPs:
   SFU_SERVER_IP=xx.xx.xx.xx
   APP_SERVER_IP=yy.yy.yy.yy

   # SSH connection:
   SFU_SSH=root@xx.xx.xx.xx
   APP_SSH=root@yy.yy.yy.yy

   # For SFU configuration:
   SFU_ANNOUNCED_IP=xx.xx.xx.xx
   ```

---

### Step 6: Domain Name (10 minutes)

**Purpose**: Professional domain for your app

1. **Purchase Domain** (if you don't have one):
   - Recommended registrars:
     - Namecheap: https://www.namecheap.com
     - Google Domains: https://domains.google
     - Cloudflare Registrar: https://www.cloudflare.com/products/registrar/
   - Search for: `tradingroom.io` or similar
   - Purchase for 1 year ($10-15)

2. **Update Nameservers** (if using Cloudflare):
   - At your registrar, change nameservers to:
     ```
     ns1.cloudflare.com
     ns2.cloudflare.com
     ```
   - Wait 24-48 hours for propagation (usually faster)

3. **Where to store**:
   ```bash
   touch ~/trading-room-secrets/domain.env
   chmod 600 ~/trading-room-secrets/domain.env

   DOMAIN=tradingroom.io
   API_DOMAIN=api.tradingroom.io
   SIGNALING_DOMAIN=signaling.tradingroom.io
   SFU_DOMAIN=sfu-1.tradingroom.io
   TURN_DOMAIN=turn.tradingroom.io
   ```

---

## Environment Variables Setup

### Step 7: Create Master .env File (10 minutes)

Now we'll combine all the secrets into one master environment file.

1. **Create the file**:
   ```bash
   cd ~/trading-room-secrets
   touch production.env
   chmod 600 production.env
   ```

2. **Edit the file** and paste all values from previous steps:

```bash
# =============================================================================
# TRADING ROOM SAAS - PRODUCTION ENVIRONMENT VARIABLES
# =============================================================================
# IMPORTANT: Keep this file secure! Never commit to git!
# =============================================================================

# Application
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.tradingroom.io
APP_KEY=  # Generate in next step

# Node Environment
NODE_ENV=production

# =============================================================================
# Supabase Configuration
# =============================================================================
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret

# Supabase Database
SUPABASE_DB_HOST=db.xxxxxxxxxxxx.supabase.co
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-db-password
SUPABASE_DB_PORT=5432

# =============================================================================
# Stripe Configuration
# =============================================================================
STRIPE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_SECRET=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Stripe Price IDs
STRIPE_PRICE_STARTER_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_BUSINESS_MONTHLY=price_xxxxxxxxxxxxx

# =============================================================================
# Cloudflare R2 Storage
# =============================================================================
R2_ACCESS_KEY_ID=xxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxx
R2_BUCKET=tradingroom-files
R2_ENDPOINT=https://xxxxxxxxxxxxx.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://files.tradingroom.io

# =============================================================================
# Redis Configuration
# =============================================================================
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://127.0.0.1:6379

# =============================================================================
# Signaling Server
# =============================================================================
SIGNALING_URL=https://signaling.tradingroom.io
SIGNALING_WS_URL=wss://signaling.tradingroom.io/ws
SIGNALING_SECRET=  # Generate random 32-char string
SIGNALING_PORT=3000

# =============================================================================
# SFU Configuration
# =============================================================================
SFU_NODE_ID=sfu-1
SFU_NODES=sfu-1.tradingroom.io:4000
SFU_ANNOUNCED_IP=xx.xx.xx.xx  # Your SFU server IP
SFU_PORT=4000

# Mediasoup RTC Ports
RTC_MIN_PORT=10000
RTC_MAX_PORT=10100

# =============================================================================
# TURN Server Configuration
# =============================================================================
TURN_SERVER_URL=turn:turn.tradingroom.io:3478
TURN_SERVER_USERNAME=tradingroom
TURN_SERVER_CREDENTIAL=  # Generate random strong password
STUN_SERVER_URL=stun:turn.tradingroom.io:3478

# =============================================================================
# CORS Configuration
# =============================================================================
CORS_ORIGINS=https://tradingroom.io,https://www.tradingroom.io

# =============================================================================
# JWT Configuration
# =============================================================================
JWT_SECRET=  # Generate random 64-char string
JWT_EXPIRY=86400

# =============================================================================
# Frontend URLs
# =============================================================================
FRONTEND_URL=https://tradingroom.io
API_URL=https://api.tradingroom.io

# =============================================================================
# Logging & Monitoring
# =============================================================================
LOG_LEVEL=info

# =============================================================================
# Email Configuration (Laravel)
# =============================================================================
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailgun.org
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@tradingroom.io
MAIL_FROM_NAME="Trading Room"

# =============================================================================
# Queue Configuration (Laravel)
# =============================================================================
QUEUE_CONNECTION=redis
HORIZON_PREFIX=tradingroom_horizon:

# =============================================================================
# Rate Limiting
# =============================================================================
RATE_LIMIT_API=100
RATE_LIMIT_AUTH=5
RATE_LIMIT_WEBSOCKET=10

# =============================================================================
# Feature Flags
# =============================================================================
FEATURE_RECORDING=true
FEATURE_SCREEN_SHARE=true
FEATURE_CHAT=true
FEATURE_ALERTS=true
```

3. **Generate secrets** (for empty values):
   ```bash
   # Generate APP_KEY (Laravel)
   openssl rand -base64 32

   # Generate SIGNALING_SECRET
   openssl rand -hex 32

   # Generate JWT_SECRET
   openssl rand -hex 64

   # Generate TURN_SERVER_CREDENTIAL
   openssl rand -base64 24
   ```

4. **Fill in all empty values** in the production.env file

---

## Local Development Setup

### Step 8: Clone and Configure Repository (15 minutes)

1. **Clone the repository**:
   ```bash
   cd ~/Projects
   git clone https://github.com/your-username/streaming-cloud.git
   cd streaming-cloud
   git checkout claude/webrtc-sfu-design-01SFwVmF4BovDKnHvEkphBHk
   ```

2. **Copy environment file**:
   ```bash
   cp ~/trading-room-secrets/production.env .env
   ```

3. **Verify all services are properly configured**:
   ```bash
   # Check if all required variables are set
   grep -E "^[A-Z_]+=$" .env
   # This should return empty if all variables have values
   ```

---

## Server Provisioning

### Step 9: Initial Server Setup (30 minutes)

**Do this for BOTH servers (SFU and App)**

1. **Connect to server**:
   ```bash
   ssh -i ~/.ssh/trading_room_ed25519 root@xx.xx.xx.xx
   ```

2. **Update system**:
   ```bash
   apt update && apt upgrade -y
   ```

3. **Install Docker**:
   ```bash
   # Install prerequisites
   apt install -y apt-transport-https ca-certificates curl software-properties-common

   # Add Docker GPG key
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

   # Add Docker repository
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

   # Install Docker
   apt update
   apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

   # Verify installation
   docker --version
   docker compose version
   ```

4. **Install additional tools**:
   ```bash
   apt install -y git curl wget htop unzip
   ```

5. **Create deployment directory**:
   ```bash
   mkdir -p /opt/tradingroom
   cd /opt/tradingroom
   ```

6. **Set up log rotation**:
   ```bash
   cat > /etc/logrotate.d/tradingroom <<EOF
   /opt/tradingroom/logs/*.log {
       daily
       rotate 14
       compress
       delaycompress
       notifempty
       create 0640 root root
       sharedscripts
   }
   EOF
   ```

7. **Configure firewall** (UFW):
   ```bash
   # Install UFW
   apt install -y ufw

   # Allow SSH (IMPORTANT: Do this first!)
   ufw allow 22/tcp

   # Allow HTTP/HTTPS
   ufw allow 80/tcp
   ufw allow 443/tcp

   # For SFU server only:
   ufw allow 4000/tcp
   ufw allow 10000:10100/udp
   ufw allow 10000:10100/tcp

   # For App server only:
   ufw allow 3000/tcp  # Signaling
   ufw allow 3478/udp  # TURN
   ufw allow 3478/tcp  # TURN
   ufw allow 8000/tcp  # Laravel API

   # Enable firewall
   ufw --force enable

   # Verify
   ufw status
   ```

8. **Exit server**:
   ```bash
   exit
   ```

---

## Domain & SSL Configuration

### Step 10: Configure DNS (15 minutes)

1. **Log into Cloudflare Dashboard**:
   - Go to: https://dash.cloudflare.com
   - Select your domain

2. **Add DNS records**:
   ```
   DNS → Records → Add record
   ```

   **Record 1: Root domain**
   - Type: `A`
   - Name: `@`
   - IPv4 address: `yy.yy.yy.yy` (App server IP)
   - Proxy status: ✓ Proxied (orange cloud)
   - TTL: Auto
   - Click "Save"

   **Record 2: WWW**
   - Type: `CNAME`
   - Name: `www`
   - Target: `tradingroom.io`
   - Proxy status: ✓ Proxied
   - Click "Save"

   **Record 3: API**
   - Type: `A`
   - Name: `api`
   - IPv4 address: `yy.yy.yy.yy` (App server IP)
   - Proxy status: ✓ Proxied
   - Click "Save"

   **Record 4: Signaling**
   - Type: `A`
   - Name: `signaling`
   - IPv4 address: `yy.yy.yy.yy` (App server IP)
   - Proxy status: ✗ DNS only (gray cloud) - **Important for WebSocket!**
   - Click "Save"

   **Record 5: SFU**
   - Type: `A`
   - Name: `sfu-1`
   - IPv4 address: `xx.xx.xx.xx` (SFU server IP)
   - Proxy status: ✗ DNS only
   - Click "Save"

   **Record 6: TURN**
   - Type: `A`
   - Name: `turn`
   - IPv4 address: `yy.yy.yy.yy` (App server IP)
   - Proxy status: ✗ DNS only
   - Click "Save"

   **Record 7: Files (R2)**
   - Type: `CNAME`
   - Name: `files`
   - Target: `tradingroom-files.your-account-id.r2.cloudflarestorage.com`
   - Proxy status: ✓ Proxied
   - Click "Save"

3. **Verify DNS propagation** (wait 5-10 minutes):
   ```bash
   # On your local machine
   dig tradingroom.io
   dig api.tradingroom.io
   dig signaling.tradingroom.io
   ```

---

### Step 11: SSL Certificates (20 minutes)

We'll use Let's Encrypt with Certbot for free SSL certificates.

**On App Server:**

1. **SSH into app server**:
   ```bash
   ssh -i ~/.ssh/trading_room_ed25519 root@yy.yy.yy.yy
   ```

2. **Install Certbot**:
   ```bash
   apt install -y certbot
   ```

3. **Stop services** (if running):
   ```bash
   cd /opt/tradingroom
   docker compose down 2>/dev/null || true
   ```

4. **Generate certificates**:
   ```bash
   # Certificate for main domains
   certbot certonly --standalone \
     -d tradingroom.io \
     -d www.tradingroom.io \
     -d api.tradingroom.io \
     --email your-email@example.com \
     --agree-tos \
     --no-eff-email

   # Certificate for signaling (WebSocket)
   certbot certonly --standalone \
     -d signaling.tradingroom.io \
     --email your-email@example.com \
     --agree-tos \
     --no-eff-email

   # Certificate for TURN
   certbot certonly --standalone \
     -d turn.tradingroom.io \
     --email your-email@example.com \
     --agree-tos \
     --no-eff-email
   ```

5. **Copy certificates to deployment directory**:
   ```bash
   mkdir -p /opt/tradingroom/ssl

   # Main certificate
   cp /etc/letsencrypt/live/tradingroom.io/fullchain.pem /opt/tradingroom/ssl/
   cp /etc/letsencrypt/live/tradingroom.io/privkey.pem /opt/tradingroom/ssl/

   # Signaling certificate
   cp /etc/letsencrypt/live/signaling.tradingroom.io/fullchain.pem /opt/tradingroom/ssl/signaling-fullchain.pem
   cp /etc/letsencrypt/live/signaling.tradingroom.io/privkey.pem /opt/tradingroom/ssl/signaling-privkey.pem

   # Set permissions
   chmod 644 /opt/tradingroom/ssl/*.pem
   ```

6. **Set up auto-renewal**:
   ```bash
   # Create renewal hook
   cat > /etc/letsencrypt/renewal-hooks/deploy/tradingroom.sh <<'EOF'
   #!/bin/bash
   cp /etc/letsencrypt/live/tradingroom.io/fullchain.pem /opt/tradingroom/ssl/
   cp /etc/letsencrypt/live/tradingroom.io/privkey.pem /opt/tradingroom/ssl/
   cp /etc/letsencrypt/live/signaling.tradingroom.io/fullchain.pem /opt/tradingroom/ssl/signaling-fullchain.pem
   cp /etc/letsencrypt/live/signaling.tradingroom.io/privkey.pem /opt/tradingroom/ssl/signaling-privkey.pem
   cd /opt/tradingroom && docker compose restart frontend signaling
   EOF

   chmod +x /etc/letsencrypt/renewal-hooks/deploy/tradingroom.sh

   # Test renewal
   certbot renew --dry-run
   ```

**On SFU Server:**

1. **SSH into SFU server**:
   ```bash
   ssh -i ~/.ssh/trading_room_ed25519 root@xx.xx.xx.xx
   ```

2. **Install Certbot**:
   ```bash
   apt install -y certbot
   ```

3. **Generate certificate**:
   ```bash
   certbot certonly --standalone \
     -d sfu-1.tradingroom.io \
     --email your-email@example.com \
     --agree-tos \
     --no-eff-email
   ```

4. **Copy certificate**:
   ```bash
   mkdir -p /opt/tradingroom/ssl
   cp /etc/letsencrypt/live/sfu-1.tradingroom.io/fullchain.pem /opt/tradingroom/ssl/
   cp /etc/letsencrypt/live/sfu-1.tradingroom.io/privkey.pem /opt/tradingroom/ssl/
   chmod 644 /opt/tradingroom/ssl/*.pem
   ```

---

## Database Migration

### Step 12: Run Database Migrations (15 minutes)

1. **On your local machine**, run the SQL schema:

   ```bash
   # Download Supabase CLI
   brew install supabase/tap/supabase  # Mac
   # OR
   npm install -g supabase  # Cross-platform

   # Login
   supabase login

   # Link to your project
   supabase link --project-ref xxxxxxxxxxxx
   ```

2. **Apply the schema**:
   ```bash
   cd ~/Projects/streaming-cloud

   # Create migration file
   supabase migration new initial_schema

   # Copy the schema from docs/DATABASE_SCHEMA.md
   # Paste the SQL into the migration file

   # Push to Supabase
   supabase db push
   ```

3. **Alternatively, use psql directly**:
   ```bash
   # Install PostgreSQL client
   brew install postgresql  # Mac
   # OR
   apt install postgresql-client  # Linux

   # Connect to Supabase
   psql "postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres"

   # Then paste the SQL from docs/DATABASE_SCHEMA.md
   # Type \q to exit when done
   ```

4. **Verify migrations**:
   - Log into Supabase Dashboard
   - Go to: Table Editor
   - You should see: organizations, rooms, workspaces, etc.

5. **Enable Realtime** (in Supabase):
   ```
   Database → Replication → Enable for these tables:
   ```
   - ✓ room_participants
   - ✓ chat_messages
   - ✓ alerts
   - ✓ rooms

---

## Deployment Process

### Step 13: Deploy to App Server (45 minutes)

1. **SSH into app server**:
   ```bash
   ssh -i ~/.ssh/trading_room_ed25519 root@yy.yy.yy.yy
   cd /opt/tradingroom
   ```

2. **Clone repository**:
   ```bash
   git clone https://github.com/your-username/streaming-cloud.git .
   git checkout claude/webrtc-sfu-design-01SFwVmF4BovDKnHvEkphBHk
   ```

3. **Create .env file**:
   ```bash
   nano .env
   # Paste the contents from ~/trading-room-secrets/production.env
   # Save: Ctrl+O, Enter, Ctrl+X
   ```

4. **Build and start services**:
   ```bash
   cd infrastructure/docker

   # Build images (this will take 10-15 minutes)
   docker compose build

   # Start services
   docker compose up -d

   # Check status
   docker compose ps
   ```

5. **Verify services are running**:
   ```bash
   # Check logs
   docker compose logs -f backend
   docker compose logs -f signaling
   docker compose logs -f frontend

   # Test endpoints
   curl http://localhost:8000/health
   curl http://localhost:3000/health
   curl http://localhost/health
   ```

6. **Run Laravel setup**:
   ```bash
   # Generate app key
   docker compose exec backend php artisan key:generate

   # Run migrations (if not done via Supabase)
   docker compose exec backend php artisan migrate --force

   # Cache config
   docker compose exec backend php artisan config:cache
   docker compose exec backend php artisan route:cache
   ```

---

### Step 14: Deploy to SFU Server (20 minutes)

1. **SSH into SFU server**:
   ```bash
   ssh -i ~/.ssh/trading_room_ed25519 root@xx.xx.xx.xx
   cd /opt/tradingroom
   ```

2. **Clone repository**:
   ```bash
   git clone https://github.com/your-username/streaming-cloud.git .
   git checkout claude/webrtc-sfu-design-01SFwVmF4BovDKnHvEkphBHk
   ```

3. **Create .env file** (SFU-specific):
   ```bash
   cat > .env <<EOF
   NODE_ENV=production
   PORT=4000
   NODE_ID=sfu-1
   REDIS_URL=redis://yy.yy.yy.yy:6379
   RTC_MIN_PORT=10000
   RTC_MAX_PORT=10100
   ANNOUNCED_IP=$(curl -s ifconfig.me)
   MEDIASOUP_LOG_LEVEL=warn
   EOF
   ```

4. **Build and start SFU**:
   ```bash
   cd sfu

   # Build Docker image
   docker build -f ../infrastructure/docker/Dockerfile.sfu -t tradingroom-sfu .

   # Run container
   docker run -d \
     --name tradingroom-sfu \
     --restart unless-stopped \
     --network host \
     --cap-add=SYS_NICE \
     --env-file ../.env \
     tradingroom-sfu

   # Check logs
   docker logs -f tradingroom-sfu
   ```

5. **Verify SFU is running**:
   ```bash
   curl http://localhost:4000/health
   ```

---

## Post-Deployment Verification

### Step 15: Smoke Tests (30 minutes)

1. **Test DNS resolution**:
   ```bash
   # On your local machine
   nslookup tradingroom.io
   nslookup api.tradingroom.io
   nslookup signaling.tradingroom.io
   nslookup sfu-1.tradingroom.io
   ```

2. **Test HTTPS endpoints**:
   ```bash
   curl https://tradingroom.io
   curl https://api.tradingroom.io/health
   curl https://signaling.tradingroom.io/health
   curl https://sfu-1.tradingroom.io:4000/health
   ```

3. **Test WebSocket connection**:
   ```bash
   # Install wscat
   npm install -g wscat

   # Test signaling WebSocket
   wscat -c wss://signaling.tradingroom.io/ws
   # You should see: {"event":"welcome",...}
   # Press Ctrl+C to exit
   ```

4. **Test API authentication**:
   ```bash
   # Register a test user in Supabase Dashboard
   # Auth → Users → Add user manually
   # Email: test@example.com
   # Password: TestPassword123!

   # Get auth token
   curl -X POST https://api.tradingroom.io/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"TestPassword123!"}'

   # Should return: {"token":"..."}
   ```

5. **Test Stripe webhook**:
   ```bash
   # In Stripe Dashboard
   # Developers → Webhooks → Select your endpoint
   # Send test webhook
   # Check: "customer.subscription.created"

   # Verify in app logs:
   ssh root@yy.yy.yy.yy
   cd /opt/tradingroom
   docker compose logs backend | grep stripe
   ```

6. **Test file upload to R2**:
   - Use Postman or similar
   - POST to: `https://api.tradingroom.io/api/v1/files/upload`
   - With auth token and file
   - Verify file appears in Cloudflare R2 bucket

7. **Create test room**:
   ```bash
   # Using auth token from step 4
   curl -X POST https://api.tradingroom.io/api/v1/organizations/YOUR_ORG_ID/rooms \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "workspace_id": "YOUR_WORKSPACE_ID",
       "name": "Test Room",
       "description": "Testing deployment"
     }'
   ```

---

### Step 16: Create First Organization (15 minutes)

1. **Sign up first user**:
   - Go to: https://tradingroom.io
   - Click "Sign Up"
   - Enter email and password
   - Verify email (check Supabase Auth → Users)

2. **Create organization via API or Supabase**:

   **Option A: Via Supabase Dashboard**
   ```
   Table Editor → organizations → Insert row
   ```
   - name: `Test Organization`
   - slug: `test-org`
   - Click "Save"

   Copy the organization ID, then:
   ```
   Table Editor → organization_members → Insert row
   ```
   - organization_id: (paste from above)
   - user_id: (your user ID from auth.users)
   - role: `owner`
   - Click "Save"

   **Option B: Via SQL**
   ```sql
   -- In Supabase SQL Editor
   INSERT INTO organizations (name, slug)
   VALUES ('Test Organization', 'test-org')
   RETURNING id;

   -- Use the returned ID
   INSERT INTO organization_members (organization_id, user_id, role)
   VALUES ('org-id-here', 'user-id-here', 'owner');
   ```

3. **Create workspace**:
   ```sql
   INSERT INTO workspaces (organization_id, name, slug)
   VALUES ('org-id-here', 'Main Workspace', 'main');
   ```

4. **Test subscription**:
   - Go to: https://tradingroom.io/billing
   - Click "Subscribe to Starter Plan"
   - Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
   - Complete payment
   - Verify subscription in Stripe Dashboard

---

## Monitoring & Maintenance

### Step 17: Set Up Monitoring (20 minutes)

1. **Set up log aggregation**:
   ```bash
   # On app server
   ssh root@yy.yy.yy.yy

   # Create log monitoring script
   cat > /opt/tradingroom/monitor-logs.sh <<'EOF'
   #!/bin/bash
   cd /opt/tradingroom/infrastructure/docker

   # Check for errors in last 5 minutes
   docker compose logs --since 5m | grep -i error | grep -v "0 errors"

   # Check service health
   for service in backend signaling frontend redis; do
     echo "=== $service ==="
     docker compose ps $service
   done
   EOF

   chmod +x /opt/tradingroom/monitor-logs.sh

   # Run every 5 minutes
   crontab -e
   # Add: */5 * * * * /opt/tradingroom/monitor-logs.sh >> /var/log/tradingroom-monitor.log 2>&1
   ```

2. **Set up health checks**:
   ```bash
   # Create health check script
   cat > /opt/tradingroom/health-check.sh <<'EOF'
   #!/bin/bash

   # Check all endpoints
   endpoints=(
     "https://tradingroom.io"
     "https://api.tradingroom.io/health"
     "https://signaling.tradingroom.io/health"
   )

   for endpoint in "${endpoints[@]}"; do
     status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")
     if [ "$status" != "200" ]; then
       echo "[$(date)] ERROR: $endpoint returned $status"
       # Add email notification here if needed
     fi
   done
   EOF

   chmod +x /opt/tradingroom/health-check.sh

   # Run every minute
   crontab -e
   # Add: * * * * * /opt/tradingroom/health-check.sh >> /var/log/tradingroom-health.log 2>&1
   ```

3. **Set up backup script**:
   ```bash
   cat > /opt/tradingroom/backup.sh <<'EOF'
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR=/opt/tradingroom/backups
   mkdir -p $BACKUP_DIR

   # Backup environment file
   cp /opt/tradingroom/.env $BACKUP_DIR/env_$DATE.bak

   # Backup database (via Supabase - already handled)
   echo "[$(date)] Supabase handles automatic backups"

   # Keep only last 7 days of backups
   find $BACKUP_DIR -name "*.bak" -mtime +7 -delete
   EOF

   chmod +x /opt/tradingroom/backup.sh

   # Run daily at 2 AM
   crontab -e
   # Add: 0 2 * * * /opt/tradingroom/backup.sh >> /var/log/tradingroom-backup.log 2>&1
   ```

4. **Monitor disk space**:
   ```bash
   # Add to health check
   df -h
   docker system df

   # Clean up old Docker images weekly
   cat > /opt/tradingroom/cleanup.sh <<'EOF'
   #!/bin/bash
   docker system prune -af --volumes --filter "until=168h"
   EOF

   chmod +x /opt/tradingroom/cleanup.sh

   # Run weekly on Sunday at 3 AM
   crontab -e
   # Add: 0 3 * * 0 /opt/tradingroom/cleanup.sh >> /var/log/tradingroom-cleanup.log 2>&1
   ```

---

### Step 18: Set Up Alerts (Optional but Recommended)

**Using a free service like UptimeRobot**:

1. Go to: https://uptimerobot.com
2. Sign up (free plan = 50 monitors)
3. Add monitors:
   - `https://tradingroom.io` (check every 5 min)
   - `https://api.tradingroom.io/health` (check every 5 min)
   - `https://signaling.tradingroom.io/health` (check every 5 min)
   - `https://sfu-1.tradingroom.io:4000/health` (check every 5 min)
4. Add alert contacts (email, Slack, etc.)

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Services Won't Start

**Symptoms**: `docker compose up` fails

**Solutions**:
```bash
# Check logs
docker compose logs

# Check if ports are already in use
netstat -tulpn | grep -E ':(80|443|3000|8000|6379)'

# Kill conflicting processes
kill <PID>

# Rebuild containers
docker compose down
docker compose build --no-cache
docker compose up -d
```

#### Issue 2: Database Connection Failed

**Symptoms**: Backend logs show "Connection refused" to database

**Solutions**:
```bash
# Verify Supabase credentials
cat .env | grep SUPABASE_DB

# Test connection manually
psql "postgresql://postgres:PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres" -c "SELECT 1;"

# Check if IP is allowed in Supabase
# Supabase Dashboard → Settings → Database → Connection pooling
# Ensure "Restrict to IPv4" is disabled or add your server IP
```

#### Issue 3: SSL Certificate Issues

**Symptoms**: "Certificate error" in browser

**Solutions**:
```bash
# Renew certificates manually
certbot renew --force-renewal

# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/tradingroom.io/fullchain.pem -text -noout

# Restart services
cd /opt/tradingroom/infrastructure/docker
docker compose restart frontend
```

#### Issue 4: WebSocket Connection Fails

**Symptoms**: Signaling connection drops or won't connect

**Solutions**:
```bash
# Verify WebSocket endpoint
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  https://signaling.tradingroom.io/ws

# Check Cloudflare proxy settings
# Make sure signaling.tradingroom.io is DNS-only (gray cloud)

# Check firewall
ufw status | grep 3000

# Check container logs
docker logs tradingroom-signaling
```

#### Issue 5: Stripe Webhooks Not Working

**Symptoms**: Subscriptions not updating in database

**Solutions**:
```bash
# Test webhook endpoint
curl -X POST https://api.tradingroom.io/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"ping"}'

# Check Stripe webhook logs
# Stripe Dashboard → Developers → Webhooks → Select endpoint → View logs

# Verify webhook secret matches
docker compose exec backend env | grep STRIPE_WEBHOOK_SECRET
```

#### Issue 6: High Memory Usage

**Symptoms**: Server becomes unresponsive

**Solutions**:
```bash
# Check memory usage
free -h
docker stats

# Restart specific service
docker compose restart <service-name>

# If out of memory, upgrade server
# Or add swap:
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## Quick Reference Commands

### Server Management

```bash
# Connect to servers
ssh -i ~/.ssh/trading_room_ed25519 root@APP_SERVER_IP
ssh -i ~/.ssh/trading_room_ed25519 root@SFU_SERVER_IP

# Check service status
cd /opt/tradingroom/infrastructure/docker
docker compose ps

# View logs
docker compose logs -f <service-name>

# Restart services
docker compose restart <service-name>

# Stop all services
docker compose down

# Start all services
docker compose up -d

# Update code
git pull origin main
docker compose build
docker compose up -d

# Check disk space
df -h
docker system df
```

### Database Management

```bash
# Connect to database
psql "postgresql://postgres:PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres"

# Backup database (Supabase handles this automatically)
# Manual export from Supabase Dashboard → Database → Backups

# Run migrations
docker compose exec backend php artisan migrate

# Rollback migration
docker compose exec backend php artisan migrate:rollback
```

### SSL Certificate Management

```bash
# Renew certificates (runs automatically)
certbot renew

# Force renewal
certbot renew --force-renewal

# List certificates
certbot certificates

# Revoke certificate
certbot revoke --cert-path /etc/letsencrypt/live/tradingroom.io/fullchain.pem
```

---

## Security Checklist

After deployment, verify:

- [ ] All passwords are strong and unique
- [ ] SSH key authentication is enabled (password auth disabled)
- [ ] Firewall is configured and enabled
- [ ] SSL certificates are valid
- [ ] Environment variables are not in git
- [ ] Database has strong password
- [ ] Supabase RLS policies are enabled
- [ ] Stripe is in live mode (not test)
- [ ] API rate limiting is configured
- [ ] CORS origins are restricted
- [ ] Backups are running
- [ ] Monitoring is set up
- [ ] Server OS is updated
- [ ] Docker images are from official sources

---

## Support Resources

### Documentation
- **Supabase**: https://supabase.com/docs
- **Laravel**: https://laravel.com/docs/12.x
- **Mediasoup**: https://mediasoup.org/documentation/
- **Docker**: https://docs.docker.com
- **Stripe**: https://stripe.com/docs

### Community
- **GitHub Issues**: https://github.com/your-repo/issues
- **Stack Overflow**: Tag with specific technology

### Professional Support
- For paid support, contact: support@tradingroom.io

---

## Appendix A: Server Specifications

### Minimum Requirements

| Component | Specification |
|-----------|--------------|
| **SFU Server** | 4 vCPU, 8GB RAM, 80GB SSD |
| **App Server** | 2 vCPU, 4GB RAM, 40GB SSD |
| **Bandwidth** | 1 Gbps shared |
| **OS** | Ubuntu 22.04 LTS |

### Recommended (Production)

| Component | Specification |
|-----------|--------------|
| **SFU Server** | 8 vCPU, 16GB RAM, 160GB SSD |
| **App Server** | 2 vCPU, 4GB RAM, 80GB SSD |
| **Bandwidth** | 1 Gbps dedicated |
| **OS** | Ubuntu 22.04 LTS |
| **Load Balancer** | Optional for scaling |

---

## Appendix B: Cost Calculator

### Monthly Costs

| Item | Cost |
|------|------|
| Hetzner CPX41 (SFU) | $34 |
| Hetzner CX22 (App) | $6 |
| Domain (amortized) | $1 |
| Supabase Pro (optional) | $25 |
| Cloudflare R2 (estimated) | $5 |
| **Total (Basic)** | **$46** |
| **Total (With Supabase Pro)** | **$71** |

### Scaling Costs

| Scenario | Users | Rooms | Monthly Cost |
|----------|-------|-------|--------------|
| Small | 100 | 5 | $50 |
| Medium | 1,000 | 20 | $150 |
| Large | 10,000 | 100 | $500 |
| Enterprise | 100,000+ | 1,000+ | Custom |

---

## Appendix C: Environment Variables Reference

See the master `.env` file in Step 7 for all environment variables.

**Critical Variables** (must be set):
- `APP_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `STRIPE_SECRET`
- `R2_SECRET_ACCESS_KEY`
- `JWT_SECRET`

**Optional Variables** (have defaults):
- `LOG_LEVEL` (default: info)
- `REDIS_PORT` (default: 6379)
- `SIGNALING_PORT` (default: 3000)

---

## Congratulations! 🎉

Your Trading Room SaaS platform is now deployed and ready for users!

**What's Next?**

1. **Marketing**: Start promoting your platform
2. **User Testing**: Invite beta users
3. **Monitoring**: Watch metrics and logs
4. **Iterate**: Gather feedback and improve
5. **Scale**: Add more SFU nodes as you grow

**Need Help?**
- Review the troubleshooting section
- Check server logs
- Contact support

---

**Document Version**: 1.0.0
**Last Updated**: November 24, 2025
**Author**: Trading Room Team
