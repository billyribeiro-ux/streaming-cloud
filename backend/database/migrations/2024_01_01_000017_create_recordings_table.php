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
        Schema::create('recordings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('room_id');
            $table->uuid('session_id')->nullable();
            $table->enum('status', ['recording', 'processing', 'ready', 'failed'])
                ->default('recording');
            $table->string('file_path')->nullable();
            $table->bigInteger('file_size')->nullable();
            $table->integer('duration_seconds')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
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

            $table->index(['room_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('recordings');
    }
};
