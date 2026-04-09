<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SignalingService - Communicates with the external signaling server.
 *
 * Handles room allocation, participant management, and JWT token
 * generation for WebRTC signaling connections. All HTTP calls
 * include the shared secret for authentication.
 */
class SignalingService
{
    private readonly string $baseUrl;
    private readonly string $secret;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('services.signaling.url'), '/');
        $this->secret = (string) config('services.signaling.secret');
    }

    /**
     * Generate a JWT token for a participant to connect to the signaling server.
     */
    public function generateToken(Room $room, User $user, RoomParticipant $participant): string
    {
        $now = time();
        $payload = [
            'iss' => (string) config('app.url'),
            'sub' => (string) $user->id,
            'user_id' => (string) $user->id,
            'room_id' => $room->id,
            'participant_id' => $participant->id,
            'organization_id' => (string) $room->organization_id,
            'role' => $participant->role,
            'display_name' => $user->display_name ?? $user->name,
            'iat' => $now,
            'exp' => $now + 3600, // 1 hour expiry
        ];

        return JWT::encode($payload, $this->secret, 'HS256');
    }

    /**
     * Allocate a room on the signaling server / SFU infrastructure.
     *
     * @return array{node: string, routerId: string, iceServers: array}
     */
    public function allocateRoom(Room $room): array
    {
        $response = Http::withHeaders($this->authHeaders())
            ->timeout(10)
            ->post("{$this->baseUrl}/api/rooms/allocate", [
                'room_id' => $room->id,
                'organization_id' => $room->organization_id,
                'settings' => $room->settings,
            ]);

        if ($response->failed()) {
            Log::error('Signaling service: failed to allocate room', [
                'room_id' => $room->id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $response->throw();
        }

        return $response->json();
    }

    /**
     * Close a room on the signaling server, disconnecting all participants.
     */
    public function closeRoom(Room $room): void
    {
        $response = Http::withHeaders($this->authHeaders())
            ->timeout(10)
            ->post("{$this->baseUrl}/api/rooms/{$room->id}/close");

        if ($response->failed()) {
            Log::error('Signaling service: failed to close room', [
                'room_id' => $room->id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            // Do not throw - room closure should not block the end-stream flow
        }
    }

    /**
     * Remove a specific participant from the signaling server.
     */
    public function removeParticipant(Room $room, User $user): void
    {
        $response = Http::withHeaders($this->authHeaders())
            ->timeout(10)
            ->post("{$this->baseUrl}/api/rooms/{$room->id}/participants/{$user->id}/remove");

        if ($response->failed()) {
            Log::warning('Signaling service: failed to remove participant', [
                'room_id' => $room->id,
                'user_id' => $user->id,
                'status' => $response->status(),
            ]);
        }
    }

    /**
     * Mute a participant's media track on the signaling server.
     *
     * @param string $mediaType 'audio' or 'video'
     */
    public function muteParticipant(Room $room, User $user, string $mediaType): void
    {
        $response = Http::withHeaders($this->authHeaders())
            ->timeout(10)
            ->post("{$this->baseUrl}/api/rooms/{$room->id}/participants/{$user->id}/mute", [
                'media_type' => $mediaType,
            ]);

        if ($response->failed()) {
            Log::warning('Signaling service: failed to mute participant', [
                'room_id' => $room->id,
                'user_id' => $user->id,
                'media_type' => $mediaType,
                'status' => $response->status(),
            ]);
        }
    }

    /**
     * Build authentication headers for signaling server requests.
     *
     * @return array<string, string>
     */
    private function authHeaders(): array
    {
        return [
            'Authorization' => 'Bearer ' . $this->secret,
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ];
    }
}
