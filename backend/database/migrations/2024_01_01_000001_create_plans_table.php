<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 50)->unique();
            $table->string('display_name', 100);
            $table->decimal('price_monthly', 10, 2)->default(0);
            $table->decimal('price_yearly', 10, 2)->nullable();
            $table->string('stripe_price_id_monthly')->nullable();
            $table->string('stripe_price_id_yearly')->nullable();
            $table->integer('max_workspaces')->default(1);
            $table->integer('max_rooms')->default(3);
            $table->integer('max_hosts_per_room')->default(1);
            $table->integer('max_viewers_per_room')->default(50);
            $table->integer('max_storage_gb')->default(5);
            $table->json('features')->default(json_encode([
                'recording' => false,
                'analytics' => false,
                'api_access' => false,
                'custom_branding' => false,
            ]));
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
