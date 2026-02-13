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
 * Event dispatched when a room stream goes live.
 *
 * Broadcasts to the room's private channel so participants
 * and waiting viewers are notified that the stream has started.
 */
class RoomStarted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly Room $room,
        public readonly RoomSession $session,
        public readonly User $host,
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
        return 'room.started';
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
            ],
            'session' => [
                'id' => $this->session->id,
                'started_at' => $this->session->started_at?->toIso8601String(),
            ],
            'host' => [
                'id' => $this->host->id,
                'name' => $this->host->name,
            ],
        ];
    }
}
