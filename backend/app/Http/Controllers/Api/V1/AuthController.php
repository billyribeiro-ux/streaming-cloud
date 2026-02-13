<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

/**
 * Auth Controller - API endpoints for authentication and profile management
 *
 * @group Authentication
 *
 * Endpoints for user registration, login, logout, and profile management.
 */
class AuthController extends Controller
{
    /**
     * Register a new user
     *
     * Creates a new user account along with a default organization.
     *
     * @bodyParam name string required The user's full name. Max: 255 characters.
     * @bodyParam email string required The user's email address. Must be unique.
     * @bodyParam password string required The password. Min: 8 characters.
     * @bodyParam password_confirmation string required Password confirmation.
     *
     * @response 201 scenario="Created" {
     *   "data": {"user": {...}, "token": "..."},
     *   "message": "Registration successful"
     * }
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $result = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
            ]);

            $organization = Organization::create([
                'name' => $validated['name'] . "'s Organization",
            ]);

            OrganizationMember::create([
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'role' => OrganizationMember::ROLE_OWNER,
                'accepted_at' => now(),
            ]);

            $token = $user->createToken('auth-token')->plainTextToken;

            return [
                'user' => $user,
                'token' => $token,
            ];
        });

        return response()->json([
            'data' => [
                'user' => new UserResource($result['user']),
                'token' => $result['token'],
            ],
            'message' => 'Registration successful',
        ], Response::HTTP_CREATED);
    }

    /**
     * Login
     *
     * Authenticate a user and return a token.
     *
     * @bodyParam email string required The user's email address.
     * @bodyParam password string required The user's password.
     *
     * @response 200 scenario="Success" {
     *   "data": {"user": {...}, "token": "..."},
     *   "message": "Login successful"
     * }
     * @response 401 scenario="Invalid Credentials" {
     *   "message": "Invalid credentials"
     * }
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $validated = $request->validated();

        if (!Auth::attempt([
            'email' => $validated['email'],
            'password' => $validated['password'],
        ])) {
            return response()->json([
                'message' => 'Invalid credentials',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $user = User::where('email', $validated['email'])->firstOrFail();
        $user->update(['last_login_at' => now()]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'data' => [
                'user' => new UserResource($user),
                'token' => $token,
            ],
            'message' => 'Login successful',
        ]);
    }

    /**
     * Logout
     *
     * Revoke the current authentication token.
     *
     * @response 200 scenario="Success" {
     *   "message": "Logged out successfully"
     * }
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully',
        ]);
    }

    /**
     * Get authenticated user
     *
     * Return the currently authenticated user with their organization.
     *
     * @response 200 scenario="Success" {
     *   "data": {"id": "uuid", "name": "John", "email": "john@example.com", ...}
     * }
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('organizations');

        return response()->json([
            'data' => new UserResource($user),
        ]);
    }

    /**
     * Update profile
     *
     * Update the authenticated user's profile information.
     *
     * @bodyParam name string The user's name.
     * @bodyParam display_name string The user's display name.
     * @bodyParam avatar_url string The user's avatar URL.
     * @bodyParam timezone string The user's timezone.
     * @bodyParam preferences object The user's preferences.
     *
     * @response 200 scenario="Updated" {
     *   "data": {...},
     *   "message": "Profile updated successfully"
     * }
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'display_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'avatar_url' => ['sometimes', 'nullable', 'string', 'url', 'max:2048'],
            'timezone' => ['sometimes', 'nullable', 'string', 'max:100'],
            'preferences' => ['sometimes', 'nullable', 'array'],
        ]);

        $user = $request->user();
        $user->update($validated);

        return response()->json([
            'data' => new UserResource($user->fresh()),
            'message' => 'Profile updated successfully',
        ]);
    }
}
