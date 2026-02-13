<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Join Room Request Validation
 *
 * Validates requests to join a streaming room.
 * Authorization is handled in the controller/policy layer.
 */
class JoinRoomRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by policies
    }

    /**
     * Get the validation rules.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'device_info' => ['nullable', 'array'],
        ];
    }
}
