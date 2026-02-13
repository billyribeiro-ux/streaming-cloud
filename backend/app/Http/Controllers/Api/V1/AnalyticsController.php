<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Room;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Analytics Controller - API endpoints for analytics and statistics
 *
 * @group Analytics
 *
 * Endpoints for retrieving dashboard, room, and organization-level analytics.
 */
class AnalyticsController extends Controller
{
    public function __construct(
        private readonly AnalyticsService $analyticsService
    ) {}

    /**
     * Organization dashboard stats.
     *
     * Returns aggregated statistics for the authenticated user's organization:
     * total rooms, active rooms, total participants today, revenue this month,
     * average session duration, and peak concurrent viewers.
     *
     * @response 200 scenario="Success" {
     *   "data": {
     *     "total_rooms": 25,
     *     "active_rooms": 3,
     *     "total_participants_today": 142,
     *     "revenue_this_month": 299.00,
     *     "avg_session_duration_seconds": 3600.50,
     *     "peak_concurrent_viewers": 87
     *   }
     * }
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        $organization = $user->organizations()->first();

        if (!$organization) {
            return response()->json([
                'message' => 'No organization found for user.',
            ], Response::HTTP_NOT_FOUND);
        }

        $stats = $this->analyticsService->getDashboardStats($organization);

        return response()->json([
            'data' => $stats,
        ]);
    }

    /**
     * Per-room analytics.
     *
     * Returns detailed statistics for a specific room: total sessions,
     * total participants, average duration, peak viewers, chat message count,
     * and participant breakdown by role.
     *
     * @response 200 scenario="Success" {
     *   "data": {
     *     "total_sessions": 12,
     *     "total_participants": 340,
     *     "avg_duration_seconds": 5400.00,
     *     "peak_viewers": 65,
     *     "chat_message_count": 1200,
     *     "participant_breakdown": {"host": 12, "viewer": 320, "moderator": 8}
     *   }
     * }
     */
    public function roomStats(Request $request, Room $room): JsonResponse
    {
        $user = $request->user();

        if (!$this->userCanAccessRoom($user, $room)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $stats = $this->analyticsService->getRoomStats($room);

        return response()->json([
            'data' => $stats,
        ]);
    }

    /**
     * Organization-level statistics.
     *
     * Returns organization-wide analytics: room usage over the last 30 days,
     * storage usage vs. limit, and member growth.
     *
     * @response 200 scenario="Success" {
     *   "data": {
     *     "room_usage_last_30_days": [{"date": "2024-01-01", "sessions": 5}],
     *     "storage_usage_bytes": 5368709120,
     *     "storage_limit_bytes": 107374182400,
     *     "member_growth": [{"date": "2024-01-01", "new_members": 3}]
     *   }
     * }
     */
    public function organizationStats(Request $request, Organization $organization): JsonResponse
    {
        $user = $request->user();

        $isMember = $organization->members()
            ->where('user_id', $user->id)
            ->exists();

        if (!$isMember) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $stats = $this->analyticsService->getOrganizationStats($organization);

        return response()->json([
            'data' => $stats,
        ]);
    }

    /**
     * Check if a user can access the room.
     */
    private function userCanAccessRoom($user, Room $room): bool
    {
        return $room->organization->members()
            ->where('user_id', $user->id)
            ->exists();
    }
}
