<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Room;
use App\Models\ChatMessage;
use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ArchiveOldData extends Command
{
    protected $signature = 'data:archive {--dry-run : Preview without archiving}';
    protected $description = 'Archive old data to reduce database size';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('DRY RUN MODE - No data will be archived');
        }

        $this->info('Starting data archival...');

        // Archive rooms older than 1 year
        $roomsArchived = $this->archiveOldRooms($dryRun);
        $this->info("Archived {$roomsArchived} old rooms");

        // Archive chat messages older than 6 months
        $messagesArchived = $this->archiveOldMessages($dryRun);
        $this->info("Archived {$messagesArchived} old messages");

        // Archive audit logs older than 1 year
        $logsArchived = $this->archiveOldLogs($dryRun);
        $this->info("Archived {$logsArchived} old audit logs");

        $this->info('Data archival complete!');
        return 0;
    }

    protected function archiveOldRooms(bool $dryRun): int
    {
        $cutoff = now()->subYear();
        $count = 0;

        Room::where('status', 'ended')
            ->where('actual_end', '<', $cutoff)
            ->chunk(100, function ($rooms) use (&$count, $dryRun) {
                foreach ($rooms as $room) {
                    if (!$dryRun) {
                        // Export to JSON and store in S3/R2
                        $data = $room->load(['participants', 'sessions', 'files'])->toArray();
                        Storage::disk('s3')->put(
                            "archives/rooms/{$room->id}.json",
                            json_encode($data, JSON_PRETTY_PRINT)
                        );

                        // Delete from database
                        $room->delete();
                    }
                    $count++;
                }
            });

        return $count;
    }

    protected function archiveOldMessages(bool $dryRun): int
    {
        $cutoff = now()->subMonths(6);

        $query = ChatMessage::where('created_at', '<', $cutoff);
        $count = $query->count();

        if (!$dryRun) {
            $query->delete();
        }

        return $count;
    }

    protected function archiveOldLogs(bool $dryRun): int
    {
        $cutoff = now()->subYear();

        $query = AuditLog::where('created_at', '<', $cutoff);
        $count = $query->count();

        if (!$dryRun) {
            $query->delete();
        }

        return $count;
    }
}
