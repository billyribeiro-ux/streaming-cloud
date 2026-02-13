<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Chat Message API Resource
 *
 * Transforms ChatMessage model data for API responses.
 */
class ChatMessageResource extends JsonResource
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
            'display_name' => $this->whenLoaded('user', fn () => $this->user->display_name ?? $this->user->name),
            'content' => $this->content,
            'type' => $this->type,
            'created_at' => $this->created_at,
            'is_deleted' => $this->is_deleted,
        ];
    }
}
