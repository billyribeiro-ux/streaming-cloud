<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Alert;
use App\Models\ChatMessage;
use App\Models\Organization;
use App\Models\OrganizationMember;
use App\Models\Plan;
use App\Models\Room;
use App\Models\RoomSession;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    /**
     * Seed demo data for local development.
     */
    public function run(): void
    {
        // =====================================================================
        // Organization
        // =====================================================================

        $organization = Organization::firstOrCreate(
            ['slug' => 'trading-academy'],
            [
                'name' => 'Trading Academy',
                'settings' => [
                    'timezone' => 'UTC',
                    'language' => 'en',
                    'allow_guest_viewers' => true,
                    'require_approval' => false,
                    'default_room_settings' => [],
                ],
                'metadata' => [],
            ],
        );

        // =====================================================================
        // Users
        // =====================================================================

        $adminUser = User::firstOrCreate(
            ['email' => 'admin@tradingroom.io'],
            [
                'name' => 'Admin User',
                'password' => Hash::make('password'),
                'display_name' => 'admin',
                'timezone' => 'UTC',
                'email_verified_at' => now(),
                'preferences' => [],
            ],
        );

        $regularUser = User::firstOrCreate(
            ['email' => 'user@tradingroom.io'],
            [
                'name' => 'Regular User',
                'password' => Hash::make('password'),
                'display_name' => 'trader_joe',
                'timezone' => 'UTC',
                'email_verified_at' => now(),
                'preferences' => [],
            ],
        );

        // =====================================================================
        // Organization Memberships
        // =====================================================================

        OrganizationMember::firstOrCreate(
            [
                'organization_id' => $organization->id,
                'user_id' => $adminUser->id,
            ],
            [
                'role' => OrganizationMember::ROLE_OWNER,
                'invited_at' => now(),
                'accepted_at' => now(),
            ],
        );

        OrganizationMember::firstOrCreate(
            [
                'organization_id' => $organization->id,
                'user_id' => $regularUser->id,
            ],
            [
                'role' => OrganizationMember::ROLE_MEMBER,
                'invited_at' => now(),
                'accepted_at' => now(),
            ],
        );

        // =====================================================================
        // Subscription (Professional plan)
        // =====================================================================

        $professionalPlan = Plan::where('name', Plan::PROFESSIONAL)->first();

        if ($professionalPlan) {
            Subscription::firstOrCreate(
                ['organization_id' => $organization->id],
                [
                    'plan_id' => $professionalPlan->id,
                    'stripe_subscription_id' => null,
                    'status' => 'active',
                    'current_period_start' => now(),
                    'current_period_end' => now()->addMonth(),
                ],
            );
        }

        // =====================================================================
        // Workspaces
        // =====================================================================

        $forexWorkspace = Workspace::firstOrCreate(
            [
                'organization_id' => $organization->id,
                'slug' => 'forex-trading',
            ],
            [
                'name' => 'Forex Trading',
                'description' => 'Live forex trading sessions and market analysis.',
            ],
        );

        $cryptoWorkspace = Workspace::firstOrCreate(
            [
                'organization_id' => $organization->id,
                'slug' => 'crypto-analysis',
            ],
            [
                'name' => 'Crypto Analysis',
                'description' => 'Cryptocurrency market analysis and trading strategies.',
            ],
        );

        // Workspace memberships
        foreach ([$forexWorkspace, $cryptoWorkspace] as $workspace) {
            WorkspaceMember::firstOrCreate(
                [
                    'workspace_id' => $workspace->id,
                    'user_id' => $adminUser->id,
                ],
                ['role' => WorkspaceMember::ROLE_ADMIN],
            );

            WorkspaceMember::firstOrCreate(
                [
                    'workspace_id' => $workspace->id,
                    'user_id' => $regularUser->id,
                ],
                ['role' => WorkspaceMember::ROLE_VIEWER],
            );
        }

        // =====================================================================
        // Rooms (5 rooms across workspaces)
        // =====================================================================

        $rooms = [];

        // Forex workspace rooms
        $rooms[] = Room::firstOrCreate(
            ['slug' => 'morning-forex-briefing'],
            [
                'workspace_id' => $forexWorkspace->id,
                'organization_id' => $organization->id,
                'name' => 'Morning Forex Briefing',
                'description' => 'Daily morning briefing covering major forex pairs and economic events.',
                'status' => Room::STATUS_SCHEDULED,
                'scheduled_start' => now()->addDay()->setTime(9, 0),
                'created_by' => $adminUser->id,
                'settings' => [
                    'max_participants' => 100,
                    'allow_chat' => true,
                    'allow_reactions' => true,
                    'allow_screen_share' => true,
                    'require_approval' => false,
                    'waiting_room' => false,
                    'mute_on_entry' => true,
                    'simulcast' => true,
                    'video_quality' => '720p',
                ],
            ],
        );

        $rooms[] = Room::firstOrCreate(
            ['slug' => 'eur-usd-live-trading'],
            [
                'workspace_id' => $forexWorkspace->id,
                'organization_id' => $organization->id,
                'name' => 'EUR/USD Live Trading',
                'description' => 'Live trading session focused on EUR/USD pair with real-time analysis.',
                'status' => Room::STATUS_LIVE,
                'scheduled_start' => now()->subHour(),
                'actual_start' => now()->subMinutes(45),
                'created_by' => $adminUser->id,
                'settings' => [
                    'max_participants' => 200,
                    'allow_chat' => true,
                    'allow_reactions' => true,
                    'allow_screen_share' => true,
                    'require_approval' => false,
                    'waiting_room' => false,
                    'mute_on_entry' => true,
                    'simulcast' => true,
                    'video_quality' => '1080p',
                ],
                'recording_enabled' => true,
                'total_participants' => 47,
                'peak_participants' => 52,
            ],
        );

        $rooms[] = Room::firstOrCreate(
            ['slug' => 'weekly-forex-review'],
            [
                'workspace_id' => $forexWorkspace->id,
                'organization_id' => $organization->id,
                'name' => 'Weekly Forex Review',
                'description' => 'End of week review of forex trades, wins, losses, and lessons learned.',
                'status' => Room::STATUS_ENDED,
                'scheduled_start' => now()->subDays(2),
                'actual_start' => now()->subDays(2),
                'actual_end' => now()->subDays(2)->addHours(2),
                'created_by' => $adminUser->id,
                'total_participants' => 85,
                'peak_participants' => 72,
                'total_duration_minutes' => 120,
                'settings' => [
                    'max_participants' => 100,
                    'allow_chat' => true,
                    'allow_reactions' => true,
                    'allow_screen_share' => true,
                    'require_approval' => false,
                    'waiting_room' => false,
                    'mute_on_entry' => true,
                    'simulcast' => true,
                    'video_quality' => '720p',
                ],
            ],
        );

        // Crypto workspace rooms
        $rooms[] = Room::firstOrCreate(
            ['slug' => 'btc-technical-analysis'],
            [
                'workspace_id' => $cryptoWorkspace->id,
                'organization_id' => $organization->id,
                'name' => 'BTC Technical Analysis',
                'description' => 'Deep dive into Bitcoin technical analysis using multiple timeframes.',
                'status' => Room::STATUS_SCHEDULED,
                'scheduled_start' => now()->addDays(2)->setTime(14, 0),
                'created_by' => $adminUser->id,
                'settings' => [
                    'max_participants' => 150,
                    'allow_chat' => true,
                    'allow_reactions' => true,
                    'allow_screen_share' => true,
                    'require_approval' => false,
                    'waiting_room' => false,
                    'mute_on_entry' => true,
                    'simulcast' => true,
                    'video_quality' => '720p',
                ],
            ],
        );

        $rooms[] = Room::firstOrCreate(
            ['slug' => 'altcoin-portfolio-review'],
            [
                'workspace_id' => $cryptoWorkspace->id,
                'organization_id' => $organization->id,
                'name' => 'Altcoin Portfolio Review',
                'description' => 'Monthly review of altcoin portfolio performance and rebalancing strategies.',
                'status' => Room::STATUS_ENDED,
                'scheduled_start' => now()->subDays(5),
                'actual_start' => now()->subDays(5),
                'actual_end' => now()->subDays(5)->addMinutes(90),
                'created_by' => $adminUser->id,
                'total_participants' => 63,
                'peak_participants' => 58,
                'total_duration_minutes' => 90,
                'settings' => [
                    'max_participants' => 100,
                    'allow_chat' => true,
                    'allow_reactions' => true,
                    'allow_screen_share' => true,
                    'require_approval' => false,
                    'waiting_room' => false,
                    'mute_on_entry' => true,
                    'simulcast' => true,
                    'video_quality' => '720p',
                ],
            ],
        );

        // =====================================================================
        // Room Session for the live room
        // =====================================================================

        $liveRoom = $rooms[1]; // EUR/USD Live Trading

        RoomSession::firstOrCreate(
            [
                'room_id' => $liveRoom->id,
                'host_user_id' => $adminUser->id,
                'ended_at' => null,
            ],
            [
                'started_at' => $liveRoom->actual_start,
                'peak_viewers' => 52,
                'metadata' => [],
            ],
        );

        // =====================================================================
        // Chat Messages (10 messages in the live room)
        // =====================================================================

        $chatMessages = [
            ['user' => $adminUser, 'content' => 'Welcome everyone to the EUR/USD live trading session!', 'type' => 'text', 'minutes_ago' => 40],
            ['user' => $regularUser, 'content' => 'Thanks for hosting this! Excited to learn.', 'type' => 'text', 'minutes_ago' => 38],
            ['user' => $adminUser, 'content' => 'Looking at the 4H chart, we can see a clear support level at 1.0850.', 'type' => 'text', 'minutes_ago' => 35],
            ['user' => $regularUser, 'content' => 'What timeframe are you using for entry signals?', 'type' => 'text', 'minutes_ago' => 32],
            ['user' => $adminUser, 'content' => 'I use the 15m chart for entries, confirmed by the 1H trend direction.', 'type' => 'text', 'minutes_ago' => 30],
            ['user' => $regularUser, 'content' => 'Makes sense. Do you use any indicators alongside price action?', 'type' => 'text', 'minutes_ago' => 27],
            ['user' => $adminUser, 'content' => 'RSI and MACD for confluence, but price action is primary.', 'type' => 'text', 'minutes_ago' => 25],
            ['user' => $regularUser, 'content' => 'I see the divergence on RSI you mentioned earlier.', 'type' => 'text', 'minutes_ago' => 20],
            ['user' => $adminUser, 'content' => 'Exactly! That bearish divergence suggests a potential pullback before continuation.', 'type' => 'text', 'minutes_ago' => 15],
            ['user' => $regularUser, 'content' => 'Great session so far. The live analysis is really helpful.', 'type' => 'text', 'minutes_ago' => 5],
        ];

        foreach ($chatMessages as $msg) {
            ChatMessage::firstOrCreate(
                [
                    'room_id' => $liveRoom->id,
                    'user_id' => $msg['user']->id,
                    'content' => $msg['content'],
                ],
                [
                    'type' => $msg['type'],
                    'is_deleted' => false,
                    'metadata' => null,
                    'created_at' => now()->subMinutes($msg['minutes_ago']),
                    'updated_at' => now()->subMinutes($msg['minutes_ago']),
                ],
            );
        }

        // =====================================================================
        // Alerts (3 alerts in the live room)
        // =====================================================================

        Alert::firstOrCreate(
            [
                'room_id' => $liveRoom->id,
                'title' => 'EUR/USD Approaching Resistance',
            ],
            [
                'user_id' => $adminUser->id,
                'type' => 'price_alert',
                'message' => 'EUR/USD is approaching key resistance at 1.0920. Watch for rejection or breakout.',
                'priority' => 'high',
                'metadata' => [
                    'symbol' => 'EUR/USD',
                    'price' => 1.0915,
                    'level' => 1.0920,
                    'direction' => 'up',
                ],
            ],
        );

        Alert::firstOrCreate(
            [
                'room_id' => $liveRoom->id,
                'title' => 'US CPI Data Release',
            ],
            [
                'user_id' => $adminUser->id,
                'type' => 'news',
                'message' => 'US CPI data release in 30 minutes. Expect increased volatility on USD pairs.',
                'priority' => 'high',
                'metadata' => [
                    'event' => 'US CPI',
                    'impact' => 'high',
                ],
            ],
        );

        Alert::firstOrCreate(
            [
                'room_id' => $liveRoom->id,
                'title' => 'RSI Divergence Detected',
            ],
            [
                'user_id' => $adminUser->id,
                'type' => 'indicator',
                'message' => 'Bearish RSI divergence detected on the 1H timeframe for EUR/USD.',
                'priority' => 'medium',
                'metadata' => [
                    'indicator' => 'RSI',
                    'timeframe' => '1H',
                    'signal' => 'bearish_divergence',
                ],
            ],
        );
    }
}
