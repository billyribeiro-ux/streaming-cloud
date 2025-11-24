<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateRoomRequest;
use App\Http\Requests\UpdateRoomRequest;
use App\Http\Requests\JoinRoomRequest;
use App\Http\Resources\RoomResource;
use App\Http\Resources\RoomCollection;
use App\Http\Resources\ParticipantResource;
use App\Models\Organization;
use App\Models\Room;
use App\Models\Workspace;
use App\Services\RoomService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * Room Controller - API endpoints for room management
 *
 * @group Rooms
 *
 * Endpoints for creating, managing, and joining streaming rooms.
 */
class RoomController extends Controller
{
    public function __construct(
        private readonly RoomService $roomService
    ) {}

    /**
     * List rooms
     *
     * Get a paginated list of rooms for the organization.
     *
     * @queryParam workspace_id string Filter by workspace ID.
     * @queryParam status string Filter by status (scheduled, live, ended).
     * @queryParam per_page int Items per page. Default: 20
     *
     * @response 200 scenario="Success" {
     *   "data": [...],
     *   "meta": {"current_page": 1, "total": 50}
     * }
     */
    public function index(Request $request, Organization $organization): RoomCollection
    {
        Gate::authorize('view', $organization);

        $query = Room::forOrganization($organization->id)
            ->with(['workspace:id,name', 'creator:id,email']);

        if ($request->has('workspace_id')) {
            $query->where('workspace_id', $request->workspace_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $rooms = $query
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        return new RoomCollection($rooms);
    }

    /**
     * Create a room
     *
     * Create a new streaming room in a workspace.
     *
     * @bodyParam workspace_id string required The workspace ID.
     * @bodyParam name string required The room name. Max: 255 characters.
     * @bodyParam description string The room description.
     * @bodyParam scheduled_start datetime When the room is scheduled to start.
     * @bodyParam scheduled_end datetime When the room is scheduled to end.
     * @bodyParam settings object Room settings (max_participants, allow_chat, etc.).
     *
     * @response 201 scenario="Created" {
     *   "data": {
     *     "id": "uuid",
     *     "name": "Morning Trading Session",
     *     "status": "scheduled"
     *   }
     * }
     * @response 422 scenario="Validation Error" {"message": "...", "errors": {...}}
     * @response 403 scenario="Limit Reached" {"message": "Room limit reached"}
     */
    public function store(
        CreateRoomRequest $request,
        Organization $organization
    ): JsonResponse {
        $workspace = Workspace::findOrFail($request->workspace_id);

        Gate::authorize('create', [Room::class, $workspace]);

        $room = $this->roomService->create(
            $workspace,
            $request->user(),
            $request->validated()
        );

        return (new RoomResource($room))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Get room details
     *
     * Retrieve detailed information about a specific room.
     *
     * @response 200 scenario="Success" {
     *   "data": {
     *     "id": "uuid",
     *     "name": "Morning Trading Session",
     *     "status": "live",
     *     "participants_count": 45
     *   }
     * }
     */
    public function show(Organization $organization, Room $room): RoomResource
    {
        Gate::authorize('view', $room);

        $room->load([
            'workspace:id,name',
            'creator:id,email',
            'creator.profile:id,display_name,avatar_url',
        ]);

        $room->loadCount('activeParticipants');

        return new RoomResource($room);
    }

    /**
     * Update a room
     *
     * Update room details and settings.
     *
     * @bodyParam name string The room name.
     * @bodyParam description string The room description.
     * @bodyParam settings object Updated room settings.
     *
     * @response 200 scenario="Updated" {"data": {...}}
     */
    public function update(
        UpdateRoomRequest $request,
        Organization $organization,
        Room $room
    ): RoomResource {
        Gate::authorize('update', $room);

        $room = $this->roomService->update(
            $room,
            $request->user(),
            $request->validated()
        );

        return new RoomResource($room);
    }

    /**
     * Delete a room
     *
     * Permanently delete a room. Cannot delete live rooms.
     *
     * @response 204 scenario="Deleted"
     * @response 422 scenario="Cannot Delete" {"message": "Cannot delete a live room"}
     */
    public function destroy(
        Organization $organization,
        Room $room
    ): JsonResponse {
        Gate::authorize('delete', $room);

        if ($room->isLive()) {
            return response()->json([
                'message' => 'Cannot delete a live room. End the stream first.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $room->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Start room stream
     *
     * Start streaming in a room. Only hosts can start streams.
     *
     * @response 200 scenario="Started" {
     *   "data": {
     *     "session_id": "uuid",
     *     "sfu_node": "sfu-1.example.com",
     *     "router_id": "router-abc"
     *   }
     * }
     * @response 403 scenario="Unauthorized" {"message": "Not authorized to stream"}
     * @response 422 scenario="Already Live" {"message": "Room is already live"}
     */
    public function start(
        Request $request,
        Organization $organization,
        Room $room
    ): JsonResponse {
        Gate::authorize('stream', $room);

        $result = $this->roomService->startStream($room, $request->user());

        return response()->json([
            'data' => [
                'session_id' => $result['session']->id,
                'sfu_node' => $result['sfu']['node'],
                'router_id' => $result['sfu']['routerId'],
                'ice_servers' => $result['sfu']['iceServers'] ?? [],
            ],
        ]);
    }

    /**
     * End room stream
     *
     * End the active stream in a room.
     *
     * @response 200 scenario="Ended" {"message": "Stream ended successfully"}
     */
    public function end(
        Request $request,
        Organization $organization,
        Room $room
    ): JsonResponse {
        Gate::authorize('stream', $room);

        $this->roomService->endStream($room, $request->user());

        return response()->json([
            'message' => 'Stream ended successfully',
        ]);
    }

    /**
     * Join room
     *
     * Join a room as a participant. Returns connection details.
     *
     * @bodyParam device_info object Device information for analytics.
     *
     * @response 200 scenario="Joined" {
     *   "data": {
     *     "participant_id": "uuid",
     *     "role": "viewer",
     *     "signaling_url": "wss://signaling.example.com",
     *     "token": "jwt-token"
     *   }
     * }
     */
    public function join(
        JoinRoomRequest $request,
        Organization $organization,
        Room $room
    ): JsonResponse {
        Gate::authorize('join', $room);

        $user = $request->user();
        $deviceInfo = $request->get('device_info', []);

        // Determine role based on workspace membership
        $workspaceMember = $room->workspace->members()
            ->where('user_id', $user->id)
            ->first();

        $role = match ($workspaceMember?->pivot?->role) {
            'admin', 'host' => 'host',
            'co_host' => 'co_host',
            'moderator' => 'moderator',
            default => 'viewer',
        };

        $participant = $this->roomService->addParticipant(
            $room,
            $user,
            $role,
            $deviceInfo
        );

        // Generate signaling token
        $signalingToken = app('App\Services\SignalingService')
            ->generateToken($room, $user, $participant);

        return response()->json([
            'data' => [
                'participant_id' => $participant->id,
                'role' => $participant->role,
                'signaling_url' => config('services.signaling.url'),
                'token' => $signalingToken,
                'room' => new RoomResource($room),
            ],
        ]);
    }

    /**
     * Leave room
     *
     * Leave a room as a participant.
     *
     * @response 200 scenario="Left" {"message": "Left room successfully"}
     */
    public function leave(
        Request $request,
        Organization $organization,
        Room $room
    ): JsonResponse {
        $this->roomService->removeParticipant($room, $request->user());

        return response()->json([
            'message' => 'Left room successfully',
        ]);
    }

    /**
     * Get room participants
     *
     * Get list of active participants in a room.
     *
     * @response 200 scenario="Success" {
     *   "data": [
     *     {"id": "uuid", "display_name": "John", "role": "host"}
     *   ]
     * }
     */
    public function participants(
        Organization $organization,
        Room $room
    ): JsonResponse {
        Gate::authorize('view', $room);

        $participants = $this->roomService->getParticipants($room);

        return response()->json([
            'data' => $participants,
        ]);
    }

    /**
     * Moderate participant
     *
     * Perform moderation action on a participant (mute, kick).
     *
     * @bodyParam user_id string required The target user ID.
     * @bodyParam action string required The action (mute_audio, mute_video, kick).
     *
     * @response 200 scenario="Success" {"message": "Action performed successfully"}
     */
    public function moderate(
        Request $request,
        Organization $organization,
        Room $room
    ): JsonResponse {
        Gate::authorize('moderate', $room);

        $request->validate([
            'user_id' => 'required|uuid|exists:users,id',
            'action' => 'required|in:mute_audio,mute_video,kick',
        ]);

        $targetUser = \App\Models\User::findOrFail($request->user_id);

        $this->roomService->moderateParticipant(
            $room,
            $request->user(),
            $targetUser,
            $request->action
        );

        return response()->json([
            'message' => 'Action performed successfully',
        ]);
    }

    /**
     * Get live rooms
     *
     * Get all currently live rooms for the organization.
     *
     * @response 200 scenario="Success" {"data": [...]}
     */
    public function live(Organization $organization): RoomCollection
    {
        Gate::authorize('view', $organization);

        $rooms = Room::forOrganization($organization->id)
            ->live()
            ->with(['workspace:id,name'])
            ->withCount('activeParticipants')
            ->get();

        return new RoomCollection($rooms);
    }

    /**
     * Get upcoming rooms
     *
     * Get scheduled rooms for the organization.
     *
     * @response 200 scenario="Success" {"data": [...]}
     */
    public function upcoming(Organization $organization): RoomCollection
    {
        Gate::authorize('view', $organization);

        $rooms = Room::forOrganization($organization->id)
            ->upcoming()
            ->with(['workspace:id,name', 'creator:id,email'])
            ->limit(10)
            ->get();

        return new RoomCollection($rooms);
    }
}
