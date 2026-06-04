-- Plans & subscriptions (B4 — billing).
-- Monetary amounts are stored as integer cents (idiomatic; avoids float/decimal).
-- `status` is a varchar (not an enum) so Stripe's status strings map directly.

CREATE TABLE plans (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    varchar(100) NOT NULL UNIQUE,
    display_name            varchar(255) NOT NULL,
    price_monthly_cents     integer NOT NULL DEFAULT 0,
    price_yearly_cents      integer NOT NULL DEFAULT 0,
    stripe_price_id_monthly varchar(255),
    stripe_price_id_yearly  varchar(255),
    max_workspaces          integer NOT NULL DEFAULT 1,
    max_rooms               integer NOT NULL DEFAULT 1,
    max_hosts_per_room      integer NOT NULL DEFAULT 1,
    max_viewers_per_room    integer NOT NULL DEFAULT 50,
    max_storage_gb          integer NOT NULL DEFAULT 1,
    features                jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active               boolean NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id        uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    plan_id                uuid REFERENCES plans (id),
    stripe_subscription_id varchar(255) UNIQUE,
    status                 varchar(20) NOT NULL DEFAULT 'incomplete',
    trial_ends_at          timestamptz,
    current_period_start   timestamptz,
    current_period_end     timestamptz,
    cancelled_at           timestamptz,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_org ON subscriptions (organization_id, status);
