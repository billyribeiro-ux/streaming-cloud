<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create Chat Message Request Validation
 *
 * Validates chat message creation data.
 */
class CreateChatMessageRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by controller
    }

    /**
     * Get the validation rules.
     */
    public function rules(): array
    {
        return [
            'content' => ['required', 'string', 'max:2000'],
            'type' => ['sometimes', Rule::in(['text', 'alert'])],
        ];
    }

    /**
     * Get custom error messages.
     */
    public function messages(): array
    {
        return [
            'content.required' => 'Message content is required',
            'content.max' => 'Message cannot exceed 2000 characters',
            'type.in' => 'Message type must be either text or alert',
        ];
    }
}
