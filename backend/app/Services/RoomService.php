<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Organization;
use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\User;
use App\Models\Workspace;
use App\Events\RoomCreated;
use App\Events\RoomStarted;
use App\Events\RoomEnded;
use App\Events\ParticipantJoined;
use App\Events\ParticipantLeft;
use App\Exceptions\RoomException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Room Service - Handles all room-related business logic
 *
 * Responsibilities:
 * - Room CRUD operations with validation
 * - Participant management
 * - Room lifecycle (create, start, end)
 * - Subscription limit enforcement
 */
class RoomService
{
    public function __construct(
        private readonly SignalingService $signalingService,
        private readonly SubscriptionService $subscriptionService,
        private readonly AuditService $auditService,
    ) {}

    /**
     * Create a new room
     *
     * @throws RoomException
     */
    public function create(
        Workspace $workspace,
        User $creator,
        array $data
    ): Room {
        $organization = $workspace->organization;

        // Validate subscription limits
        if (!$this->subscriptionService->canCreateRoom($organization)) {
            throw RoomException::limitReached(
                'Room limit reached for your subscription plan'
            );
        }

        return DB::transaction(function () use ($workspace, $organization, $creator, $data) {
            $room = Room::create([
                'workspace_id' => $workspace->id,
                'organization_id' => $organization->id,
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'slug' => $data['slug'] ?? Str::slug($data['name']) . '-' . Str::random(6),
                'settings' => array_merge(
                    $this->getDefaultSettings($organization),
                    $data['settings'] ?? []
                ),
                'scheduled_start' => $data['scheduled_start'] ?? null,
                'scheduled_end' => $data['scheduled_end'] ?? null,
                'recording_enabled' => $data['recording_enabled'] ?? false,
                'created_by' => $creator->id,
            ]);

            // Log audit event
            $this->auditService->log(
                $organization,
                $creator,
                'room.created',
                'room',
                $room->id,
                null,
                $room->toArray()
            );

            // Dispatch event
            event(new RoomCreated($room, $creator));

            Log::info('Room created', [
                'room_id' => $room->id,
                'organization_id' => $organization->id,
                'creator_id' => $creator->id,
            ]);

            return $room;
        });
    }

    /**
     * Update room details
     */
    public function update(Room $room, User $user, array $data): Room
    {
        $oldValues = $room->toArray();

        $room->update([
            'name' => $data['name'] ?? $room->name,
            'description' => $data['description'] ?? $room->description,
            'settings' => array_merge($room->settings, $data['settings'] ?? []),
            'scheduled_start' => $data['scheduled_start'] ?? $room->scheduled_start,
            'scheduled_end' => $data['scheduled_end'] ?? $room->scheduled_end,
            'recording_enabled' => $data['recording_enabled'] ?? $room->recording_enabled,
        ]);

        $this->auditService->log(
            $room->organization,
            $user,
            'room.updated',
            'room',
            $room->id,
            $oldValues,
            $room->toArray()
        );

        return $room->fresh();
    }

    /**
     * Start a room stream
     *
     * @throws RoomException
     */
    public function startStream(Room $room, User $host): array
    {
        if ($room->isLive()) {
            throw RoomException::alreadyLive('Room is already live');
        }

        if (!$room->canStream($host)) {
            throw RoomException::unauthorized('You do not have permission to stream in this room');
        }

        return DB::transaction(function () use ($room, $host) {
            // Create room session
            $session = $room->goLive($host);

            // Get SFU node assignment from signaling service
            $sfuAssignment = $this->signalingService->allocateRoom($room);

            $session->update([
                'sfu_node' => $sfuAssignment['node'],
                'router_id' => $sfuAssignment['routerId'],
            ]);

            // Add host as participant
            $this->addParticipant($room, $host, 'host');

            // Dispatch event
            event(new RoomStarted($room, $session, $host));

            Log::info('Room stream started', [
                'room_id' => $room->id,
                'session_id' => $session->id,
                'host_id' => $host->id,
                'sfu_node' => $sfuAssignment['node'],
            ]);

            return [
                'session' => $session,
                'sfu' => $sfuAssignment,
            ];
        });
    }

    /**
     * End a room stream
     */
    public function endStream(Room $room, User $user): void
    {
        if (!$room->isLive()) {
            return;
        }

        DB::transaction(function () use ($room, $user) {
            $session = $room->sessions()->whereNull('ended_at')->first();

            // Notify signaling server to close all connections
            $this->signalingService->closeRoom($room);

            // End the room
            $room->endStream();

            // Dispatch event
            event(new RoomEnded($room, $session, $user));

            $this->auditService->log(
                $room->organization,
                $user,
                'room.ended',
                'room',
                $room->id
            );

            Log::info('Room stream ended', [
                'room_id' => $room->id,
                'session_id' => $session?->id,
                'ended_by' => $user->id,
            ]);
        });
    }

