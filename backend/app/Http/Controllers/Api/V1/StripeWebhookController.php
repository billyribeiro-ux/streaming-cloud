<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\StripeWebhookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Stripe Webhook Controller
 *
 * Receives and processes Stripe webhook events. Verifies the webhook
 * signature using the Stripe SDK before dispatching to the
 * StripeWebhookService for business logic processing.
 *
 * @group Billing / Webhooks
 */
class StripeWebhookController extends Controller
{
    public function __construct(
        private readonly StripeWebhookService $webhookService,
    ) {}

    /**
     * Handle incoming Stripe webhook.
     *
     * Verifies the webhook signature and dispatches the event
     * to the appropriate handler method.
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $endpointSecret = config('services.stripe.webhook_secret');

        if (!$sigHeader || !$endpointSecret) {
            return response()->json(
                ['message' => 'Missing signature or configuration'],
                Response::HTTP_BAD_REQUEST
            );
        }

        try {
            $event = \Stripe\Webhook::constructEvent(
                $payload,
                $sigHeader,
                $endpointSecret,
            );
        } catch (\Stripe\Exception\SignatureVerificationException $e) {
            Log::warning('Stripe webhook signature verification failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json(
                ['message' => 'Invalid signature'],
                Response::HTTP_FORBIDDEN
            );
        } catch (\UnexpectedValueException $e) {
            Log::warning('Stripe webhook invalid payload', [
                'error' => $e->getMessage(),
            ]);

            return response()->json(
                ['message' => 'Invalid payload'],
                Response::HTTP_BAD_REQUEST
            );
        }

        $this->dispatchEvent($event->type, $event->data->object->toArray());

        return response()->json(['status' => 'ok']);
    }

    /**
     * Dispatch a Stripe event to the appropriate service handler.
     *
     * @param string               $eventType The Stripe event type string.
     * @param array<string, mixed> $data      The event data object as array.
     */
    private function dispatchEvent(string $eventType, array $data): void
    {
        match ($eventType) {
            'checkout.session.completed' => $this->webhookService->handleCheckoutCompleted($data),
            'customer.subscription.updated' => $this->webhookService->handleSubscriptionUpdated($data),
            'customer.subscription.deleted' => $this->webhookService->handleSubscriptionDeleted($data),
            'invoice.paid' => $this->webhookService->handleInvoicePaid($data),
            'invoice.payment_failed' => $this->webhookService->handleInvoicePaymentFailed($data),
            default => Log::info('Stripe webhook: unhandled event type', [
                'event_type' => $eventType,
            ]),
        };
    }
}
