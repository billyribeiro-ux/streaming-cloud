-- Workspaces & rooms domain (B2).

CREATE TYPE workspace_role AS ENUM ('admin', 'host', 'co_host', 'moderator', 'viewer');
CREATE TYPE room_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');

CREATE TABLE workspaces (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name            varchar(255) NOT NULL,
    description     text,
    slug            varchar(255) NOT NULL,
    settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, slug)
);
CREATE INDEX idx_workspaces_org ON workspaces (organization_id);

CREATE TABLE workspace_members (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role         workspace_role NOT NULL DEFAULT 'viewer',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, user_id)
);

CREATE TABLE rooms (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id           uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    organization_id        uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name                   varchar(255) NOT NULL,
    description            text,
    slug                   varchar(255) NOT NULL UNIQUE,
    status                 room_status NOT NULL DEFAULT 'scheduled',
    settings               jsonb NOT NULL DEFAULT '{}'::jsonb,
    scheduled_start        timestamptz,
    scheduled_end          timestamptz,
    actual_start           timestamptz,
    actual_end             timestamptz,
    thumbnail_url          text,
    recording_enabled      boolean NOT NULL DEFAULT false,
    total_participants     integer NOT NULL DEFAULT 0,
    peak_participants      integer NOT NULL DEFAULT 0,
    total_duration_minutes integer NOT NULL DEFAULT 0,
    is_public              boolean NOT NULL DEFAULT false,
    created_by             uuid NOT NULL REFERENCES users (id),
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rooms_org_status ON rooms (organization_id, status);
CREATE INDEX idx_rooms_workspace_status ON rooms (workspace_id, status);
CREATE INDEX idx_rooms_public ON rooms (is_public) WHERE is_public;
