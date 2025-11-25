<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'min:3', 'max:255', 'regex:/^[a-zA-Z0-9\s\-_]+$/'],
            'description' => ['sometimes', 'string', 'max:1000'],
            'scheduled_start' => ['sometimes', 'date'],
            'scheduled_end' => ['sometimes', 'date', 'after:scheduled_start'],
            'recording_enabled' => ['sometimes', 'boolean'],
            'settings' => ['sometimes', 'array'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('name')) {
            $this->merge(['name' => strip_tags($this->name)]);
        }
        if ($this->has('description')) {
            $this->merge(['description' => strip_tags($this->description)]);
        }
    }
}
