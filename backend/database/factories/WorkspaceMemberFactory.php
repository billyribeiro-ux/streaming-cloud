<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkspaceMember>
 */
class WorkspaceMemberFactory extends Factory
{
    protected $model = WorkspaceMember::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'user_id' => User::factory(),
            'role' => WorkspaceMember::ROLE_VIEWER,
        ];
    }

    /**
     * Set the member role to admin.
     */
    public function admin(): static
    {
        return $this->state(fn (array $attributes): array => [
            'role' => WorkspaceMember::ROLE_ADMIN,
        ]);
    }

    /**
     * Set the member role to host.
     */
    public function host(): static
    {
        return $this->state(fn (array $attributes): array => [
            'role' => WorkspaceMember::ROLE_HOST,
        ]);
    }
}
