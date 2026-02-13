<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Plan Model - Represents a subscription plan
 *
 * @property string $id
 * @property string $name
 * @property string $display_name
 * @property float $price_monthly
 * @property float $price_yearly
 * @property string|null $stripe_price_id_monthly
 * @property string|null $stripe_price_id_yearly
 * @property int $max_workspaces
 * @property int $max_rooms
 * @property int $max_hosts_per_room
 * @property int $max_viewers_per_room
 * @property int $max_storage_gb
 * @property array $features
 * @property bool $is_active
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class Plan extends Model
{
    use HasUuids, HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    public const STARTER = 'starter';
    public const PROFESSIONAL = 'professional';
    public const BUSINESS = 'business';
    public const ENTERPRISE = 'enterprise';

    protected $fillable = [
        'name',
        'display_name',
        'price_monthly',
        'price_yearly',
        'stripe_price_id_monthly',
        'stripe_price_id_yearly',
        'max_workspaces',
        'max_rooms',
        'max_hosts_per_room',
        'max_viewers_per_room',
        'max_storage_gb',
        'features',
        'is_active',
    ];

    protected $casts = [
        'features' => 'array',
        'price_monthly' => 'decimal:2',
        'price_yearly' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }
}
