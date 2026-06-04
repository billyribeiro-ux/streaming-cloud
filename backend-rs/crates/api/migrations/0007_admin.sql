-- Platform administrators (B6 — admin tooling).
ALTER TABLE users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
