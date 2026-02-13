<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\Request;

/**
 * AuditService - Provides structured audit logging for organization actions.
 *
 * Creates AuditLog records with full context including organization scope,
 * acting user, entity details, change diffs (old/new values), and request metadata.
 */
class AuditService
{
    /**
     * Log an auditable action.
     *
     * @param Organization $organization  The organization scope for the audit entry.
     * @param User         $user          The user who performed the action.
     * @param string       $action        The action identifier (e.g. 'room.created').
     * @param string       $entityType    The type of entity affected (e.g. 'room').
     * @param string       $entityId      The UUID of the affected entity.
     * @param array|null   $oldValues     Previous values (for updates/deletes).
     * @param array|null   $newValues     New values (for creates/updates).
     */
    public function log(
        Organization $organization,
        User $user,
        string $action,
        string $entityType,
        string $entityId,
        ?array $oldValues = null,
        ?array $newValues = null,
    ): AuditLog {
        return AuditLog::create([
            'organization_id' => $organization->id,
            'user_id' => $user->id,
            'action' => $action,
            'resource_type' => $entityType,
            'resource_id' => $entityId,
            'metadata' => array_filter([
                'old_values' => $oldValues,
                'new_values' => $newValues,
            ]),
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
        ]);
    }
}
