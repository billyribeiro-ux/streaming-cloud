<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PlanSeeder extends Seeder
{
    /**
     * Seed the subscription plans.
     *
     * Uses updateOrCreate on the name (slug) field to be idempotent.
     */
    public function run(): void
    {
        $plans = [
            [
                'name' => Plan::STARTER,
                'display_name' => 'Starter',
                'price_monthly' => 29.00,
                'price_yearly' => 290.00,
                'stripe_price_id_monthly' => 'price_starter_monthly',
                'stripe_price_id_yearly' => 'price_starter_yearly',
                'max_rooms' => 3,
                'max_workspaces' => 2,
                'max_hosts_per_room' => 1,
                'max_viewers_per_room' => 50,
                'max_storage_gb' => 5,
                'features' => [
                    'recording' => false,
                    'analytics' => false,
                    'custom_branding' => false,
                    'api_access' => false,
                ],
                'is_active' => true,
            ],
            [
                'name' => Plan::PROFESSIONAL,
                'display_name' => 'Professional',
                'price_monthly' => 79.00,
                'price_yearly' => 790.00,
                'stripe_price_id_monthly' => 'price_professional_monthly',
                'stripe_price_id_yearly' => 'price_professional_yearly',
                'max_rooms' => 10,
                'max_workspaces' => 5,
                'max_hosts_per_room' => 3,
                'max_viewers_per_room' => 200,
                'max_storage_gb' => 25,
                'features' => [
                    'recording' => true,
                    'analytics' => true,
                    'custom_branding' => false,
                    'api_access' => false,
                ],
                'is_active' => true,
            ],
            [
                'name' => Plan::BUSINESS,
                'display_name' => 'Business',
                'price_monthly' => 199.00,
                'price_yearly' => 1990.00,
                'stripe_price_id_monthly' => 'price_business_monthly',
                'stripe_price_id_yearly' => 'price_business_yearly',
                'max_rooms' => 50,
                'max_workspaces' => 20,
                'max_hosts_per_room' => 5,
                'max_viewers_per_room' => 1000,
                'max_storage_gb' => 100,
                'features' => [
                    'recording' => true,
                    'analytics' => true,
                    'custom_branding' => true,
                    'api_access' => true,
                ],
                'is_active' => true,
            ],
            [
                'name' => Plan::ENTERPRISE,
                'display_name' => 'Enterprise',
                'price_monthly' => 499.00,
                'price_yearly' => 4990.00,
                'stripe_price_id_monthly' => 'price_enterprise_monthly',
                'stripe_price_id_yearly' => 'price_enterprise_yearly',
                'max_rooms' => -1,
                'max_workspaces' => -1,
                'max_hosts_per_room' => -1,
                'max_viewers_per_room' => -1,
                'max_storage_gb' => 500,
                'features' => [
                    'recording' => true,
                    'analytics' => true,
                    'custom_branding' => true,
                    'api_access' => true,
                ],
                'is_active' => true,
            ],
        ];

        foreach ($plans as $planData) {
            Plan::updateOrCreate(
                ['name' => $planData['name']],
                $planData,
            );
        }
    }
}
