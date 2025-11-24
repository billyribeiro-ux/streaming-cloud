<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\RoomController;
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
    });
});
