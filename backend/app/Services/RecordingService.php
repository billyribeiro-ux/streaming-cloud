<?php

declare(strict_types=1);

namespace App\Services;

use App\Jobs\ProcessRecording;
use App\Models\Recording;
use App\Models\Room;
use App\Models\RoomSession;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Recording Service - Manages room recording lifecycle
 *
 * Responsibilities:
 * - Start and stop recordings for room sessions
 * - Retrieve recording lists and metadata
 * - Delete recordings and their associated storage files
 *
 * @package App\Services
 */
class RecordingService
{
    public function __construct(
        private readonly FileUploadService $fileUploadService
    ) {}

    /**
     * Start a recording for a room session.
     *
     * Creates a recording metadata record and returns the recording ID and status.
     *
     * @param Room $room The room being recorded
     * @param RoomSession $session The active session to record
     * @return array{recording_id: string, status: string, started_at: string}
     */
    public function startRecording(Room $room, RoomSession $session): array
    {
        $recording = Recording::create([
            'room_id' => $room->id,
            'session_id' => $session->id,
            'status' => Recording::STATUS_RECORDING,
            'started_at' => now(),
            'metadata' => [
                'room_name' => $room->name,
                'host_user_id' => $session->host_user_id,
                'initiated_at' => now()->toIso8601String(),
            ],
        ]);

        Log::info('Recording started', [
            'recording_id' => $recording->id,
            'room_id' => $room->id,
            'session_id' => $session->id,
        ]);

        return [
            'recording_id' => $recording->id,
            'status' => $recording->status,
            'started_at' => $recording->started_at->toIso8601String(),
        ];
    }

    /**
     * Stop an active recording.
     *
     * Updates the recording status to processing and dispatches the
     * ProcessRecording job to handle file post-processing.
     *
     * @param string $recordingId The ID of the recording to stop
     *
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException
     */
    public function stopRecording(string $recordingId): void
    {
        $recording = Recording::findOrFail($recordingId);

        $recording->update([
            'status' => Recording::STATUS_PROCESSING,
            'ended_at' => now(),
            'duration_seconds' => $recording->started_at
                ? (int) now()->diffInSeconds($recording->started_at)
                : null,
        ]);

        // Dispatch processing job
        ProcessRecording::dispatch($recording);

        Log::info('Recording stopped and queued for processing', [
            'recording_id' => $recording->id,
            'duration_seconds' => $recording->duration_seconds,
        ]);
    }

    /**
     * Get all recordings for a room.
     *
     * @param Room $room The room to get recordings for
     * @return Collection<int, Recording>
     */
    public function getRecordings(Room $room): Collection
    {
        return Recording::forRoom($room->id)
            ->orderBy('started_at', 'desc')
            ->get();
    }

    /**
     * Delete a recording and its associated storage file.
     *
     * @param string $recordingId The ID of the recording to delete
     *
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException
     */
    public function deleteRecording(string $recordingId): void
    {
        $recording = Recording::findOrFail($recordingId);

        // Delete the file from storage if it exists
        if ($recording->file_path) {
            $this->fileUploadService->delete($recording->file_path);
        }

        $recording->delete();

        Log::info('Recording deleted', [
            'recording_id' => $recordingId,
            'room_id' => $recording->room_id,
        ]);
    }
}
