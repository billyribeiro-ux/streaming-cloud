<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Participant API Resource
 *
 * Transforms RoomParticipant model data for API responses.
 */
class ParticipantResource extends JsonResource
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
            'user_id' => $this->user_id,
            'display_name' => $this->display_name,
            'role' => $this->role,
            'connection_state' => $this->connection_state,
            'joined_at' => $this->joined_at,
            'left_at' => $this->left_at,
            'user' => new UserResource($this->whenLoaded('user')),
        ];
    }
}
