<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Room Model - Represents a streaming room
 *
 * @property string $id
 * @property string $workspace_id
 * @property string $organization_id
 * @property string $name
 * @property string|null $description
 * @property string $slug
 * @property string $status
 * @property array $settings
 * @property \Carbon\Carbon|null $scheduled_start
 * @property \Carbon\Carbon|null $scheduled_end
 * @property \Carbon\Carbon|null $actual_start
 * @property \Carbon\Carbon|null $actual_end
 * @property string|null $thumbnail_url
 * @property bool $recording_enabled
 * @property int $total_participants
 * @property int $peak_participants
 * @property int $total_duration_minutes
 * @property string|null $created_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class Room extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_LIVE = 'live';
    public const STATUS_ENDED = 'ended';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'workspace_id',
        'organization_id',
        'name',
        'description',
        'slug',
        'status',
        'settings',
        'scheduled_start',
        'scheduled_end',
        'actual_start',
        'actual_end',
        'thumbnail_url',
        'recording_enabled',
        'created_by',
    ];

    protected $casts = [
        'settings' => 'array',
        'scheduled_start' => 'datetime',
        'scheduled_end' => 'datetime',
        'actual_start' => 'datetime',
        'actual_end' => 'datetime',
        'recording_enabled' => 'boolean',
        'total_participants' => 'integer',
        'peak_participants' => 'integer',
        'total_duration_minutes' => 'integer',
    ];

    protected $attributes = [
        'status' => self::STATUS_SCHEDULED,
        'settings' => '{"max_participants":100,"allow_chat":true,"allow_reactions":true,"allow_screen_share":true,"require_approval":false,"waiting_room":false,"mute_on_entry":true,"simulcast":true,"video_quality":"720p"}',
        'recording_enabled' => false,
        'total_participants' => 0,
        'peak_participants' => 0,
        'total_duration_minutes' => 0,
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Room $room) {
            if (empty($room->slug)) {
                $room->slug = Str::slug($room->name) . '-' . Str::random(6);
            }
        });
    }

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(RoomSession::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(RoomParticipant::class);
    }

    public function activeParticipants(): HasMany
    {
        return $this->participants()->whereNull('left_at');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(RoomFile::class);
    }

    // =========================================================================
    // SCOPES
    // =========================================================================

    public function scopeLive($query)
    {
        return $query->where('status', self::STATUS_LIVE);
    }

    public function scopeScheduled($query)
    {
        return $query->where('status', self::STATUS_SCHEDULED);
    }

    public function scopeUpcoming($query)
    {
        return $query->where('status', self::STATUS_SCHEDULED)
            ->where('scheduled_start', '>=', now())
            ->orderBy('scheduled_start', 'asc');
    }

    public function scopeForOrganization($query, string $organizationId)
    {
        return $query->where('organization_id', $organizationId);
    }

    // =========================================================================
    // BUSINESS LOGIC
    // =========================================================================

    public function isLive(): bool
    {
        return $this->status === self::STATUS_LIVE;
    }

    public function canJoin(User $user): bool
    {
        // Check if room is live or scheduled
        if (!in_array($this->status, [self::STATUS_LIVE, self::STATUS_SCHEDULED])) {
            return false;
        }

        // Check organization membership
        $isMember = $this->organization->members()
            ->where('user_id', $user->id)
            ->exists();

        if (!$isMember) {
            return false;
        }

        // Check viewer limits
        if ($this->isLive()) {
            $currentViewers = $this->activeParticipants()->count();
            $maxViewers = $this->settings['max_participants'] ?? $this->organization->getMaxViewersPerRoom();

            if ($currentViewers >= $maxViewers) {
                return false;
            }
        }

        return true;
    }

    public function canStream(User $user): bool
    {
        // Check workspace membership with appropriate role
        $workspaceMember = $this->workspace->members()
            ->where('user_id', $user->id)
            ->first();

        if (!$workspaceMember) {
            return false;
        }

        return in_array($workspaceMember->pivot->role, ['admin', 'host', 'co_host']);
    }

    public function goLive(User $host): RoomSession
    {
        $this->update([
            'status' => self::STATUS_LIVE,
            'actual_start' => now(),
        ]);

        return $this->sessions()->create([
            'host_user_id' => $host->id,
            'started_at' => now(),
        ]);
    }

    public function endStream(): void
    {
        $activeSession = $this->sessions()
            ->whereNull('ended_at')
            ->first();

        if ($activeSession) {
            $duration = now()->diffInSeconds($activeSession->started_at);
            $activeSession->update([
                'ended_at' => now(),
            ]);
        }

        $this->update([
            'status' => self::STATUS_ENDED,
            'actual_end' => now(),
            'total_duration_minutes' => ($this->total_duration_minutes + ($duration ?? 0) / 60),
        ]);

        // Mark all participants as left
        $this->activeParticipants()->update(['left_at' => now()]);
    }

    public function updatePeakParticipants(): void
    {
        $current = $this->activeParticipants()->count();
        if ($current > $this->peak_participants) {
            $this->update(['peak_participants' => $current]);

            // Also update the active session
            $this->sessions()
                ->whereNull('ended_at')
                ->where('peak_viewers', '<', $current)
                ->update(['peak_viewers' => $current]);
        }
    }

    public function getSetting(string $key, mixed $default = null): mixed
    {
        return data_get($this->settings, $key, $default);
    }
}
