<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\Room;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Room Started Notification
 *
 * Sent to users when a room they are subscribed to goes live.
 * Delivered via mail and stored in the database.
 */
class RoomStartedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Room $room
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $joinUrl = config('app.frontend_url') . '/rooms/' . $this->room->slug;

        return (new MailMessage())
            ->subject("{$this->room->name} is now live!")
            ->greeting("Hello {$notifiable->name}!")
            ->line("The room \"{$this->room->name}\" is now live and streaming.")
            ->line('Join now to participate in the session.')
            ->action('Join Room', $joinUrl)
            ->line('Thank you for using ' . config('app.name') . '!');
    }

    /**
     * Get the array representation of the notification for database storage.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'room_id' => $this->room->id,
            'room_name' => $this->room->name,
            'started_at' => now()->toIso8601String(),
        ];
    }
}
