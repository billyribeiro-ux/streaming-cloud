-- Chat messages & alerts domain (B3a).

CREATE TABLE chat_messages (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id    uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content    text NOT NULL,
    type       varchar(20) NOT NULL DEFAULT 'text',
    metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_room_created ON chat_messages (room_id, created_at);

CREATE TABLE alerts (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id    uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type       varchar(20) NOT NULL DEFAULT 'info',
    title      varchar(255) NOT NULL,
    message    text NOT NULL,
    priority   varchar(20) NOT NULL DEFAULT 'medium',
    metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_room ON alerts (room_id, created_at);
