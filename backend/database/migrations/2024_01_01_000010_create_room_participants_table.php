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
        Schema::create('room_participants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('room_id');
            $table->uuid('session_id')->nullable();
            $table->uuid('user_id');
            $table->string('role')->comment('host, co_host, moderator, viewer');
            $table->string('display_name');
            $table->string('connection_state')->default('connected')->comment('connected, disconnected, reconnecting');
            $table->timestamp('joined_at');
            $table->timestamp('left_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('room_id')
                ->references('id')
                ->on('rooms')
                ->onDelete('cascade');

            $table->foreign('session_id')
                ->references('id')
                ->on('room_sessions')
                ->onDelete('set null');

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');

            // Index for active participants (partial index approximation)
            // Note: Laravel doesn't natively support partial indexes via Blueprint.
            // A raw statement is used below for the partial index on PostgreSQL.
            $table->index('room_id', 'idx_room_participants_room');
        });

        // Partial index for active participants (PostgreSQL only)
        if (config('database.default') === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement(
                'CREATE INDEX idx_room_participants_active ON room_participants (room_id) WHERE left_at IS NULL'
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('room_participants');
    }
};
