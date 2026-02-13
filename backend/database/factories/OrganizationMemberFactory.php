<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrganizationMember>
 */
class OrganizationMemberFactory extends Factory
{
    protected $model = OrganizationMember::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'user_id' => User::factory(),
            'role' => OrganizationMember::ROLE_MEMBER,
            'invited_at' => now(),
            'accepted_at' => now(),
        ];
    }

    /**
     * Set the member role to owner.
     */
    public function owner(): static
    {
        return $this->state(fn (array $attributes): array => [
            'role' => OrganizationMember::ROLE_OWNER,
        ]);
    }

    /**
     * Set the member role to admin.
     */
    public function admin(): static
    {
        return $this->state(fn (array $attributes): array => [
            'role' => OrganizationMember::ROLE_ADMIN,
        ]);
    }
}
