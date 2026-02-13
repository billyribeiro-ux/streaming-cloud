<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Support\Facades\Log;

/**
 * StripeWebhookService - Handles Stripe webhook event processing.
 *
 * Processes subscription lifecycle events from Stripe and updates
 * the local Organization/Subscription/Plan records accordingly.
 */
class StripeWebhookService
{
    /**
     * Handle a completed Stripe Checkout session.
     *
     * Creates or updates the organization's subscription based on the
     * checkout session metadata and line items.
     *
     * @param array<string, mixed> $session The Stripe checkout session object.
     */
    public function handleCheckoutCompleted(array $session): void
    {
        $organizationId = $session['metadata']['organization_id'] ?? null;
        $planId = $session['metadata']['plan_id'] ?? null;

        if (!$organizationId || !$planId) {
            Log::warning('Stripe webhook: checkout.session.completed missing metadata', [
                'session_id' => $session['id'] ?? null,
            ]);
            return;
        }

        $organization = Organization::find($organizationId);
        if (!$organization) {
            Log::warning('Stripe webhook: organization not found', [
                'organization_id' => $organizationId,
            ]);
            return;
        }

        $plan = Plan::find($planId);
        if (!$plan) {
            Log::warning('Stripe webhook: plan not found', ['plan_id' => $planId]);
            return;
        }

        // Update or create the subscription
        $subscription = $organization->subscription;

        if ($subscription) {
            $subscription->update([
                'plan_id' => $plan->id,
                'stripe_subscription_id' => $session['subscription'] ?? $subscription->stripe_subscription_id,
                'status' => 'active',
                'current_period_start' => now(),
                'cancelled_at' => null,
            ]);
        } else {
            Subscription::create([
                'organization_id' => $organization->id,
                'plan_id' => $plan->id,
                'stripe_subscription_id' => $session['subscription'] ?? null,
                'status' => 'active',
                'current_period_start' => now(),
            ]);
        }

        // Update Stripe customer ID on the organization if present
        if (!empty($session['customer'])) {
            $organization->update(['stripe_customer_id' => $session['customer']]);
        }

        Log::info('Stripe webhook: checkout completed', [
            'organization_id' => $organizationId,
            'plan_id' => $planId,
        ]);
    }

    /**
     * Handle a Stripe subscription update event.
     *
     * Syncs the local subscription status, period dates, and cancellation state.
     *
     * @param array<string, mixed> $subscription The Stripe subscription object.
     */
    public function handleSubscriptionUpdated(array $subscription): void
    {
        $localSubscription = Subscription::where(
            'stripe_subscription_id',
            $subscription['id']
        )->first();

        if (!$localSubscription) {
            Log::warning('Stripe webhook: subscription not found locally', [
                'stripe_subscription_id' => $subscription['id'],
            ]);
            return;
        }

        $localSubscription->update([
            'status' => $subscription['status'],
            'current_period_start' => isset($subscription['current_period_start'])
                ? \Carbon\Carbon::createFromTimestamp($subscription['current_period_start'])
                : $localSubscription->current_period_start,
            'current_period_end' => isset($subscription['current_period_end'])
                ? \Carbon\Carbon::createFromTimestamp($subscription['current_period_end'])
                : $localSubscription->current_period_end,
            'cancelled_at' => !empty($subscription['canceled_at'])
                ? \Carbon\Carbon::createFromTimestamp($subscription['canceled_at'])
                : null,
        ]);

        // If the plan changed via Stripe, update locally
        if (!empty($subscription['items']['data'][0]['price']['id'])) {
            $stripePriceId = $subscription['items']['data'][0]['price']['id'];
            $plan = Plan::where('stripe_price_id_monthly', $stripePriceId)
                ->orWhere('stripe_price_id_yearly', $stripePriceId)
                ->first();

            if ($plan && $plan->id !== $localSubscription->plan_id) {
                $localSubscription->update(['plan_id' => $plan->id]);
            }
        }

        Log::info('Stripe webhook: subscription updated', [
            'stripe_subscription_id' => $subscription['id'],
            'status' => $subscription['status'],
        ]);
    }

    /**
     * Handle a Stripe subscription deletion (cancellation) event.
     *
     * Marks the local subscription as cancelled.
     *
     * @param array<string, mixed> $subscription The Stripe subscription object.
     */
    public function handleSubscriptionDeleted(array $subscription): void
    {
        $localSubscription = Subscription::where(
            'stripe_subscription_id',
            $subscription['id']
        )->first();

        if (!$localSubscription) {
            Log::warning('Stripe webhook: subscription not found for deletion', [
                'stripe_subscription_id' => $subscription['id'],
            ]);
            return;
        }

        $localSubscription->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);

        Log::info('Stripe webhook: subscription deleted', [
            'stripe_subscription_id' => $subscription['id'],
            'organization_id' => $localSubscription->organization_id,
        ]);
    }

    /**
     * Handle a successful invoice payment from Stripe.
     *
     * Updates the subscription period dates and ensures active status.
     *
     * @param array<string, mixed> $invoice The Stripe invoice object.
     */
    public function handleInvoicePaid(array $invoice): void
    {
        $stripeSubscriptionId = $invoice['subscription'] ?? null;

        if (!$stripeSubscriptionId) {
            return;
        }

        $localSubscription = Subscription::where(
            'stripe_subscription_id',
            $stripeSubscriptionId
        )->first();

        if (!$localSubscription) {
            Log::warning('Stripe webhook: subscription not found for paid invoice', [
                'stripe_subscription_id' => $stripeSubscriptionId,
            ]);
            return;
        }

        $localSubscription->update([
            'status' => 'active',
            'current_period_start' => isset($invoice['period_start'])
                ? \Carbon\Carbon::createFromTimestamp($invoice['period_start'])
                : $localSubscription->current_period_start,
            'current_period_end' => isset($invoice['period_end'])
                ? \Carbon\Carbon::createFromTimestamp($invoice['period_end'])
                : $localSubscription->current_period_end,
        ]);

        Log::info('Stripe webhook: invoice paid', [
            'stripe_subscription_id' => $stripeSubscriptionId,
            'invoice_id' => $invoice['id'] ?? null,
        ]);
    }

    /**
     * Handle a failed invoice payment from Stripe.
     *
     * Marks the subscription as past_due to trigger UI warnings.
     *
     * @param array<string, mixed> $invoice The Stripe invoice object.
     */
    public function handleInvoicePaymentFailed(array $invoice): void
    {
        $stripeSubscriptionId = $invoice['subscription'] ?? null;

        if (!$stripeSubscriptionId) {
            return;
        }

        $localSubscription = Subscription::where(
            'stripe_subscription_id',
            $stripeSubscriptionId
        )->first();

        if (!$localSubscription) {
            Log::warning('Stripe webhook: subscription not found for failed invoice', [
                'stripe_subscription_id' => $stripeSubscriptionId,
            ]);
            return;
        }

        $localSubscription->update([
            'status' => 'past_due',
        ]);

        Log::warning('Stripe webhook: invoice payment failed', [
            'stripe_subscription_id' => $stripeSubscriptionId,
            'invoice_id' => $invoice['id'] ?? null,
            'organization_id' => $localSubscription->organization_id,
        ]);
    }
}
