<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Organization;
use App\Models\Room;
use Illuminate\Support\Facades\DB;

/**
 * Analytics Service - Provides aggregated analytics and statistics
 *
 * Responsibilities:
 * - Dashboard stats for organizations
 * - Per-room analytics and metrics
 * - Organization-level usage and growth stats
 * - Caches results for 5 minutes to reduce database load
 *
 * @package App\Services
 */
class AnalyticsService
{
    /**
     * Cache TTL in seconds (5 minutes).
     */
    private const CACHE_TTL = 300;

    public function __construct(
        private readonly CacheService $cacheService
    ) {}

    /**
     * Get dashboard statistics for an organization.
     *
     * @param Organization $org The organization to get stats for
     * @return array{total_rooms: int, active_rooms: int, total_participants_today: int, revenue_this_month: float, avg_session_duration_seconds: float, peak_concurrent_viewers: int}
     */
    public function getDashboardStats(Organization $org): array
    {
        return $this->cacheService->remember(
            "analytics:dashboard:{$org->id}",
            self::CACHE_TTL,
            function () use ($org) {
                $totalRooms = DB::table('rooms')
                    ->where('organization_id', $org->id)
                    ->count();

                $activeRooms = DB::table('rooms')
                    ->where('organization_id', $org->id)
                    ->where('status', Room::STATUS_LIVE)
                    ->count();

                $totalParticipantsToday = DB::table('room_participants')
                    ->join('rooms', 'room_participants.room_id', '=', 'rooms.id')
                    ->where('rooms.organization_id', $org->id)
                    ->where('room_participants.joined_at', '>=', now()->startOfDay())
                    ->distinct('room_participants.user_id')
                    ->count('room_participants.user_id');

                $revenueThisMonth = (float) DB::table('subscriptions')
                    ->join('plans', 'subscriptions.plan_id', '=', 'plans.id')
                    ->where('subscriptions.organization_id', $org->id)
                    ->whereIn('subscriptions.status', ['active', 'trialing'])
                    ->where('subscriptions.current_period_start', '>=', now()->startOfMonth())
                    ->sum('plans.price_monthly');

                $avgSessionDuration = (float) DB::table('room_sessions')
                    ->join('rooms', 'room_sessions.room_id', '=', 'rooms.id')
                    ->where('rooms.organization_id', $org->id)
                    ->whereNotNull('room_sessions.ended_at')
                    ->selectRaw('AVG(TIMESTAMPDIFF(SECOND, room_sessions.started_at, room_sessions.ended_at)) as avg_duration')
                    ->value('avg_duration') ?? 0.0;

                $peakConcurrentViewers = (int) DB::table('rooms')
                    ->where('organization_id', $org->id)
                    ->sum('peak_participants');

                return [
                    'total_rooms' => $totalRooms,
                    'active_rooms' => $activeRooms,
                    'total_participants_today' => $totalParticipantsToday,
                    'revenue_this_month' => round($revenueThisMonth, 2),
                    'avg_session_duration_seconds' => round($avgSessionDuration, 2),
                    'peak_concurrent_viewers' => $peakConcurrentViewers,
                ];
            }
        );
    }

    /**
     * Get statistics for a specific room.
     *
     * @param Room $room The room to get stats for
     * @return array{total_sessions: int, total_participants: int, avg_duration_seconds: float, peak_viewers: int, chat_message_count: int, participant_breakdown: array}
     */
    public function getRoomStats(Room $room): array
    {
        return $this->cacheService->remember(
            "analytics:room:{$room->id}",
            self::CACHE_TTL,
            function () use ($room) {
                $totalSessions = DB::table('room_sessions')
                    ->where('room_id', $room->id)
                    ->count();

                $totalParticipants = DB::table('room_participants')
                    ->where('room_id', $room->id)
                    ->distinct('user_id')
                    ->count('user_id');

                $avgDuration = (float) DB::table('room_sessions')
                    ->where('room_id', $room->id)
                    ->whereNotNull('ended_at')
                    ->selectRaw('AVG(TIMESTAMPDIFF(SECOND, started_at, ended_at)) as avg_duration')
                    ->value('avg_duration') ?? 0.0;

                $peakViewers = (int) DB::table('room_sessions')
                    ->where('room_id', $room->id)
                    ->max('peak_viewers') ?? 0;

                $chatMessageCount = DB::table('chat_messages')
                    ->where('room_id', $room->id)
                    ->where('is_deleted', false)
                    ->count();

                $participantBreakdown = DB::table('room_participants')
                    ->where('room_id', $room->id)
                    ->select('role', DB::raw('COUNT(*) as count'))
                    ->groupBy('role')
                    ->pluck('count', 'role')
                    ->toArray();

                return [
                    'total_sessions' => $totalSessions,
                    'total_participants' => $totalParticipants,
                    'avg_duration_seconds' => round($avgDuration, 2),
                    'peak_viewers' => $peakViewers,
                    'chat_message_count' => $chatMessageCount,
                    'participant_breakdown' => $participantBreakdown,
                ];
            }
        );
    }

    /**
     * Get organization-level statistics.
     *
     * @param Organization $org The organization to get stats for
     * @return array{room_usage_last_30_days: array, storage_usage_bytes: int, storage_limit_bytes: int, member_growth: array}
     */
    public function getOrganizationStats(Organization $org): array
    {
        return $this->cacheService->remember(
            "analytics:org:{$org->id}",
            self::CACHE_TTL,
            function () use ($org) {
                // Room usage over the last 30 days (daily session count)
                $roomUsage = DB::table('room_sessions')
                    ->join('rooms', 'room_sessions.room_id', '=', 'rooms.id')
                    ->where('rooms.organization_id', $org->id)
                    ->where('room_sessions.started_at', '>=', now()->subDays(30))
                    ->select(
                        DB::raw('DATE(room_sessions.started_at) as date'),
                        DB::raw('COUNT(*) as sessions'),
                    )
                    ->groupBy('date')
                    ->orderBy('date', 'asc')
                    ->get()
                    ->map(fn ($row) => [
                        'date' => $row->date,
                        'sessions' => (int) $row->sessions,
                    ])
                    ->toArray();

                // Storage usage
                $storageUsageBytes = (int) DB::table('room_files')
                    ->join('rooms', 'room_files.room_id', '=', 'rooms.id')
                    ->where('rooms.organization_id', $org->id)
                    ->where('room_files.is_deleted', false)
                    ->sum('room_files.file_size');

                $plan = $org->getPlan();
                $storageLimitBytes = $plan
                    ? $plan->max_storage_gb * 1024 * 1024 * 1024
                    : 0;

                // Member growth over the last 30 days
                $memberGrowth = DB::table('organization_members')
                    ->where('organization_id', $org->id)
                    ->where('created_at', '>=', now()->subDays(30))
                    ->select(
                        DB::raw('DATE(created_at) as date'),
                        DB::raw('COUNT(*) as new_members'),
                    )
                    ->groupBy('date')
                    ->orderBy('date', 'asc')
                    ->get()
                    ->map(fn ($row) => [
                        'date' => $row->date,
                        'new_members' => (int) $row->new_members,
                    ])
                    ->toArray();

                return [
                    'room_usage_last_30_days' => $roomUsage,
                    'storage_usage_bytes' => $storageUsageBytes,
                    'storage_limit_bytes' => $storageLimitBytes,
                    'member_growth' => $memberGrowth,
                ];
            }
        );
    }
}
