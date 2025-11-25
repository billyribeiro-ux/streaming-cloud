<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create Room Request Validation
 *
 * Validates and sanitizes room creation requests
 */
class CreateRoomRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by policies
    }

    /**
     * Get the validation rules
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'min:3',
                'max:255',
                'regex:/^[a-zA-Z0-9\s\-_]+$/', // Alphanumeric, spaces, hyphens, underscores only
            ],
            'description' => [
                'nullable',
                'string',
                'max:1000',
            ],
            'slug' => [
                'nullable',
                'string',
                'max:100',
                'regex:/^[a-z0-9\-]+$/', // Lowercase, numbers, hyphens only
                'unique:rooms,slug',
            ],
            'scheduled_start' => [
                'nullable',
                'date',
                'after:now',
            ],
            'scheduled_end' => [
                'nullable',
                'date',
                'after:scheduled_start',
            ],
            'recording_enabled' => [
                'sometimes',
                'boolean',
            ],
            'settings' => [
                'sometimes',
                'array',
            ],
            'settings.max_participants' => [
                'sometimes',
                'integer',
                'min:1',
                'max:10000',
            ],
            'settings.allow_chat' => [
                'sometimes',
                'boolean',
            ],
            'settings.allow_reactions' => [
                'sometimes',
                'boolean',
            ],
            'settings.allow_screen_share' => [
                'sometimes',
                'boolean',
            ],
            'settings.require_approval' => [
                'sometimes',
                'boolean',
            ],
            'settings.waiting_room' => [
                'sometimes',
                'boolean',
            ],
            'settings.mute_on_entry' => [
                'sometimes',
                'boolean',
            ],
            'settings.video_quality' => [
                'sometimes',
                'string',
                Rule::in(['360p', '480p', '720p', '1080p']),
            ],
        ];
    }

    /**
     * Get custom error messages
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Room name is required',
            'name.regex' => 'Room name can only contain letters, numbers, spaces, hyphens, and underscores',
            'scheduled_start.after' => 'Scheduled start time must be in the future',
            'scheduled_end.after' => 'Scheduled end time must be after start time',
            'settings.max_participants.max' => 'Maximum participants cannot exceed 10,000',
        ];
    }

    /**
     * Prepare data for validation
     * Sanitize input before validation
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => strip_tags($this->name ?? ''),
            'description' => strip_tags($this->description ?? ''),
        ]);
    }

    /**
     * Get validated and sanitized data
     */
    public function validated($key = null, $default = null)
    {
        $validated = parent::validated($key, $default);

        // Additional sanitization
        if (isset($validated['name'])) {
            $validated['name'] = trim($validated['name']);
        }

        if (isset($validated['description'])) {
            $validated['description'] = trim($validated['description']);
        }

        return $validated;
    }
}
