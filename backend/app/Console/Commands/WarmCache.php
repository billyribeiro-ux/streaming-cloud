<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\CacheService;
use App\Models\Organization;

class WarmCache extends Command
{
    protected $signature = 'cache:warm {--organizations=* : Specific organization IDs to warm}';
    protected $description = 'Warm critical caches proactively';

    public function handle(CacheService $cache): int
    {
        $this->info('Starting cache warming...');

        $orgIds = $this->option('organizations');

        $query = Organization::with(['subscription.plan', 'members', 'workspaces']);

        if (!empty($orgIds)) {
            $query->whereIn('id', $orgIds);
        }

        $count = 0;
        $query->chunk(100, function ($organizations) use ($cache, &$count) {
            foreach ($organizations as $org) {
                $cache->warmOrganizationCache($org);
                $count++;
                $this->line("Warmed cache for organization: {$org->name}");
            }
        });

        $this->info("Cache warming complete! Warmed {$count} organizations.");
        return 0;
    }
}
