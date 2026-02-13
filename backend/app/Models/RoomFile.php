<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * RoomFile Model - Represents a file uploaded to a room
 *
 * @property string $id
 * @property string $room_id
 * @property string $uploaded_by
 * @property string $file_name
 * @property string $file_url
 * @property int $file_size
 * @property string $mime_type
 * @property bool $is_deleted
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class RoomFile extends Model
{
    use HasUuids, HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'room_id',
        'uploaded_by',
        'file_name',
        'file_url',
        'file_size',
        'mime_type',
        'is_deleted',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'is_deleted' => 'boolean',
    ];

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
