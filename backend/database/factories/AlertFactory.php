<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Alert;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Alert>
 */
class AlertFactory extends Factory
{
    protected $model = Alert::class;

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
            'type' => fake()->randomElement(['price_alert', 'news', 'indicator', 'custom']),
            'title' => fake()->sentence(4),
            'message' => fake()->sentence(),
            'priority' => fake()->randomElement(['low', 'medium', 'high']),
            'metadata' => null,
        ];
    }

    /**
     * Create a high priority alert.
     */
    public function highPriority(): static
    {
        return $this->state(fn (array $attributes): array => [
            'priority' => 'high',
        ]);
    }

    /**
     * Create a price alert.
     */
    public function priceAlert(): static
    {
        $symbol = fake()->randomElement(['BTC/USD', 'ETH/USD', 'EUR/USD', 'GBP/USD', 'AAPL', 'TSLA']);
        $price = fake()->randomFloat(2, 10, 50000);

        return $this->state(fn (array $attributes): array => [
            'type' => 'price_alert',
            'title' => "{$symbol} Price Alert",
            'message' => "{$symbol} has reached \${$price}",
            'metadata' => [
                'symbol' => $symbol,
                'price' => $price,
                'direction' => fake()->randomElement(['up', 'down']),
            ],
        ]);
    }
}
