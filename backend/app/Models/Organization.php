<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

/**
 * Organization Model - Represents a tenant in the multi-tenant system
 *
 * @property string $id
 * @property string $name
 * @property string $slug
 * @property string|null $logo_url
 * @property array $settings
 * @property string|null $stripe_customer_id
 * @property array $metadata
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class Organization extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'name',
        'slug',
        'logo_url',
        'settings',
        'stripe_customer_id',
        'metadata',
    ];

    protected $casts = [
        'settings' => 'array',
        'metadata' => 'array',
    ];

    protected $attributes = [
        'settings' => '{"timezone":"UTC","language":"en","allow_guest_viewers":false,"require_approval":false,"default_room_settings":{}}',
        'metadata' => '{}',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Organization $organization) {
            if (empty($organization->slug)) {
                $organization->slug = Str::slug($organization->name);
            }
        });
    }

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(OrganizationMember::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'organization_members')
            ->withPivot(['role', 'invited_at', 'accepted_at'])
            ->withTimestamps();
    }

    public function workspaces(): HasMany
    {
        return $this->hasMany(Workspace::class);
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    public function apiKeys(): HasMany
    {
        return $this->hasMany(ApiKey::class);
    }

    // =========================================================================
    // ACCESSORS & MUTATORS
    // =========================================================================

    public function getOwnerAttribute(): ?User
    {
        return $this->users()
            ->wherePivot('role', 'owner')
            ->first();
    }

    public function getAdminsAttribute()
    {
        return $this->users()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->get();
    }

    // =========================================================================
    // BUSINESS LOGIC
    // =========================================================================

    public function getPlan(): ?Plan
    {
        return $this->subscription?->plan;
    }

    public function hasActiveSubscription(): bool
    {
        return $this->subscription !== null
            && in_array($this->subscription->status, ['active', 'trialing']);
    }

    public function canCreateWorkspace(): bool
    {
        $plan = $this->getPlan();
        if (!$plan) {
            return false;
        }

        // -1 means unlimited
        if ($plan->max_workspaces === -1) {
            return true;
        }

        return $this->workspaces()->count() < $plan->max_workspaces;
    }

    public function canCreateRoom(): bool
    {
        $plan = $this->getPlan();
        if (!$plan) {
            return false;
        }

        if ($plan->max_rooms === -1) {
            return true;
        }

        return $this->rooms()->count() < $plan->max_rooms;
    }

    public function getMaxViewersPerRoom(): int
    {
        $plan = $this->getPlan();
        return $plan?->max_viewers_per_room ?? 50;
    }

    public function hasFeature(string $feature): bool
    {
        $plan = $this->getPlan();
        if (!$plan) {
            return false;
        }

        return $plan->features[$feature] ?? false;
    }

    public function getRemainingStorage(): int
    {
        $plan = $this->getPlan();
        if (!$plan) {
            return 0;
        }

        $maxStorageBytes = $plan->max_storage_gb * 1024 * 1024 * 1024;
        $usedStorage = $this->rooms()
            ->join('room_files', 'rooms.id', '=', 'room_files.room_id')
            ->sum('room_files.file_size');

        return max(0, $maxStorageBytes - $usedStorage);
    }
}
