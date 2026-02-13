<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\ChatMessage;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ChatMessage>
 */
class ChatMessageFactory extends Factory
{
    protected $model = ChatMessage::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_id' => Room::factory(),
            'user_id' => User::factory(),
            'content' => fake()->sentence(),
            'type' => 'text',
            'metadata' => null,
            'is_deleted' => false,
        ];
    }

    /**
     * Indicate that the message is a system message.
     */
    public function system(): static
    {
        return $this->state(fn (array $attributes): array => [
            'type' => 'system',
            'content' => fake()->randomElement([
                'A new user has joined the room.',
                'The host has started screen sharing.',
                'Recording has been enabled.',
                'The session will end in 5 minutes.',
            ]),
        ]);
    }

    /**
     * Indicate that the message has been deleted.
     */
    public function deleted(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_deleted' => true,
        ]);
    }
}
