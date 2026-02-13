<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * RoomParticipant Model - Represents a user participating in a room session
 *
 * @property string $id
 * @property string $room_id
 * @property string $session_id
 * @property string $user_id
 * @property string $role
 * @property string|null $display_name
 * @property string|null $connection_state
 * @property \Carbon\Carbon|null $joined_at
 * @property \Carbon\Carbon|null $left_at
 * @property array|null $metadata
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class RoomParticipant extends Model
{
    use HasUuids, HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'room_id',
        'session_id',
        'user_id',
        'role',
        'display_name',
        'connection_state',
        'joined_at',
        'left_at',
        'metadata',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
        'metadata' => 'array',
    ];

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(RoomSession::class, 'session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // =========================================================================
    // SCOPES
    // =========================================================================

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('left_at');
    }

    // =========================================================================
    // BUSINESS LOGIC
    // =========================================================================

    public function isActive(): bool
    {
        return $this->left_at === null;
    }
}
