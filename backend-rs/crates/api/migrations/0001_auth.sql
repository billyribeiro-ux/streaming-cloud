-- Auth-domain schema (B1). Mirrors the Laravel-managed tables so the Rust
-- service can stand up its own database for integration tests; in production
-- the schema is owned by the shared (Laravel-migrated) database during cutover.

CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE users (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email             varchar(255) NOT NULL UNIQUE,
    password          varchar(255) NOT NULL,
    name              varchar(255) NOT NULL,
    display_name      varchar(255),
    avatar_url        text,
    timezone          varchar(64),
    preferences       jsonb NOT NULL DEFAULT '{}'::jsonb,
    email_verified_at timestamptz,
    last_login_at     timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    deleted_at        timestamptz
);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_deleted_at ON users (deleted_at);

CREATE TABLE organizations (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name               varchar(255) NOT NULL,
    slug               varchar(255) NOT NULL UNIQUE,
    logo_url           text,
    settings           jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
    stripe_customer_id varchar(255),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_organizations_stripe_customer ON organizations (stripe_customer_id);

CREATE TABLE organization_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role            organization_role NOT NULL DEFAULT 'member',
    invited_at      timestamptz,
    accepted_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, user_id)
);

CREATE TABLE personal_access_tokens (
    id             bigserial PRIMARY KEY,
    tokenable_type varchar(255) NOT NULL,
    tokenable_id   uuid NOT NULL,
    name           varchar(255) NOT NULL,
    token          varchar(64) NOT NULL UNIQUE,
    abilities      text,
    last_used_at   timestamptz,
    expires_at     timestamptz,
    created_at     timestamptz,
    updated_at     timestamptz
);
CREATE INDEX idx_pat_tokenable ON personal_access_tokens (tokenable_type, tokenable_id);
