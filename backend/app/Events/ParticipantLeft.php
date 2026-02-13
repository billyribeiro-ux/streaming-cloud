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
 * Event dispatched when a participant leaves a room.
 *
 * Broadcasts to the room's private channel so other participants
 * can update their UI to reflect the departure.
 */
class ParticipantLeft implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly Room $room,
        public readonly RoomParticipant $participant,
        public readonly User $user,
        public readonly string $reason,
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
        return 'participant.left';
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
                'left_at' => $this->participant->left_at?->toIso8601String(),
            ],
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ],
            'reason' => $this->reason,
        ];
    }
}
