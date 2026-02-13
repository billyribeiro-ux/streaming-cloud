<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Organization>
 */
class OrganizationFactory extends Factory
{
    protected $model = Organization::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->company();

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'logo_url' => null,
            'settings' => [
                'timezone' => 'UTC',
                'language' => 'en',
                'allow_guest_viewers' => false,
                'require_approval' => false,
                'default_room_settings' => [],
            ],
            'stripe_customer_id' => null,
            'metadata' => [],
        ];
    }
}
