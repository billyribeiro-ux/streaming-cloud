<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateAlertRequest;
use App\Models\Alert;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Alert Controller - API endpoints for room alerts
 *
 * @group Alerts
 *
 * Endpoints for creating, listing, and managing alerts within rooms.
 * Only hosts and moderators can create alerts.
 */
class AlertController extends Controller
{
    /**
     * List alerts
     *
     * Get all alerts for a room.
     *
     * @response 200 scenario="Success" {
     *   "data": [...]
     * }
     */
    public function index(Request $request, Room $room): JsonResponse
    {
        $user = $request->user();

        if (!$this->userCanAccessRoom($user, $room)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $alerts = $room->alerts()
            ->with('user:id,name,display_name')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'data' => $alerts,
        ]);
    }

    /**
     * Create alert
     *
     * Create a new alert in a room. Only hosts and moderators can create alerts.
     *
     * @bodyParam type string required The alert type (info, warning, trade, announcement).
     * @bodyParam title string required The alert title. Max: 255 characters.
     * @bodyParam message string required The alert message. Max: 2000 characters.
     * @bodyParam priority string The alert priority (low, medium, high, urgent).
     *
     * @response 201 scenario="Created" {
     *   "data": {...},
     *   "message": "Alert created"
     * }
     * @response 403 scenario="Unauthorized" {
     *   "message": "Only hosts and moderators can create alerts"
     * }
     */
    public function store(CreateAlertRequest $request, Room $room): JsonResponse
    {
        $user = $request->user();

        if (!$this->userCanAccessRoom($user, $room)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        // Check if user is host or moderator
        $participant = $room->activeParticipants()
            ->where('user_id', $user->id)
            ->first();

        $workspaceMember = $room->workspace->members()
            ->where('user_id', $user->id)
            ->first();

        $isHostOrMod = ($participant && in_array($participant->role, ['host', 'co_host', 'moderator']))
            || ($workspaceMember && in_array($workspaceMember->role, ['admin', 'host', 'moderator']));

        if (!$isHostOrMod) {
            return response()->json([
                'message' => 'Only hosts and moderators can create alerts',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validated();

        $alert = Alert::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'type' => $validated['type'],
            'title' => $validated['title'],
            'message' => $validated['message'],
            'priority' => $validated['priority'] ?? 'medium',
        ]);

        $alert->load('user:id,name,display_name');

        return response()->json([
            'data' => $alert,
            'message' => 'Alert created',
        ], Response::HTTP_CREATED);
    }

    /**
     * Delete alert
     *
     * Delete an alert.
     *
     * @response 204 scenario="Deleted"
     */
    public function destroy(Request $request, Alert $alert): JsonResponse
    {
        $user = $request->user();
        $room = $alert->room;

        // Allow deletion by alert creator, host, or moderator
        if ($alert->user_id !== $user->id) {
            $participant = $room->activeParticipants()
                ->where('user_id', $user->id)
                ->first();

            $workspaceMember = $room->workspace->members()
                ->where('user_id', $user->id)
                ->first();

            $isHostOrMod = ($participant && in_array($participant->role, ['host', 'co_host', 'moderator']))
                || ($workspaceMember && in_array($workspaceMember->role, ['admin', 'host', 'moderator']));

            if (!$isHostOrMod) {
                return response()->json([
                    'message' => 'Unauthorized',
                ], Response::HTTP_FORBIDDEN);
            }
        }

        $alert->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
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
