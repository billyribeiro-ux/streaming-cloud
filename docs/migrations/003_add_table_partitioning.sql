/**
 * Database Partitioning Strategy
 *
 * Implements range partitioning for large tables (>10M records) to improve:
 * - Query performance (partition pruning)
 * - Maintenance operations (VACUUM, REINDEX)
 * - Data lifecycle management (easy archival/deletion)
 *
 * PostgreSQL 12+ Declarative Partitioning
 *
 * Apply after reaching significant data volume:
 * - messages: Partition by month (high write rate)
 * - room_participants: Partition by quarter (medium write rate)
 * - audit_logs: Partition by month (high write rate)
 */

-- ============================================================================
-- 1. MESSAGES TABLE PARTITIONING (BY MONTH)
-- ============================================================================

-- Create partitioned messages table
CREATE TABLE IF NOT EXISTS messages_partitioned (
    id BIGSERIAL NOT NULL,
    room_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create indexes on partitioned table
CREATE INDEX idx_messages_part_room ON messages_partitioned(room_id, created_at DESC);
CREATE INDEX idx_messages_part_user ON messages_partitioned(user_id, created_at DESC);
CREATE INDEX idx_messages_part_org ON messages_partitioned(organization_id, created_at DESC);
CREATE INDEX idx_messages_part_search ON messages_partitioned USING gin(to_tsvector('english', content));

-- Create monthly partitions for current year
CREATE TABLE messages_2025_01 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE messages_2025_02 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE messages_2025_03 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE messages_2025_04 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE messages_2025_05 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE messages_2025_06 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE messages_2025_07 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE messages_2025_08 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE messages_2025_09 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE messages_2025_10 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE messages_2025_11 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE messages_2025_12 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Default partition for future dates
CREATE TABLE messages_default PARTITION OF messages_partitioned DEFAULT;

-- ============================================================================
-- 2. ROOM_PARTICIPANTS PARTITIONING (BY QUARTER)
-- ============================================================================

CREATE TABLE IF NOT EXISTS room_participants_partitioned (
    id BIGSERIAL NOT NULL,
    room_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(50) DEFAULT 'participant',
    status VARCHAR(50) DEFAULT 'active',
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    left_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_room_participants_part_room ON room_participants_partitioned(room_id, status);
CREATE INDEX idx_room_participants_part_user ON room_participants_partitioned(user_id, status);
CREATE INDEX idx_room_participants_part_active ON room_participants_partitioned(room_id, created_at DESC) WHERE status = 'active';

-- Create quarterly partitions
CREATE TABLE room_participants_2025_q1 PARTITION OF room_participants_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

CREATE TABLE room_participants_2025_q2 PARTITION OF room_participants_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');

CREATE TABLE room_participants_2025_q3 PARTITION OF room_participants_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');

CREATE TABLE room_participants_2025_q4 PARTITION OF room_participants_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

CREATE TABLE room_participants_default PARTITION OF room_participants_partitioned DEFAULT;

-- ============================================================================
-- 3. AUDIT_LOGS PARTITIONING (BY MONTH)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
    id BIGSERIAL NOT NULL,
    organization_id BIGINT NOT NULL,
    user_id BIGINT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id BIGINT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_audit_logs_part_org ON audit_logs_partitioned(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_part_user ON audit_logs_partitioned(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_part_action ON audit_logs_partitioned(action, created_at DESC);
CREATE INDEX idx_audit_logs_part_entity ON audit_logs_partitioned(entity_type, entity_id, created_at DESC);

-- Create monthly partitions (same as messages)
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE audit_logs_2025_03 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE audit_logs_2025_04 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE audit_logs_2025_05 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE audit_logs_2025_06 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE audit_logs_2025_07 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE audit_logs_2025_08 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE audit_logs_2025_09 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE audit_logs_2025_10 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE audit_logs_2025_11 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE audit_logs_2025_12 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE audit_logs_default PARTITION OF audit_logs_partitioned DEFAULT;

-- ============================================================================
-- 4. AUTOMATIC PARTITION CREATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_monthly_partitions(
    base_table TEXT,
    start_date DATE,
    end_date DATE
)
RETURNS VOID AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    partition_start DATE;
    partition_end DATE;
BEGIN
    partition_date := start_date;

    WHILE partition_date < end_date LOOP
        partition_start := partition_date;
        partition_end := partition_date + INTERVAL '1 month';
        partition_name := base_table || '_' || to_char(partition_date, 'YYYY_MM');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            base_table,
            partition_start,
            partition_end
        );

        RAISE NOTICE 'Created partition: %', partition_name;

        partition_date := partition_end;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. PARTITION MAINTENANCE SCHEDULE
-- ============================================================================

-- Schedule automatic partition creation for next 6 months
-- Run this monthly via cron:
-- SELECT create_monthly_partitions('messages_partitioned', '2026-01-01', '2026-07-01');
-- SELECT create_monthly_partitions('audit_logs_partitioned', '2026-01-01', '2026-07-01');

-- ============================================================================
-- 6. MIGRATION STRATEGY (ZERO DOWNTIME)
-- ============================================================================

/**
 * To migrate existing data:
 *
 * 1. Create partitioned tables (done above)
 * 2. Copy data in batches (avoid locking):
 *    INSERT INTO messages_partitioned SELECT * FROM messages WHERE created_at >= '2025-01-01' AND created_at < '2025-02-01';
 *
 * 3. Rename tables (atomic swap):
 *    BEGIN;
 *    ALTER TABLE messages RENAME TO messages_old;
 *    ALTER TABLE messages_partitioned RENAME TO messages;
 *    COMMIT;
 *
 * 4. Update application code (if needed)
 * 5. Verify queries work
 * 6. Drop old table: DROP TABLE messages_old;
 */

-- ============================================================================
-- 7. QUERY EXAMPLES WITH PARTITION PRUNING
-- ============================================================================

-- ✅ GOOD: Query pruned to single partition
-- EXPLAIN SELECT * FROM messages_partitioned WHERE created_at >= '2025-01-01' AND created_at < '2025-02-01';

-- ❌ BAD: Full scan across all partitions
-- EXPLAIN SELECT * FROM messages_partitioned WHERE user_id = 123;

-- ✅ GOOD: Partition pruning + index scan
-- EXPLAIN SELECT * FROM messages_partitioned WHERE room_id = 456 AND created_at >= '2025-01-01' AND created_at < '2025-02-01';

-- ============================================================================
-- 8. PERFORMANCE EXPECTATIONS
-- ============================================================================

/**
 * Expected Performance Improvements:
 * - Query Speed: 5-10x faster for time-range queries
 * - VACUUM Time: 90% reduction (per-partition vs full table)
 * - Index Build: 80% faster (smaller partition indexes)
 * - Archival: Instant (DROP/DETACH partition instead of DELETE)
 * - Maintenance Window: Near-zero (per-partition operations)
 *
 * When to Apply:
 * - messages table > 10M rows
 * - audit_logs table > 50M rows
 * - Query performance degrades
 * - VACUUM takes > 1 hour
 */

-- ============================================================================
-- 9. MONITORING PARTITION HEALTH
-- ============================================================================

-- Check partition sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS bytes
FROM pg_tables
WHERE tablename LIKE 'messages_2025%'
ORDER BY bytes DESC;

-- Check partition boundaries
SELECT
    child.relname AS partition_name,
    pg_get_expr(child.relpartbound, child.oid) AS partition_expression
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'messages_partitioned'
ORDER BY child.relname;
