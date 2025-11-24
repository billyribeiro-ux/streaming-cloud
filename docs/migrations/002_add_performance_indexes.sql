-- ============================================================================
-- PERFORMANCE INDEXES MIGRATION
-- ============================================================================
-- Version: 1.0.0
-- Priority: P0 CRITICAL
-- Estimated Impact: 10-50x query performance improvement
-- Estimated Time: 5-10 minutes
-- ============================================================================

-- ============================================================================
-- ROOMS TABLE INDEXES
-- ============================================================================

-- Most common query: Get live rooms by organization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_org_status
    ON rooms(organization_id, status);

-- Get rooms by workspace and status (used in room listing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_workspace_status
    ON rooms(workspace_id, status);

-- Partial index for live rooms only (hot path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_live
    ON rooms(organization_id, created_at DESC)
    WHERE status = 'live';

-- Upcoming rooms query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_upcoming
    ON rooms(organization_id, scheduled_start)
    WHERE status = 'scheduled' AND scheduled_start >= NOW();

-- Covering index for room list (avoids table lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_list_covering
    ON rooms(organization_id, created_at DESC)
    INCLUDE (id, name, status, scheduled_start, slug);

-- ============================================================================
-- ROOM PARTICIPANTS TABLE INDEXES
-- ============================================================================

-- Get participants for a room (most frequent query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_participants_room_user
    ON room_participants(room_id, user_id);

-- Get active participants only (WHERE left_at IS NULL)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_participants_active
    ON room_participants(room_id, joined_at DESC)
    WHERE left_at IS NULL;

-- Get user's active participations across rooms
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_participants_user_active
    ON room_participants(user_id)
    WHERE left_at IS NULL;

-- Session participants
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_participants_session
    ON room_participants(session_id, joined_at);

-- ============================================================================
-- ROOM SESSIONS TABLE INDEXES
-- ============================================================================

-- Get active session for a room
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_sessions_room_active
    ON room_sessions(room_id, started_at DESC)
    WHERE ended_at IS NULL;

-- Host's sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_sessions_host
    ON room_sessions(host_user_id, started_at DESC);

-- ============================================================================
-- CHAT MESSAGES TABLE INDEXES
-- ============================================================================

-- Get messages for a room (with pagination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_room_created
    ON chat_messages(room_id, created_at DESC);

-- Get messages by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_user
    ON chat_messages(user_id, created_at DESC);

-- ============================================================================
-- SUBSCRIPTIONS TABLE INDEXES
-- ============================================================================

-- Get organization subscription (very frequent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_org_status
    ON subscriptions(organization_id, status);

-- Active subscriptions only (partial index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_active
    ON subscriptions(organization_id)
    WHERE status = 'active';

-- Stripe webhook lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_stripe
    ON subscriptions(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

-- Period end for renewal processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_renewal
    ON subscriptions(current_period_end)
    WHERE status IN ('active', 'trialing');

-- ============================================================================
-- ORGANIZATION MEMBERS TABLE INDEXES
-- ============================================================================

-- Get members by organization (very frequent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_org_role
    ON organization_members(organization_id, role);

-- Get organizations for a user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_user
    ON organization_members(user_id, accepted_at);

-- Pending invitations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_pending
    ON organization_members(organization_id)
    WHERE accepted_at IS NULL;

-- ============================================================================
-- WORKSPACE MEMBERS TABLE INDEXES
-- ============================================================================

-- Get workspace members
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_workspace_role
    ON workspace_members(workspace_id, role);

-- Get user's workspaces
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_user
    ON workspace_members(user_id);

-- ============================================================================
-- AUDIT LOGS TABLE INDEXES
-- ============================================================================

-- Get audit logs by organization (with pagination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_org_created
    ON audit_logs(organization_id, created_at DESC);

-- Get logs by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user
    ON audit_logs(user_id, created_at DESC);

-- Get logs by resource
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource
    ON audit_logs(resource_type, resource_id, created_at DESC);

-- ============================================================================
-- ALERTS TABLE INDEXES
-- ============================================================================

-- Get alerts by room
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_room_priority
    ON alerts(room_id, priority, created_at DESC);

-- User-specific alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_user
    ON alerts(user_id, created_at DESC);

-- ============================================================================
-- ROOM FILES TABLE INDEXES
-- ============================================================================

-- Get files by room
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_files_room
    ON room_files(room_id, created_at DESC);

-- Get files by uploader
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_files_uploader
    ON room_files(uploaded_by, created_at DESC);

-- ============================================================================
-- WORKSPACES TABLE INDEXES
-- ============================================================================

-- Get workspaces by organization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_org_active
    ON workspaces(organization_id, is_active);

-- ============================================================================
-- ORGANIZATIONS TABLE INDEXES
-- ============================================================================

-- Stripe customer lookup (webhook processing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_stripe
    ON organizations(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries to verify indexes were created:
/*
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check index usage:
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check for missing indexes:
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY abs(correlation) ASC;
*/

-- ============================================================================
-- MAINTENANCE
-- ============================================================================

-- Analyze tables after creating indexes
ANALYZE rooms;
ANALYZE room_participants;
ANALYZE room_sessions;
ANALYZE chat_messages;
ANALYZE subscriptions;
ANALYZE organization_members;
ANALYZE workspace_members;
ANALYZE audit_logs;
ANALYZE alerts;
ANALYZE room_files;
ANALYZE workspaces;
ANALYZE organizations;

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- * CONCURRENTLY allows index creation without locking tables
-- * Partial indexes (WHERE clause) reduce index size for filtered queries
-- * INCLUDE clause creates covering indexes (index-only scans)
-- * Composite indexes order matters: most selective column first
--
-- Performance Impact Estimate:
-- - Room queries: 10-20x faster
-- - Participant queries: 15-30x faster
-- - Chat queries: 5-10x faster
-- - Subscription checks: 20-40x faster
--
-- ============================================================================
