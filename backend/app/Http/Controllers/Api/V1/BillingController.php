<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Billing Controller - Manages subscription plans and Stripe billing.
 *
 * Provides endpoints for listing plans, creating checkout sessions,
 * accessing the Stripe billing portal, and viewing current subscription status.
 *
 * @group Billing
 */
class BillingController extends Controller
{
    /**
     * List available subscription plans.
     *
     * Returns all active plans with their pricing and feature details.
     *
     * @response 200 scenario="Success" {
     *   "data": [
     *     {"id": "uuid", "name": "starter", "price_monthly": "29.00", ...}
     *   ]
     * }
     */
    public function plans(): JsonResponse
    {
        $plans = Plan::where('is_active', true)
            ->orderBy('price_monthly', 'asc')
            ->get();

        return response()->json(['data' => $plans]);
    }

    /**
     * Create a Stripe Checkout session for subscribing to a plan.
     *
     * @bodyParam plan_id string required The UUID of the plan to subscribe to.
     * @bodyParam billing_period string required "monthly" or "yearly".
     * @bodyParam organization_id string required The organization UUID.
     *
     * @response 200 scenario="Success" {"checkout_url": "https://checkout.stripe.com/..."}
     * @response 422 scenario="Validation Error" {"message": "..."}
     */
    public function subscribe(Request $request): JsonResponse
    {
        $request->validate([
            'plan_id' => 'required|uuid|exists:plans,id',
            'billing_period' => 'required|in:monthly,yearly',
            'organization_id' => 'required|uuid|exists:organizations,id',
        ]);

        $plan = Plan::findOrFail($request->plan_id);
        $organization = Organization::findOrFail($request->organization_id);

        $priceId = $request->billing_period === 'yearly'
            ? $plan->stripe_price_id_yearly
            : $plan->stripe_price_id_monthly;

        if (!$priceId) {
            return response()->json(
                ['message' => 'Stripe price not configured for this plan and billing period.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        try {
            \Stripe\Stripe::setApiKey(config('services.stripe.secret'));

            $checkoutSession = \Stripe\Checkout\Session::create([
                'mode' => 'subscription',
                'customer' => $organization->stripe_customer_id ?: null,
                'customer_email' => $organization->stripe_customer_id
                    ? null
                    : $request->user()->email,
                'line_items' => [[
                    'price' => $priceId,
                    'quantity' => 1,
                ]],
                'metadata' => [
                    'organization_id' => $organization->id,
                    'plan_id' => $plan->id,
                    'user_id' => $request->user()->id,
                ],
                'success_url' => config('app.frontend_url') . '/billing/success?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url' => config('app.frontend_url') . '/billing/cancel',
            ]);

            return response()->json([
                'checkout_url' => $checkoutSession->url,
            ]);
        } catch (\Stripe\Exception\ApiErrorException $e) {
            Log::error('Stripe checkout session creation failed', [
                'error' => $e->getMessage(),
                'organization_id' => $organization->id,
                'plan_id' => $plan->id,
            ]);

            return response()->json(
                ['message' => 'Failed to create checkout session. Please try again.'],
                Response::HTTP_INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Create a Stripe Billing Portal session.
     *
     * Allows the customer to manage their subscription, update payment
     * methods, and view invoices through Stripe's hosted portal.
     *
     * @bodyParam organization_id string required The organization UUID.
     *
     * @response 200 scenario="Success" {"portal_url": "https://billing.stripe.com/..."}
     */
    public function portal(Request $request): JsonResponse
    {
        $request->validate([
            'organization_id' => 'required|uuid|exists:organizations,id',
        ]);

        $organization = Organization::findOrFail($request->organization_id);

        if (!$organization->stripe_customer_id) {
            return response()->json(
                ['message' => 'No billing account found. Please subscribe to a plan first.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        try {
            \Stripe\Stripe::setApiKey(config('services.stripe.secret'));

            $portalSession = \Stripe\BillingPortal\Session::create([
                'customer' => $organization->stripe_customer_id,
                'return_url' => config('app.frontend_url') . '/billing',
            ]);

            return response()->json([
                'portal_url' => $portalSession->url,
            ]);
        } catch (\Stripe\Exception\ApiErrorException $e) {
            Log::error('Stripe billing portal session creation failed', [
                'error' => $e->getMessage(),
                'organization_id' => $organization->id,
            ]);

            return response()->json(
                ['message' => 'Failed to create billing portal session. Please try again.'],
                Response::HTTP_INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get the current subscription for an organization.
     *
     * @queryParam organization_id string required The organization UUID.
     *
     * @response 200 scenario="Success" {
     *   "data": {
     *     "subscription": {...},
     *     "plan": {...}
     *   }
     * }
     */
    public function currentSubscription(Request $request): JsonResponse
    {
        $request->validate([
            'organization_id' => 'required|uuid|exists:organizations,id',
        ]);

        $organization = Organization::with('subscription.plan')
            ->findOrFail($request->organization_id);

        $subscription = $organization->subscription;

        if (!$subscription) {
            return response()->json([
                'data' => [
                    'subscription' => null,
                    'plan' => null,
                    'has_active_subscription' => false,
                ],
            ]);
        }

        return response()->json([
            'data' => [
                'subscription' => [
                    'id' => $subscription->id,
                    'status' => $subscription->status,
                    'current_period_start' => $subscription->current_period_start?->toIso8601String(),
                    'current_period_end' => $subscription->current_period_end?->toIso8601String(),
                    'trial_ends_at' => $subscription->trial_ends_at?->toIso8601String(),
                    'cancelled_at' => $subscription->cancelled_at?->toIso8601String(),
                    'on_grace_period' => $subscription->onGracePeriod(),
                ],
                'plan' => $subscription->plan,
                'has_active_subscription' => $organization->hasActiveSubscription(),
            ],
        ]);
    }
}
