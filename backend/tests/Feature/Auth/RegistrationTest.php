<?php

declare(strict_types=1);

use App\Models\User;

it('can register a new user', function (): void {
    $response = $this->postJson('/api/v1/auth/register', [
        'name' => 'John Doe',
        'email' => 'john@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertStatus(201)
        ->assertJsonStructure([
            'data' => [
                'user',
                'token',
            ],
            'message',
        ])
        ->assertJson([
            'message' => 'Registration successful',
        ]);

    expect($response->json('data.token'))->toBeString()->not->toBeEmpty();

    $this->assertDatabaseHas('users', [
        'email' => 'john@example.com',
        'name' => 'John Doe',
    ]);

    // Verify a default organization was created for the user
    $this->assertDatabaseHas('organizations', [
        'name' => "John Doe's Organization",
    ]);

    // Verify the user is an owner of the organization
    $user = User::where('email', 'john@example.com')->first();

    $this->assertDatabaseHas('organization_members', [
        'user_id' => $user->id,
        'role' => 'owner',
    ]);
});

it('validates registration input', function (): void {
    $response = $this->postJson('/api/v1/auth/register', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'email', 'password']);
});

it('prevents duplicate email registration', function (): void {
    User::factory()->create([
        'email' => 'existing@example.com',
    ]);

    $response = $this->postJson('/api/v1/auth/register', [
        'name' => 'Another User',
        'email' => 'existing@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});
