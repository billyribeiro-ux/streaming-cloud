<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Recording;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Process Recording Job
 *
 * Handles post-processing of a recording after it has been stopped.
 * Updates recording metadata (file size, duration) and marks the
 * recording as ready or failed.
 *
 * Retries up to 3 times with exponential backoff: 30s, 60s, 120s.
 */
class ProcessRecording implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * The backoff intervals (in seconds) between retries.
     *
     * @var array<int, int>
     */
    public array $backoff = [30, 60, 120];

    public function __construct(
        private readonly Recording $recording
    ) {}

    /**
     * Execute the job.
     *
     * Processes the recording file: updates file size, verifies the file
     * exists in storage, and transitions the status to ready or failed.
     */
    public function handle(): void
    {
        Log::info('Processing recording', [
            'recording_id' => $this->recording->id,
            'room_id' => $this->recording->room_id,
        ]);

        try {
            $recording = Recording::findOrFail($this->recording->id);

            // Build the expected file path for the recording
            $filePath = "recordings/{$recording->room_id}/{$recording->id}.webm";

            // Check if the file exists in storage
            if (Storage::disk('s3')->exists($filePath)) {
                $fileSize = Storage::disk('s3')->size($filePath);

                $recording->update([
                    'status' => Recording::STATUS_READY,
                    'file_path' => $filePath,
                    'file_size' => $fileSize,
                ]);

                Log::info('Recording processed successfully', [
                    'recording_id' => $recording->id,
                    'file_path' => $filePath,
                    'file_size' => $fileSize,
                ]);
            } else {
                // File not yet available - may still be uploading from SFU
                // If this is the final attempt, mark as failed
                if ($this->attempts() >= $this->tries) {
                    $recording->update([
                        'status' => Recording::STATUS_FAILED,
                        'metadata' => array_merge($recording->metadata ?? [], [
                            'failure_reason' => 'Recording file not found in storage after all retry attempts.',
                            'failed_at' => now()->toIso8601String(),
                        ]),
                    ]);

                    Log::error('Recording processing failed - file not found', [
                        'recording_id' => $recording->id,
                        'expected_path' => $filePath,
                    ]);
                } else {
                    // Release back to queue for retry
                    $this->release($this->backoff[$this->attempts() - 1] ?? 120);
                }
            }
        } catch (\Throwable $e) {
            Log::error('Recording processing error', [
                'recording_id' => $this->recording->id,
                'error' => $e->getMessage(),
                'attempt' => $this->attempts(),
            ]);

            if ($this->attempts() >= $this->tries) {
                $this->recording->update([
                    'status' => Recording::STATUS_FAILED,
                    'metadata' => array_merge($this->recording->metadata ?? [], [
                        'failure_reason' => $e->getMessage(),
                        'failed_at' => now()->toIso8601String(),
                    ]),
                ]);
            }

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(?\Throwable $exception): void
    {
        Log::error('ProcessRecording job failed permanently', [
            'recording_id' => $this->recording->id,
            'error' => $exception?->getMessage(),
        ]);

        $this->recording->update([
            'status' => Recording::STATUS_FAILED,
            'metadata' => array_merge($this->recording->metadata ?? [], [
                'failure_reason' => $exception?->getMessage() ?? 'Unknown error',
                'failed_at' => now()->toIso8601String(),
            ]),
        ]);
    }
}
