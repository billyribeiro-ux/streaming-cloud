<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Subscription>
 */
class SubscriptionFactory extends Factory
{
    protected $model = Subscription::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'plan_id' => Plan::factory(),
            'stripe_subscription_id' => 'sub_' . fake()->unique()->regexify('[A-Za-z0-9]{24}'),
            'status' => 'active',
            'trial_ends_at' => null,
            'current_period_start' => now(),
            'current_period_end' => now()->addMonth(),
            'cancelled_at' => null,
        ];
    }

    /**
     * Set the subscription as trialing.
     */
    public function trialing(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => 'trialing',
            'trial_ends_at' => now()->addDays(14),
        ]);
    }
}
