<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Room;
use App\Models\RoomSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomSession>
 */
class RoomSessionFactory extends Factory
{
    protected $model = RoomSession::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_id' => Room::factory(),
            'host_user_id' => User::factory(),
            'started_at' => now(),
            'ended_at' => null,
            'peak_viewers' => 0,
            'metadata' => [],
        ];
    }

    /**
     * Indicate that the session has ended.
     */
    public function ended(): static
    {
        $startedAt = fake()->dateTimeBetween('-1 week', '-1 hour');

        return $this->state(fn (array $attributes): array => [
            'started_at' => $startedAt,
            'ended_at' => fake()->dateTimeBetween($startedAt, 'now'),
            'peak_viewers' => fake()->numberBetween(5, 200),
        ]);
    }

    /**
     * Indicate that the session is currently active.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes): array => [
            'started_at' => now()->subMinutes(fake()->numberBetween(5, 120)),
            'ended_at' => null,
            'peak_viewers' => fake()->numberBetween(1, 100),
        ]);
    }
}
