<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\Organization;
use App\Models\Room;
use App\Models\Workspace;
use App\Policies\OrganizationPolicy;
use App\Policies\RoomPolicy;
use App\Policies\WorkspacePolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

/**
 * Auth Service Provider
 *
 * Registers authorization policies that map Eloquent models
 * to their corresponding policy classes for Gate checks.
 */
class AuthServiceProvider extends ServiceProvider
{
    /**
     * The model to policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        Room::class => RoomPolicy::class,
        Organization::class => OrganizationPolicy::class,
        Workspace::class => WorkspacePolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot(): void
    {
        $this->registerPolicies();
    }
}
