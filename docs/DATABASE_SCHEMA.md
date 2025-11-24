# Trading Room SaaS - Supabase Database Schema

## Version 1.0.0 | Multi-Tenant PostgreSQL with RLS

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE ENTITY RELATIONSHIPS                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   organizations  │       │      users       │       │  subscriptions   │
│──────────────────│       │──────────────────│       │──────────────────│
│ id (PK)          │◄──┐   │ id (PK)          │       │ id (PK)          │
│ name             │   │   │ email            │       │ organization_id  │───┐
│ slug             │   │   │ full_name        │       │ stripe_customer  │   │
│ logo_url         │   │   │ avatar_url       │       │ stripe_sub_id    │   │
│ settings         │   │   │ created_at       │       │ plan_id          │   │
│ created_at       │   │   │ updated_at       │       │ status           │   │
│ updated_at       │   │   └──────────────────┘       │ current_period   │   │
└──────────────────┘   │            │                 │ created_at       │   │
         │             │            │                 └──────────────────┘   │
         │             │            │                          │             │
         │             │   ┌────────▼─────────┐                │             │
         │             │   │ organization_    │                │             │
         │             └───┤ members          │                │             │
         │                 │──────────────────│                │             │
         │                 │ id (PK)          │                │             │
         │                 │ organization_id  │◄───────────────┘             │
         │                 │ user_id          │                              │
         │                 │ role             │                              │
         │                 │ created_at       │                              │
         │                 └──────────────────┘                              │
         │                          │                                        │
         │                          │                                        │
┌────────▼─────────┐       ┌────────▼─────────┐       ┌──────────────────┐  │
│   workspaces     │       │ workspace_       │       │      plans       │  │
│──────────────────│       │ members          │       │──────────────────│  │
│ id (PK)          │       │──────────────────│       │ id (PK)          │◄─┘
│ organization_id  │       │ id (PK)          │       │ name             │
│ name             │       │ workspace_id     │       │ stripe_price_id  │
│ description      │       │ user_id          │       │ max_workspaces   │
│ settings         │       │ role             │       │ max_rooms        │
│ created_at       │       │ created_at       │       │ max_hosts        │
│ updated_at       │       └──────────────────┘       │ max_viewers      │
└──────────────────┘                │                 │ max_storage_gb   │
         │                          │                 │ features         │
         │                          │                 └──────────────────┘
┌────────▼─────────┐                │
│      rooms       │                │                 ┌──────────────────┐
│──────────────────│                │                 │   room_sessions  │
│ id (PK)          │◄───────────────┤                 │──────────────────│
│ workspace_id     │                │                 │ id (PK)          │
│ organization_id  │                │                 │ room_id          │
│ name             │                │                 │ started_at       │
│ description      │                │                 │ ended_at         │
│ status           │                │                 │ host_user_id     │
│ settings         │                │                 │ peak_viewers     │
│ scheduled_at     │                │                 │ recording_url    │
│ created_at       │                │                 └──────────────────┘
│ updated_at       │                │                          │
└──────────────────┘                │                          │
         │                          │                 ┌────────▼─────────┐
         │                          │                 │ session_         │
┌────────▼─────────┐       ┌────────▼─────────┐       │ participants     │
│ room_participants│       │   chat_messages  │       │──────────────────│
│──────────────────│       │──────────────────│       │ id (PK)          │
│ id (PK)          │       │ id (PK)          │       │ session_id       │
│ room_id          │       │ room_id          │       │ user_id          │
│ user_id          │       │ user_id          │       │ joined_at        │
│ role             │       │ content          │       │ left_at          │
│ joined_at        │       │ type             │       │ role             │
│ left_at          │       │ metadata         │       │ device_info      │
│ connection_state │       │ created_at       │       └──────────────────┘
└──────────────────┘       └──────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   room_files     │       │     alerts       │       │   audit_logs     │
│──────────────────│       │──────────────────│       │──────────────────│
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ room_id          │       │ room_id          │       │ organization_id  │
│ uploaded_by      │       │ user_id          │       │ user_id          │
│ file_name        │       │ type             │       │ action           │
│ file_url         │       │ title            │       │ resource_type    │
│ file_size        │       │ message          │       │ resource_id      │
│ mime_type        │       │ priority         │       │ metadata         │
│ created_at       │       │ created_at       │       │ ip_address       │
└──────────────────┘       └──────────────────┘       │ created_at       │
                                                      └──────────────────┘
