<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Recording Model - Represents a recorded session of a room
 *
 * @property string $id
 * @property string $room_id
 * @property string|null $session_id
 * @property string $status
 * @property string|null $file_path
 * @property int|null $file_size
 * @property int|null $duration_seconds
 * @property \Carbon\Carbon|null $started_at
 * @property \Carbon\Carbon|null $ended_at
 * @property array|null $metadata
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class Recording extends Model
{
    use HasUuids, HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    public const STATUS_RECORDING = 'recording';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_READY = 'ready';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'room_id',
        'session_id',
        'status',
        'file_path',
        'file_size',
        'duration_seconds',
        'started_at',
        'ended_at',
        'metadata',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'duration_seconds' => 'integer',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected $attributes = [
        'status' => self::STATUS_RECORDING,
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

    // =========================================================================
    // SCOPES
    // =========================================================================

    /**
     * Scope to only include recordings that are ready for playback.
     */
    public function scopeReady(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_READY);
    }

    /**
     * Scope to filter recordings by room.
     */
    public function scopeForRoom(Builder $query, string $roomId): Builder
    {
        return $query->where('room_id', $roomId);
    }

    // =========================================================================
    // BUSINESS LOGIC
    // =========================================================================

    public function isReady(): bool
    {
        return $this->status === self::STATUS_READY;
    }

    public function isRecording(): bool
    {
        return $this->status === self::STATUS_RECORDING;
    }
}
