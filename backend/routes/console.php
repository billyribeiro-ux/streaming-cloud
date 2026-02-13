<?php

declare(strict_types=1);

use App\Jobs\CleanupEndedRooms;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Console Routes / Scheduled Tasks
|--------------------------------------------------------------------------
|
| Below are the scheduled tasks for the application. These are registered
| using Laravel's Schedule facade and run via the scheduler cron entry.
|
*/

// Clean up rooms that ended more than 24 hours ago - daily at 2:00 AM
Schedule::job(new CleanupEndedRooms())->dailyAt('02:00')
    ->withoutOverlapping()
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/cleanup-ended-rooms.log'));

// Archive old data (rooms >1 year, messages >6 months) - weekly on Sundays at 3:00 AM
Schedule::command('data:archive')->weeklyOn(0, '03:00')
    ->withoutOverlapping()
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/archive-old-data.log'));
