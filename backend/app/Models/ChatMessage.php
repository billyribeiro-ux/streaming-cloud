<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ChatMessage Model - Represents a chat message within a room
 *
 * @property string $id
 * @property string $room_id
 * @property string $user_id
 * @property string $content
 * @property string|null $type
 * @property array|null $metadata
 * @property bool $is_deleted
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class ChatMessage extends Model
{
    use HasUuids, HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'room_id',
        'user_id',
        'content',
        'type',
        'metadata',
        'is_deleted',
    ];

    protected $casts = [
        'metadata' => 'array',
        'is_deleted' => 'boolean',
    ];

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // =========================================================================
    // SCOPES
    // =========================================================================

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('is_deleted', false);
    }
}
