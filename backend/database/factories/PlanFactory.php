<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Plan;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Plan>
 */
class PlanFactory extends Factory
{
    protected $model = Plan::class;

    /**
     * Plan tier configurations indexed by slug name.
     *
     * @var array<string, array<string, mixed>>
     */
    private static array $tiers = [
        'starter' => [
            'display_name' => 'Starter',
            'price_monthly' => 29.00,
            'price_yearly' => 290.00,
            'max_rooms' => 3,
            'max_workspaces' => 2,
            'max_hosts_per_room' => 1,
            'max_viewers_per_room' => 50,
            'max_storage_gb' => 5,
            'features' => [
                'recording' => false,
                'analytics' => false,
                'custom_branding' => false,
                'api_access' => false,
            ],
        ],
        'professional' => [
            'display_name' => 'Professional',
            'price_monthly' => 79.00,
            'price_yearly' => 790.00,
            'max_rooms' => 10,
            'max_workspaces' => 5,
            'max_hosts_per_room' => 3,
            'max_viewers_per_room' => 200,
            'max_storage_gb' => 25,
            'features' => [
                'recording' => true,
                'analytics' => true,
                'custom_branding' => false,
                'api_access' => false,
            ],
        ],
        'business' => [
            'display_name' => 'Business',
            'price_monthly' => 199.00,
            'price_yearly' => 1990.00,
            'max_rooms' => 50,
            'max_workspaces' => 20,
            'max_hosts_per_room' => 5,
            'max_viewers_per_room' => 1000,
            'max_storage_gb' => 100,
            'features' => [
                'recording' => true,
                'analytics' => true,
                'custom_branding' => true,
                'api_access' => true,
            ],
        ],
    ];

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->randomElement(['starter', 'professional', 'business']);
        $tier = self::$tiers[$name];

        return [
            'name' => $name,
            'display_name' => $tier['display_name'],
            'price_monthly' => $tier['price_monthly'],
            'price_yearly' => $tier['price_yearly'],
            'stripe_price_id_monthly' => 'price_' . Str::random(24),
            'stripe_price_id_yearly' => 'price_' . Str::random(24),
            'max_rooms' => $tier['max_rooms'],
            'max_workspaces' => $tier['max_workspaces'],
            'max_hosts_per_room' => $tier['max_hosts_per_room'],
            'max_viewers_per_room' => $tier['max_viewers_per_room'],
            'max_storage_gb' => $tier['max_storage_gb'],
            'features' => $tier['features'],
            'is_active' => true,
        ];
    }

    /**
     * Create a Starter plan.
     */
    public function starter(): static
    {
        $tier = self::$tiers['starter'];

        return $this->state(fn (array $attributes): array => [
            'name' => 'starter',
            'display_name' => $tier['display_name'],
            'price_monthly' => $tier['price_monthly'],
            'price_yearly' => $tier['price_yearly'],
            'max_rooms' => $tier['max_rooms'],
            'max_workspaces' => $tier['max_workspaces'],
            'max_hosts_per_room' => $tier['max_hosts_per_room'],
            'max_viewers_per_room' => $tier['max_viewers_per_room'],
            'max_storage_gb' => $tier['max_storage_gb'],
            'features' => $tier['features'],
        ]);
    }

    /**
     * Create a Professional plan.
     */
    public function professional(): static
    {
        $tier = self::$tiers['professional'];

        return $this->state(fn (array $attributes): array => [
            'name' => 'professional',
            'display_name' => $tier['display_name'],
            'price_monthly' => $tier['price_monthly'],
            'price_yearly' => $tier['price_yearly'],
            'max_rooms' => $tier['max_rooms'],
            'max_workspaces' => $tier['max_workspaces'],
            'max_hosts_per_room' => $tier['max_hosts_per_room'],
            'max_viewers_per_room' => $tier['max_viewers_per_room'],
            'max_storage_gb' => $tier['max_storage_gb'],
            'features' => $tier['features'],
        ]);
    }

    /**
     * Create a Business plan.
     */
    public function business(): static
    {
        $tier = self::$tiers['business'];

        return $this->state(fn (array $attributes): array => [
            'name' => 'business',
            'display_name' => $tier['display_name'],
            'price_monthly' => $tier['price_monthly'],
            'price_yearly' => $tier['price_yearly'],
            'max_rooms' => $tier['max_rooms'],
            'max_workspaces' => $tier['max_workspaces'],
            'max_hosts_per_room' => $tier['max_hosts_per_room'],
            'max_viewers_per_room' => $tier['max_viewers_per_room'],
            'max_storage_gb' => $tier['max_storage_gb'],
            'features' => $tier['features'],
        ]);
    }

    /**
     * Mark the plan as inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_active' => false,
        ]);
    }
}