```

---

## SQL Schema Definition

```sql
-- ============================================================================
-- TRADING ROOM SAAS - POSTGRESQL SCHEMA
-- Version: 1.0.0
-- Database: Supabase PostgreSQL
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE workspace_role AS ENUM ('admin', 'host', 'co_host', 'moderator', 'viewer');
CREATE TYPE room_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'cancelled', 'trialing', 'incomplete');
CREATE TYPE participant_role AS ENUM ('host', 'co_host', 'moderator', 'viewer');
CREATE TYPE connection_state AS ENUM ('connecting', 'connected', 'disconnected', 'failed');
CREATE TYPE alert_type AS ENUM ('info', 'warning', 'trade', 'announcement');
CREATE TYPE alert_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- ============================================================================
-- PLANS TABLE
-- ============================================================================

CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    stripe_price_id VARCHAR(255),
    price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10, 2),

    -- Limits
    max_workspaces INTEGER NOT NULL DEFAULT 1,
    max_rooms INTEGER NOT NULL DEFAULT 3,
    max_hosts INTEGER NOT NULL DEFAULT 1,
    max_viewers_per_room INTEGER NOT NULL DEFAULT 50,
    max_storage_gb INTEGER NOT NULL DEFAULT 5,
    max_recording_hours INTEGER DEFAULT 0,

    -- Features (JSONB for flexibility)
    features JSONB NOT NULL DEFAULT '{
        "recording": false,
        "analytics": "basic",
        "custom_branding": false,
        "sso": false,
        "api_access": false,
        "audit_logs": false,
        "priority_support": false,
        "sla": "99.5"
    }'::jsonb,

    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (name, display_name, price_monthly, max_workspaces, max_rooms, max_hosts, max_viewers_per_room, max_storage_gb, features) VALUES
('starter', 'Starter', 49.00, 1, 3, 1, 50, 5, '{"recording": false, "analytics": "basic", "custom_branding": false, "sso": false, "api_access": false, "audit_logs": false, "priority_support": false, "sla": "99.5"}'),
('professional', 'Professional', 149.00, 3, 10, 3, 200, 25, '{"recording": true, "analytics": "advanced", "custom_branding": false, "sso": false, "api_access": true, "audit_logs": false, "priority_support": false, "sla": "99.9"}'),
('business', 'Business', 449.00, 10, 50, 10, 1000, 100, '{"recording": true, "analytics": "full", "custom_branding": true, "sso": true, "api_access": true, "audit_logs": true, "priority_support": true, "sla": "99.95"}'),
('enterprise', 'Enterprise', 0.00, -1, -1, -1, -1, -1, '{"recording": true, "analytics": "full", "custom_branding": true, "sso": true, "api_access": true, "audit_logs": true, "priority_support": true, "sla": "99.99", "dedicated_support": true}');

-- ============================================================================
-- ORGANIZATIONS TABLE (Tenants)
-- ============================================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    logo_url VARCHAR(500),

    -- Settings
    settings JSONB NOT NULL DEFAULT '{
        "timezone": "UTC",
        "language": "en",
        "allow_guest_viewers": false,
        "require_approval": false,
        "default_room_settings": {}
    }'::jsonb,

    -- Billing
    stripe_customer_id VARCHAR(255),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_stripe ON organizations(stripe_customer_id);

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),

    -- Stripe
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_price_id VARCHAR(255),

    -- Status
    status subscription_status NOT NULL DEFAULT 'trialing',

    -- Period
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,

    -- Usage (for metered billing)
    usage_data JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(organization_id)
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- ============================================================================
-- ORGANIZATION MEMBERS TABLE
-- ============================================================================

CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role organization_role NOT NULL DEFAULT 'member',

    -- Invitation
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- ============================================================================
-- WORKSPACES TABLE
-- ============================================================================

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL,

    -- Settings
    settings JSONB NOT NULL DEFAULT '{
        "default_room_capacity": 100,
        "allow_screen_share": true,
        "recording_enabled": false
    }'::jsonb,

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(organization_id, slug)
);

CREATE INDEX idx_workspaces_org ON workspaces(organization_id);

-- ============================================================================
-- WORKSPACE MEMBERS TABLE
-- ============================================================================

CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role workspace_role NOT NULL DEFAULT 'viewer',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

-- ============================================================================
-- ROOMS TABLE
-- ============================================================================

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL,

    -- Status
    status room_status NOT NULL DEFAULT 'scheduled',

    -- Settings
    settings JSONB NOT NULL DEFAULT '{
        "max_participants": 100,
        "allow_chat": true,
        "allow_reactions": true,
        "allow_screen_share": true,
        "require_approval": false,
        "waiting_room": false,
        "mute_on_entry": true,
        "simulcast": true,
        "video_quality": "720p"
    }'::jsonb,

    -- Scheduling
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,

    -- Media
    thumbnail_url VARCHAR(500),
    recording_enabled BOOLEAN NOT NULL DEFAULT false,

    -- Analytics
    total_participants INTEGER NOT NULL DEFAULT 0,
    peak_participants INTEGER NOT NULL DEFAULT 0,
    total_duration_minutes INTEGER NOT NULL DEFAULT 0,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(workspace_id, slug)
);

