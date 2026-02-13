<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * RoomSession Model - Represents a single streaming session within a room
 *
 * @property string $id
 * @property string $room_id
 * @property string $host_user_id
 * @property \Carbon\Carbon|null $started_at
 * @property \Carbon\Carbon|null $ended_at
 * @property int $peak_viewers
 * @property array|null $metadata
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class RoomSession extends Model
{
    use HasUuids, HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'room_id',
        'host_user_id',
        'started_at',
        'ended_at',
        'peak_viewers',
        'metadata',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'metadata' => 'array',
        'peak_viewers' => 'integer',
    ];

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_user_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(RoomParticipant::class, 'session_id');
    }

    // =========================================================================
    // BUSINESS LOGIC
    // =========================================================================

    public function isActive(): bool
    {
        return $this->started_at !== null && $this->ended_at === null;
    }

    public function duration(): ?int
    {
        if ($this->started_at === null) {
            return null;
        }

        $end = $this->ended_at ?? now();

        return (int) $this->started_at->diffInSeconds($end);
    }
}
