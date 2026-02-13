<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * WorkspaceMember Model - Represents membership of a user in a workspace
 *
 * @property string $id
 * @property string $workspace_id
 * @property string $user_id
 * @property string $role
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class WorkspaceMember extends Model
{
    use HasUuids, HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    public const ROLE_ADMIN = 'admin';
    public const ROLE_HOST = 'host';
    public const ROLE_CO_HOST = 'co_host';
    public const ROLE_MODERATOR = 'moderator';
    public const ROLE_VIEWER = 'viewer';

    protected $fillable = [
        'workspace_id',
        'user_id',
        'role',
    ];

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