CREATE INDEX idx_rooms_workspace ON rooms(workspace_id);
CREATE INDEX idx_rooms_org ON rooms(organization_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_scheduled ON rooms(scheduled_start);

-- ============================================================================
-- ROOM SESSIONS TABLE
-- ============================================================================

CREATE TABLE room_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    -- Host
    host_user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Stats
    peak_viewers INTEGER NOT NULL DEFAULT 0,
    total_participants INTEGER NOT NULL DEFAULT 0,
    avg_watch_time_seconds INTEGER,

    -- Recording
    recording_url VARCHAR(500),
    recording_size_bytes BIGINT,
    recording_duration_seconds INTEGER,

    -- SFU Info
    sfu_node VARCHAR(100),
    router_id VARCHAR(100),

    -- Quality metrics
    quality_metrics JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_room_sessions_room ON room_sessions(room_id);
CREATE INDEX idx_room_sessions_host ON room_sessions(host_user_id);
CREATE INDEX idx_room_sessions_started ON room_sessions(started_at);

-- ============================================================================
-- ROOM PARTICIPANTS TABLE (Real-time presence)
-- ============================================================================

CREATE TABLE room_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    session_id UUID REFERENCES room_sessions(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Role in room
    role participant_role NOT NULL DEFAULT 'viewer',

    -- Connection
    connection_state connection_state NOT NULL DEFAULT 'connecting',
    transport_id VARCHAR(100),

    -- Timing
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,

    -- Device info
    device_info JSONB DEFAULT '{}',

    -- Media state
    is_video_enabled BOOLEAN NOT NULL DEFAULT false,
    is_audio_enabled BOOLEAN NOT NULL DEFAULT false,
    is_screen_sharing BOOLEAN NOT NULL DEFAULT false,

    -- Quality
    connection_quality VARCHAR(20) DEFAULT 'good',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_room_participants_room ON room_participants(room_id);
CREATE INDEX idx_room_participants_user ON room_participants(user_id);
CREATE INDEX idx_room_participants_session ON room_participants(session_id);
CREATE INDEX idx_room_participants_active ON room_participants(room_id, left_at) WHERE left_at IS NULL;

-- ============================================================================
-- CHAT MESSAGES TABLE
-- ============================================================================

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    session_id UUID REFERENCES room_sessions(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, image, file, system

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Moderation
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_by UUID REFERENCES auth.users(id),
    deleted_at TIMESTAMPTZ,

    -- Reply
    reply_to_id UUID REFERENCES chat_messages(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(room_id, created_at);

-- ============================================================================
-- ALERTS TABLE (Trading alerts, announcements)
-- ============================================================================

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    type alert_type NOT NULL DEFAULT 'info',
    priority alert_priority NOT NULL DEFAULT 'medium',

    title VARCHAR(255) NOT NULL,
    message TEXT,

    -- Rich content
    metadata JSONB DEFAULT '{}',

    -- Expiry
    expires_at TIMESTAMPTZ,

    -- Acknowledgement tracking
    acknowledged_by UUID[] DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_room ON alerts(room_id);
CREATE INDEX idx_alerts_created ON alerts(room_id, created_at DESC);

-- ============================================================================
-- ROOM FILES TABLE
-- ============================================================================

CREATE TABLE room_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,

    -- R2 specific
    r2_key VARCHAR(500) NOT NULL,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    is_deleted BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_room_files_room ON room_files(room_id);
CREATE INDEX idx_room_files_uploaded_by ON room_files(uploaded_by);

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,

    -- Details
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',

    -- Context
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(organization_id, action);

-- ============================================================================
-- API KEYS TABLE
-- ============================================================================

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),

    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(10) NOT NULL, -- First 8 chars for identification

    -- Permissions
    scopes TEXT[] NOT NULL DEFAULT '{}',

    -- Limits
    rate_limit INTEGER DEFAULT 1000,

    -- Validity
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- ============================================================================
-- USER PROFILES TABLE (Extended user data)
-- ============================================================================

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    bio TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Preferences
    preferences JSONB NOT NULL DEFAULT '{
        "notifications": {
            "email": true,
            "push": true,
            "room_start": true,
            "mentions": true
        },
        "video_quality": "auto",
        "audio_input": null,
        "video_input": null
    }'::jsonb,

    -- Stats
    total_watch_time_minutes INTEGER NOT NULL DEFAULT 0,
    rooms_joined INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT ARRAY_AGG(organization_id)
    FROM organization_members
    WHERE user_id = auth.uid()
$$;

-- Helper function to check organization membership
CREATE OR REPLACE FUNCTION is_organization_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = org_id AND user_id = auth.uid()
    )
$$;

-- Helper function to check organization admin
CREATE OR REPLACE FUNCTION is_organization_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
$$;

-- ============================================================================
-- ORGANIZATIONS POLICIES
-- ============================================================================

CREATE POLICY "Users can view their organizations"
ON organizations FOR SELECT
USING (is_organization_member(id));

CREATE POLICY "Admins can update their organizations"
ON organizations FOR UPDATE
USING (is_organization_admin(id));

-- ============================================================================
-- ORGANIZATION MEMBERS POLICIES
-- ============================================================================

CREATE POLICY "Members can view organization members"
ON organization_members FOR SELECT
USING (is_organization_member(organization_id));

CREATE POLICY "Admins can manage organization members"
ON organization_members FOR ALL
USING (is_organization_admin(organization_id));

-- ============================================================================
-- WORKSPACES POLICIES
-- ============================================================================

CREATE POLICY "Members can view workspaces"
ON workspaces FOR SELECT
USING (is_organization_member(organization_id));

CREATE POLICY "Admins can manage workspaces"
ON workspaces FOR ALL
USING (is_organization_admin(organization_id));

-- ============================================================================
-- ROOMS POLICIES
-- ============================================================================

CREATE POLICY "Members can view rooms"
ON rooms FOR SELECT
USING (is_organization_member(organization_id));

CREATE POLICY "Workspace members can create rooms"
ON rooms FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM workspace_members wm
        JOIN workspaces w ON w.id = wm.workspace_id
        WHERE w.id = workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('admin', 'host')
    )
);

