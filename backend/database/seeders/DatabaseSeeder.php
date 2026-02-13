<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * Run order matters: Plans must exist before DemoSeeder
     * can assign a subscription.
     */
    public function run(): void
    {
        $this->call([
            PlanSeeder::class,
            DemoSeeder::class,
        ]);
    }
}