    /**
     * Add a participant to a room
     *
     * @throws RoomException
     */
    public function addParticipant(
        Room $room,
        User $user,
        string $role = 'viewer',
        array $deviceInfo = []
    ): RoomParticipant {
        // Check if room can be joined
        if (!$room->canJoin($user)) {
            throw RoomException::cannotJoin('Cannot join this room');
        }

        // Check if user is already in the room
        $existingParticipant = $room->activeParticipants()
            ->where('user_id', $user->id)
            ->first();

        if ($existingParticipant) {
            // Update existing participant
            $existingParticipant->update([
                'connection_state' => 'connecting',
                'device_info' => $deviceInfo,
            ]);
            return $existingParticipant;
        }

        // Get active session
        $session = $room->sessions()->whereNull('ended_at')->first();

        $participant = RoomParticipant::create([
            'room_id' => $room->id,
            'session_id' => $session?->id,
            'user_id' => $user->id,
            'role' => $role,
            'connection_state' => 'connecting',
            'device_info' => $deviceInfo,
        ]);

        // Update room stats
        $room->increment('total_participants');
        $room->updatePeakParticipants();

        // Dispatch event
        event(new ParticipantJoined($room, $participant, $user));

        Log::info('Participant joined room', [
            'room_id' => $room->id,
            'user_id' => $user->id,
            'role' => $role,
        ]);

        return $participant;
    }

    /**
     * Remove a participant from a room
     */
    public function removeParticipant(Room $room, User $user, string $reason = 'left'): void
    {
        $participant = $room->activeParticipants()
            ->where('user_id', $user->id)
            ->first();

        if (!$participant) {
            return;
        }

        $participant->update([
            'left_at' => now(),
            'connection_state' => 'disconnected',
        ]);

        // Notify signaling server
        $this->signalingService->removeParticipant($room, $user);

        // Dispatch event
        event(new ParticipantLeft($room, $participant, $user, $reason));

        Log::info('Participant left room', [
            'room_id' => $room->id,
            'user_id' => $user->id,
            'reason' => $reason,
        ]);
    }

    /**
     * Get room participants with user details
     */
    public function getParticipants(Room $room): array
    {
        return $room->activeParticipants()
            ->with(['user:id,email', 'user.profile:id,display_name,avatar_url'])
            ->get()
            ->map(function ($participant) {
                return [
                    'id' => $participant->id,
                    'user_id' => $participant->user_id,
                    'display_name' => $participant->user->profile?->display_name ?? $participant->user->email,
                    'avatar_url' => $participant->user->profile?->avatar_url,
                    'role' => $participant->role,
                    'is_video_enabled' => $participant->is_video_enabled,
                    'is_audio_enabled' => $participant->is_audio_enabled,
                    'is_screen_sharing' => $participant->is_screen_sharing,
                    'connection_quality' => $participant->connection_quality,
                    'joined_at' => $participant->joined_at,
                ];
            })
            ->toArray();
    }

    /**
     * Update participant media state
     */
    public function updateParticipantMedia(
        RoomParticipant $participant,
        array $mediaState
    ): void {
        $participant->update([
            'is_video_enabled' => $mediaState['video'] ?? $participant->is_video_enabled,
            'is_audio_enabled' => $mediaState['audio'] ?? $participant->is_audio_enabled,
            'is_screen_sharing' => $mediaState['screen'] ?? $participant->is_screen_sharing,
        ]);
    }

    /**
     * Moderate participant (mute, remove, etc.)
     *
     * @throws RoomException
     */
    public function moderateParticipant(
        Room $room,
        User $moderator,
        User $target,
        string $action
    ): void {
        // Check moderator permissions
        $moderatorMember = $room->workspace->members()
            ->where('user_id', $moderator->id)
            ->first();

        if (!$moderatorMember || !in_array($moderatorMember->pivot->role, ['admin', 'host', 'co_host', 'moderator'])) {
            throw RoomException::unauthorized('You do not have permission to moderate');
        }

        $participant = $room->activeParticipants()
            ->where('user_id', $target->id)
            ->first();

        if (!$participant) {
            throw RoomException::notFound('Participant not found');
        }

        match ($action) {
            'mute_audio' => $this->signalingService->muteParticipant($room, $target, 'audio'),
            'mute_video' => $this->signalingService->muteParticipant($room, $target, 'video'),
            'kick' => $this->removeParticipant($room, $target, 'kicked'),
            default => throw RoomException::invalidAction("Unknown moderation action: {$action}"),
        };

        $this->auditService->log(
            $room->organization,
            $moderator,
            "room.participant.{$action}",
            'room_participant',
            $participant->id,
            null,
            ['target_user_id' => $target->id, 'action' => $action]
        );
    }

    /**
     * Get default room settings based on organization plan
     */
    private function getDefaultSettings(Organization $organization): array
    {
        $plan = $organization->getPlan();

        return [
            'max_participants' => $plan?->max_viewers_per_room ?? 50,
            'allow_chat' => true,
            'allow_reactions' => true,
            'allow_screen_share' => true,
            'require_approval' => false,
            'waiting_room' => false,
            'mute_on_entry' => true,
            'simulcast' => true,
            'video_quality' => '720p',
            'recording_enabled' => $plan?->features['recording'] ?? false,
        ];
    }
}
