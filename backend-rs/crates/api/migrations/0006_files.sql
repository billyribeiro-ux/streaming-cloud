-- Room files (B3c — uploads stored in Cloudflare R2 via presigned URLs).

CREATE TABLE room_files (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    uploaded_by uuid NOT NULL REFERENCES users (id),
    file_name   varchar(255) NOT NULL,
    r2_key      varchar(512) NOT NULL,
    file_size   bigint NOT NULL DEFAULT 0,
    mime_type   varchar(255),
    is_deleted  boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_room_files_room ON room_files (room_id) WHERE is_deleted = false;
