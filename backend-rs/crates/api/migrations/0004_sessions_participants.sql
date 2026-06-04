-- Room sessions & participants (B2.5 — live lifecycle).

CREATE TABLE room_sessions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id      uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    host_user_id uuid REFERENCES users (id),
    started_at   timestamptz NOT NULL DEFAULT now(),
    ended_at     timestamptz,
    peak_viewers integer NOT NULL DEFAULT 0,
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_room_sessions_active ON room_sessions (room_id) WHERE ended_at IS NULL;

CREATE TABLE room_participants (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id          uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    session_id       uuid REFERENCES room_sessions (id) ON DELETE SET NULL,
    user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role             varchar(20) NOT NULL DEFAULT 'viewer',
    display_name     varchar(255),
    connection_state varchar(20) NOT NULL DEFAULT 'connecting',
    joined_at        timestamptz NOT NULL DEFAULT now(),
    left_at          timestamptz,
    metadata         jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_room_participants_active ON room_participants (room_id) WHERE left_at IS NULL;