CREATE POLICY "Room creators and admins can update rooms"
ON rooms FOR UPDATE
USING (
    created_by = auth.uid() OR is_organization_admin(organization_id)
);

-- ============================================================================
-- CHAT MESSAGES POLICIES
-- ============================================================================

CREATE POLICY "Participants can view messages"
ON chat_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM rooms r
        WHERE r.id = room_id
        AND is_organization_member(r.organization_id)
    )
);

CREATE POLICY "Participants can send messages"
ON chat_messages FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM room_participants rp
        WHERE rp.room_id = chat_messages.room_id
        AND rp.user_id = auth.uid()
        AND rp.left_at IS NULL
    )
);

-- ============================================================================
-- AUDIT LOGS POLICIES
-- ============================================================================

CREATE POLICY "Admins can view audit logs"
ON audit_logs FOR SELECT
USING (is_organization_admin(organization_id));

-- ============================================================================
-- USER PROFILES POLICIES
-- ============================================================================

CREATE POLICY "Users can view profiles"
ON user_profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT
WITH CHECK (id = auth.uid());

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to check subscription limits
CREATE OR REPLACE FUNCTION check_subscription_limit(
    p_organization_id UUID,
    p_resource_type VARCHAR,
    p_current_count INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan plans%ROWTYPE;
    v_limit INTEGER;
    v_count INTEGER;
BEGIN
    -- Get the organization's plan
    SELECT p.* INTO v_plan
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.organization_id = p_organization_id
    AND s.status IN ('active', 'trialing');

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Get the limit based on resource type
    CASE p_resource_type
        WHEN 'workspaces' THEN v_limit := v_plan.max_workspaces;
        WHEN 'rooms' THEN v_limit := v_plan.max_rooms;
        WHEN 'hosts' THEN v_limit := v_plan.max_hosts;
        WHEN 'viewers' THEN v_limit := v_plan.max_viewers_per_room;
        ELSE RETURN FALSE;
    END CASE;

    -- -1 means unlimited
    IF v_limit = -1 THEN
        RETURN TRUE;
    END IF;

    -- Use provided count or calculate
    IF p_current_count IS NOT NULL THEN
        v_count := p_current_count;
    ELSE
        CASE p_resource_type
            WHEN 'workspaces' THEN
                SELECT COUNT(*) INTO v_count FROM workspaces WHERE organization_id = p_organization_id;
            WHEN 'rooms' THEN
                SELECT COUNT(*) INTO v_count FROM rooms WHERE organization_id = p_organization_id;
            ELSE
                v_count := 0;
        END CASE;
    END IF;

    RETURN v_count < v_limit;
END;
$$;

-- Audit log trigger function
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Try to get organization_id from the record
    IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.organization_id;
    ELSE
        v_org_id := NEW.organization_id;
    END IF;

    INSERT INTO audit_logs (
        organization_id,
        user_id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values
    ) VALUES (
        v_org_id,
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Indexes for Performance

```sql
-- ============================================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_rooms_org_status ON rooms(organization_id, status);
CREATE INDEX idx_rooms_workspace_status ON rooms(workspace_id, status);
CREATE INDEX idx_participants_room_active ON room_participants(room_id) WHERE left_at IS NULL;
CREATE INDEX idx_messages_room_recent ON chat_messages(room_id, created_at DESC) WHERE NOT is_deleted;

-- Full-text search indexes
CREATE INDEX idx_rooms_name_search ON rooms USING gin(to_tsvector('english', name));
CREATE INDEX idx_messages_content_search ON chat_messages USING gin(to_tsvector('english', content));

-- JSONB indexes
CREATE INDEX idx_rooms_settings ON rooms USING gin(settings);
CREATE INDEX idx_orgs_settings ON organizations USING gin(settings);
```
