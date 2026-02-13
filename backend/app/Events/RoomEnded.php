<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Room;
use App\Models\RoomSession;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Event dispatched when a room stream ends.
 *
 * Broadcasts to the room's private channel so all connected
 * participants know the stream has concluded.
 */
class RoomEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly Room $room,
        public readonly ?RoomSession $session,
        public readonly User $endedBy,
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
        return 'room.ended';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'room' => [
                'id' => $this->room->id,
                'name' => $this->room->name,
                'status' => $this->room->status,
                'total_duration_minutes' => $this->room->total_duration_minutes,
            ],
            'session' => $this->session ? [
                'id' => $this->session->id,
                'started_at' => $this->session->started_at?->toIso8601String(),
                'ended_at' => $this->session->ended_at?->toIso8601String(),
                'duration' => $this->session->duration(),
            ] : null,
            'ended_by' => [
                'id' => $this->endedBy->id,
                'name' => $this->endedBy->name,
            ],
        ];
    }
}
