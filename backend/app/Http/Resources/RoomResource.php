<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Room API Resource
 *
 * Transforms Room model data for API responses.
 */
class RoomResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'slug' => $this->slug,
            'status' => $this->status,
            'settings' => $this->settings,
            'scheduled_start' => $this->scheduled_start,
            'scheduled_end' => $this->scheduled_end,
            'actual_start' => $this->actual_start,
            'actual_end' => $this->actual_end,
            'thumbnail_url' => $this->thumbnail_url,
            'recording_enabled' => $this->recording_enabled,
            'total_participants' => $this->total_participants,
            'peak_participants' => $this->peak_participants,
            'created_by' => new UserResource($this->whenLoaded('creator')),
            'workspace_id' => $this->workspace_id,
            'organization_id' => $this->organization_id,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
