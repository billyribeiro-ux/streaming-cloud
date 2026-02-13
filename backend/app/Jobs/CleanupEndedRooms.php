<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Room;
use App\Models\RoomParticipant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Cleanup Ended Rooms Job
 *
 * Scheduled job that runs daily to clean up rooms that ended more than
 * 24 hours ago. Removes stale participant records and updates final
 * statistics for the rooms.
 */
class CleanupEndedRooms implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * Execute the job.
     *
     * Finds rooms that ended more than 24 hours ago and:
     * - Removes stale participant records (participants still marked as active)
     * - Updates final room statistics (total duration, total participants)
     */
    public function handle(): void
    {
        Log::info('Starting cleanup of ended rooms');

        $cutoff = now()->subHours(24);
        $cleanedCount = 0;
        $participantsCleanedCount = 0;

        Room::where('status', Room::STATUS_ENDED)
            ->where('actual_end', '<', $cutoff)
            ->chunk(100, function ($rooms) use (&$cleanedCount, &$participantsCleanedCount) {
                foreach ($rooms as $room) {
                    DB::transaction(function () use ($room, &$cleanedCount, &$participantsCleanedCount) {
                        // Clean up stale participant records (participants who never got marked as left)
                        $staleParticipants = RoomParticipant::where('room_id', $room->id)
                            ->whereNull('left_at')
                            ->count();

                        if ($staleParticipants > 0) {
                            RoomParticipant::where('room_id', $room->id)
                                ->whereNull('left_at')
                                ->update([
                                    'left_at' => $room->actual_end ?? now(),
                                    'connection_state' => 'disconnected',
                                ]);

                            $participantsCleanedCount += $staleParticipants;
                        }

                        // Update final statistics
                        $totalParticipants = RoomParticipant::where('room_id', $room->id)
                            ->distinct('user_id')
                            ->count('user_id');

                        $totalDurationMinutes = (int) DB::table('room_sessions')
                            ->where('room_id', $room->id)
                            ->whereNotNull('ended_at')
                            ->selectRaw('SUM(TIMESTAMPDIFF(SECOND, started_at, ended_at)) / 60 as total_minutes')
                            ->value('total_minutes') ?? 0;

                        $room->update([
                            'total_participants' => $totalParticipants,
                            'total_duration_minutes' => $totalDurationMinutes,
                        ]);

                        $cleanedCount++;
                    });
                }
            });

        Log::info('Ended rooms cleanup complete', [
            'rooms_cleaned' => $cleanedCount,
            'stale_participants_cleaned' => $participantsCleanedCount,
        ]);
    }
}
