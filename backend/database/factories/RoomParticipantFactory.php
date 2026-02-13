<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\RoomSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomParticipant>
 */
class RoomParticipantFactory extends Factory
{
    protected $model = RoomParticipant::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_id' => Room::factory(),
            'session_id' => RoomSession::factory(),
            'user_id' => User::factory(),
            'role' => 'viewer',
            'display_name' => fake()->userName(),
            'connection_state' => 'connected',
            'joined_at' => now(),
            'left_at' => null,
            'metadata' => null,
        ];
    }

    /**
     * Set the participant as host.
     */
    public function host(): static
    {
        return $this->state(fn (array $attributes): array => [
            'role' => 'host',
        ]);
    }

    /**
     * Set the participant as having left.
     */
    public function left(): static
    {
        return $this->state(fn (array $attributes): array => [
            'left_at' => now(),
            'connection_state' => 'disconnected',
        ]);
    }
}
