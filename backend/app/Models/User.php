<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * User Model - Represents an authenticated user in the platform
 *
 * @property string $id
 * @property string $name
 * @property string $email
 * @property string $password
 * @property string|null $display_name
 * @property string|null $avatar_url
 * @property string|null $timezone
 * @property array|null $preferences
 * @property \Carbon\Carbon|null $email_verified_at
 * @property \Carbon\Carbon|null $last_login_at
 * @property string|null $remember_token
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property \Carbon\Carbon|null $deleted_at
 */
class User extends Authenticatable
{
    use HasUuids, HasFactory, HasApiTokens, Notifiable, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'name',
        'email',
        'password',
        'display_name',
        'avatar_url',
        'timezone',
        'preferences',
        'last_login_at',
    ];

    protected $casts = [
        'preferences' => 'array',
        'email_verified_at' => 'datetime',
        'last_login_at' => 'datetime',
        'password' => 'hashed',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    public function organizations(): BelongsToMany
    {
        return $this->belongsToMany(Organization::class, 'organization_members')
            ->withPivot(['role', 'invited_at', 'accepted_at'])
            ->withTimestamps();
    }

    public function workspaces(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_members')
            ->withPivot(['role'])
            ->withTimestamps();
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(RoomParticipant::class);
    }

    public function createdRooms(): HasMany
    {
        return $this->hasMany(Room::class, 'created_by');
    }
}
