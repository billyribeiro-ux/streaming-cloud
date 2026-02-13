<?php

declare(strict_types=1);

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * RoomException - Domain exception for room-related errors.
 *
 * Provides static factory methods for common room error scenarios,
 * each with an appropriate HTTP status code. The render() method
 * produces a consistent JSON error response.
 */
class RoomException extends \Exception
{
    protected int $statusCode;

    public function __construct(string $message = '', int $statusCode = Response::HTTP_BAD_REQUEST, ?\Throwable $previous = null)
    {
        $this->statusCode = $statusCode;
        parent::__construct($message, 0, $previous);
    }

    /**
     * Room creation limit has been reached for the subscription plan.
     */
    public static function limitReached(string $message): static
    {
        return new static($message, Response::HTTP_FORBIDDEN);
    }

    /**
     * The room is already in a live streaming state.
     */
    public static function alreadyLive(string $message): static
    {
        return new static($message, Response::HTTP_UNPROCESSABLE_ENTITY);
    }

    /**
     * The user is not authorized to perform the requested action.
     */
    public static function unauthorized(string $message): static
    {
        return new static($message, Response::HTTP_FORBIDDEN);
    }

    /**
     * The user cannot join the room (capacity, permissions, or state).
     */
    public static function cannotJoin(string $message): static
    {
        return new static($message, Response::HTTP_FORBIDDEN);
    }

    /**
     * The requested resource was not found.
     */
    public static function notFound(string $message): static
    {
        return new static($message, Response::HTTP_NOT_FOUND);
    }

    /**
     * An invalid moderation or room action was requested.
     */
    public static function invalidAction(string $message): static
    {
        return new static($message, Response::HTTP_BAD_REQUEST);
    }

    /**
     * Get the HTTP status code for this exception.
     */
    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    /**
     * Render the exception as an HTTP JSON response.
     */
    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'error' => class_basename($this),
        ], $this->statusCode);
    }
}
