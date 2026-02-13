<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\AlertController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ChatController;
use App\Http\Controllers\Api\V1\RoomController;
use App\Http\Controllers\Api\V1\WorkspaceController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\MetricsController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Health check endpoints (no auth required)
Route::get('/health', [HealthController::class, 'index']);
Route::get('/health/ready', [HealthController::class, 'ready']);
Route::get('/health/live', [HealthController::class, 'live']);
Route::get('/health/detailed', [HealthController::class, 'detailed']);

// Metrics endpoint for Prometheus (no auth required, but should be firewalled)
Route::get('/metrics', [MetricsController::class, 'index']);

// Auth routes (no middleware for register/login)
Route::prefix('v1/auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
    });
});

// V1 API routes
Route::prefix('v1')->group(function () {
    // Public routes
    Route::get('/rooms/public', [RoomController::class, 'publicRooms']);

    // Authenticated routes
    Route::middleware(['auth:sanctum', 'rate.limit'])->group(function () {
        // Room management
        Route::apiResource('rooms', RoomController::class);
        Route::post('/rooms/{room}/join', [RoomController::class, 'join']);
        Route::post('/rooms/{room}/leave', [RoomController::class, 'leave']);
        Route::get('/rooms/{room}/participants', [RoomController::class, 'participants']);
        Route::post('/rooms/{room}/invite', [RoomController::class, 'invite']);
        Route::post('/rooms/{room}/start', [RoomController::class, 'start']);
        Route::post('/rooms/{room}/end', [RoomController::class, 'end']);
        Route::post('/rooms/{room}/moderate', [RoomController::class, 'moderate']);

        // Workspace management
        Route::apiResource('workspaces', WorkspaceController::class);
        Route::get('/workspaces/{workspace}/members', [WorkspaceController::class, 'members']);
        Route::post('/workspaces/{workspace}/members', [WorkspaceController::class, 'addMember']);
        Route::delete('/workspaces/{workspace}/members/{user}', [WorkspaceController::class, 'removeMember']);

        // Chat messages
        Route::get('/rooms/{room}/messages', [ChatController::class, 'index']);
        Route::post('/rooms/{room}/messages', [ChatController::class, 'store']);
        Route::delete('/messages/{message}', [ChatController::class, 'destroy']);

        // Alerts
        Route::get('/rooms/{room}/alerts', [AlertController::class, 'index']);
        Route::post('/rooms/{room}/alerts', [AlertController::class, 'store']);
        Route::delete('/alerts/{alert}', [AlertController::class, 'destroy']);
    });
});
