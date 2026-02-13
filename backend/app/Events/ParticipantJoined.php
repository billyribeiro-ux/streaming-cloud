<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Event dispatched when a participant joins a room.
 *
 * Broadcasts to the room's private channel so other participants
 * can update their UI with the new participant's presence.
 */
class ParticipantJoined implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly Room $room,
        public readonly RoomParticipant $participant,
        public readonly User $user,
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('room.' . $this->room->id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'participant.joined';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'room_id' => $this->room->id,
            'participant' => [
                'id' => $this->participant->id,
                'role' => $this->participant->role,
                'joined_at' => $this->participant->joined_at?->toIso8601String(),
            ],
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'display_name' => $this->user->display_name,
                'avatar_url' => $this->user->avatar_url,
            ],
        ];
    }
}
