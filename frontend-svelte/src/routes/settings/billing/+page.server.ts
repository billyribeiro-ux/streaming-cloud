/** Billing settings — plans, current subscription, Checkout & Billing Portal. */

import { fail, redirect } from '@sveltejs/kit';
import {
  billingPortal,
  getSubscription,
  listOrganizations,
  listPlans,
  startCheckout,
} from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) redirect(303, '/login');
  const token = cookies.get(SESSION_COOKIE) ?? '';

  const organizations = await listOrganizations(token);
  const organization = organizations[0] ?? null;
  if (!organization) {
    return { organization: null, plans: [], subscription: null };
  }

  const [plans, subscription] = await Promise.all([
    listPlans(token),
    getSubscription(token, organization.id),
  ]);

  return { organization, plans, subscription };
};

export const actions: Actions = {
  subscribe: async ({ request, cookies, locals }) => {
    if (!locals.user) redirect(303, '/login');
    const token = cookies.get(SESSION_COOKIE) ?? '';
    const form = await request.formData();
    const organization_id = String(form.get('organization_id') ?? '');
    const plan_id = String(form.get('plan_id') ?? '');
    const billing_period = form.get('billing_period') === 'yearly' ? 'yearly' : 'monthly';

    if (!organization_id || !plan_id) {
      return fail(422, { error: 'Missing organization or plan.' });
    }

    let checkoutUrl: string;
    try {
      const result = await startCheckout(token, { organization_id, plan_id, billing_period });
      checkoutUrl = result.checkout_url;
    } catch {
      return fail(502, { error: 'Could not start checkout. Please try again.' });
    }
    redirect(303, checkoutUrl);
  },

  portal: async ({ request, cookies, locals }) => {
    if (!locals.user) redirect(303, '/login');
    const token = cookies.get(SESSION_COOKIE) ?? '';
    const form = await request.formData();
    const organization_id = String(form.get('organization_id') ?? '');

    let portalUrl: string;
    try {
      const result = await billingPortal(token, { organization_id });
      portalUrl = result.portal_url;
    } catch {
      return fail(502, { error: 'Could not open the billing portal.' });
    }
    redirect(303, portalUrl);
  },
};
