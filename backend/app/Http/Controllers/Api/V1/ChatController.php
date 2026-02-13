<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateChatMessageRequest;
use App\Http\Resources\ChatMessageResource;
use App\Models\ChatMessage;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Chat Controller - API endpoints for room chat messages
 *
 * @group Chat
 *
 * Endpoints for sending, retrieving, and managing chat messages within rooms.
 */
class ChatController extends Controller
{
    /**
     * List messages
     *
     * Get a paginated list of recent messages for a room, latest first.
     *
     * @queryParam per_page int Items per page. Default: 50
     *
     * @response 200 scenario="Success" {
     *   "data": [...],
     *   "meta": {"current_page": 1, "total": 200}
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

        $messages = $room->messages()
            ->with('user:id,name,display_name')
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json([
            'data' => ChatMessageResource::collection($messages),
            'meta' => [
                'current_page' => $messages->currentPage(),
                'last_page' => $messages->lastPage(),
                'per_page' => $messages->perPage(),
                'total' => $messages->total(),
            ],
        ]);
    }

    /**
     * Create message
     *
     * Post a new chat message in a room.
     *
     * @bodyParam content string required The message content. Max: 2000 characters.
     * @bodyParam type string The message type (text, alert). Default: text.
     *
     * @response 201 scenario="Created" {
     *   "data": {...},
     *   "message": "Message sent"
     * }
     */
    public function store(CreateChatMessageRequest $request, Room $room): JsonResponse
    {
        $user = $request->user();

        if (!$this->userCanAccessRoom($user, $room)) {
            return response()->json([
                'message' => 'Unauthorized',
            ], Response::HTTP_FORBIDDEN);
        }

        $chatAllowed = $room->getSetting('allow_chat', true);
        if (!$chatAllowed) {
            return response()->json([
                'message' => 'Chat is disabled for this room',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validated();

        $message = ChatMessage::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'content' => $validated['content'],
            'type' => $validated['type'] ?? 'text',
        ]);

        $message->load('user:id,name,display_name');

        return response()->json([
            'data' => new ChatMessageResource($message),
            'message' => 'Message sent',
        ], Response::HTTP_CREATED);
    }

    /**
     * Delete message
     *
     * Soft-delete a chat message by setting is_deleted to true.
     *
     * @response 200 scenario="Deleted" {
     *   "message": "Message deleted"
     * }
     */
    public function destroy(Request $request, ChatMessage $message): JsonResponse
    {
        $user = $request->user();

        // Allow deletion by message author or room host/moderator
        if ($message->user_id !== $user->id) {
            $room = $message->room;
            $participant = $room->activeParticipants()
                ->where('user_id', $user->id)
                ->first();

            if (!$participant || !in_array($participant->role, ['host', 'co_host', 'moderator'])) {
                return response()->json([
                    'message' => 'Unauthorized',
                ], Response::HTTP_FORBIDDEN);
            }
        }

        $message->update(['is_deleted' => true]);

        return response()->json([
            'message' => 'Message deleted',
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
