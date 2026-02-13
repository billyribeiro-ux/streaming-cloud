<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create Alert Request Validation
 *
 * Validates alert creation data.
 */
class CreateAlertRequest extends FormRequest
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
            'type' => ['required', Rule::in(['info', 'warning', 'trade', 'announcement'])],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:2000'],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
        ];
    }

    /**
     * Get custom error messages.
     */
    public function messages(): array
    {
        return [
            'type.required' => 'Alert type is required',
            'type.in' => 'Alert type must be one of: info, warning, trade, announcement',
            'title.required' => 'Alert title is required',
            'title.max' => 'Alert title cannot exceed 255 characters',
            'message.required' => 'Alert message is required',
            'message.max' => 'Alert message cannot exceed 2000 characters',
            'priority.in' => 'Priority must be one of: low, medium, high, urgent',
        ];
    }
}
