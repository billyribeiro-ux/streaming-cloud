<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Room;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Room>
 */
class RoomFactory extends Factory
{
    protected $model = Room::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'organization_id' => fn (array $attributes): string => Workspace::find($attributes['workspace_id'])->organization_id,
            'name' => fake()->words(3, true) . ' Session',
            'description' => fake()->paragraph(),
            'status' => Room::STATUS_SCHEDULED,
            'settings' => [
                'max_participants' => 100,
                'allow_chat' => true,
                'allow_reactions' => true,
                'allow_screen_share' => true,
                'require_approval' => false,
                'waiting_room' => false,
                'mute_on_entry' => true,
                'simulcast' => true,
                'video_quality' => '720p',
            ],
            'scheduled_start' => fake()->dateTimeBetween('now', '+1 week'),
            'scheduled_end' => null,
            'actual_start' => null,
            'actual_end' => null,
            'thumbnail_url' => null,
            'recording_enabled' => false,
            'created_by' => null,
        ];
    }

    /**
     * Indicate that the room is currently live.
     */
    public function live(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => Room::STATUS_LIVE,
            'actual_start' => now()->subMinutes(fake()->numberBetween(5, 120)),
        ]);
    }

    /**
     * Indicate that the room session has ended.
     */
    public function ended(): static
    {
        $start = fake()->dateTimeBetween('-1 week', '-1 hour');

        return $this->state(fn (array $attributes): array => [
            'status' => Room::STATUS_ENDED,
            'scheduled_start' => $start,
            'actual_start' => $start,
            'actual_end' => fake()->dateTimeBetween($start, 'now'),
            'total_participants' => fake()->numberBetween(5, 200),
            'peak_participants' => fake()->numberBetween(10, 200),
            'total_duration_minutes' => fake()->numberBetween(15, 180),
        ]);
    }

    /**
     * Indicate that the room has been cancelled.
     */
    public function cancelled(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => Room::STATUS_CANCELLED,
        ]);
    }

    /**
     * Enable recording for this room.
     */
    public function withRecording(): static
    {
        return $this->state(fn (array $attributes): array => [
            'recording_enabled' => true,
        ]);
    }
}
