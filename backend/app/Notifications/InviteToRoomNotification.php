<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\Room;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Invite To Room Notification
 *
 * Sent to users when they are invited to join a streaming room.
 * Delivered via mail and stored in the database.
 */
class InviteToRoomNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Room $room,
        private readonly User $invitedBy
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

        $mail = (new MailMessage())
            ->subject("You've been invited to join \"{$this->room->name}\"")
            ->greeting("Hello {$notifiable->name}!")
            ->line("{$this->invitedBy->name} has invited you to join the room \"{$this->room->name}\".");

        if ($this->room->description) {
            $mail->line("Description: {$this->room->description}");
        }

        if ($this->room->scheduled_start) {
            $mail->line("Scheduled start: {$this->room->scheduled_start->toDayDateTimeString()}");
        }

        $mail->action('Join Room', $joinUrl)
            ->line('Thank you for using ' . config('app.name') . '!');

        return $mail;
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
            'invited_by_id' => $this->invitedBy->id,
            'invited_by_name' => $this->invitedBy->name,
            'scheduled_start' => $this->room->scheduled_start?->toIso8601String(),
        ];
    }
}
