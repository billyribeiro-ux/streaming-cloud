/**
 * BillingPage - Subscription plans and billing management
 *
 * Features:
 * - Current plan display
 * - Available plans comparison
 * - Upgrade/downgrade buttons
 * - Dark theme
 */

import { Check, CreditCard, Zap, Crown, Building2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const plans = [
  {
    name: 'Starter',
    icon: Zap,
    price: 0,
    period: 'forever',
    description: 'For individuals getting started',
    features: [
      '1 room at a time',
      'Up to 10 participants',
      'Basic chat',
      '720p video',
      'Community support',
    ],
    current: true,
  },
  {
    name: 'Professional',
    icon: Crown,
    price: 49,
    period: 'month',
    description: 'For active traders and small teams',
    features: [
      '5 concurrent rooms',
      'Up to 100 participants',
      'Chat + alerts',
      '1080p video',
      'Screen sharing',
      'Recording',
      'Priority support',
    ],
    popular: true,
    current: false,
  },
  {
    name: 'Enterprise',
    icon: Building2,
    price: 199,
    period: 'month',
    description: 'For organizations and trading firms',
    features: [
      'Unlimited rooms',
      'Up to 1000 participants',
      'All features',
      '4K video',
      'Custom branding',
      'API access',
      'SLA guarantee',
      'Dedicated support',
    ],
    current: false,
  },
];

function BillingPage() {
  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-600/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Billing & Plans
            </h2>
            <p className="text-sm text-gray-400">
              Manage your subscription and billing
            </p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Current Plan</p>
              <p className="text-lg font-semibold text-white">Starter (Free)</p>
            </div>
            <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded-full">
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              'bg-gray-800 rounded-xl p-6 border transition-colors',
              plan.popular
                ? 'border-blue-500 ring-1 ring-blue-500/20'
                : 'border-gray-700'
            )}
          >
            {plan.popular && (
              <span className="inline-block px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full mb-3">
                Most Popular
              </span>
            )}

            <div className="flex items-center gap-2 mb-2">
              <plan.icon className="w-5 h-5 text-gray-300" />
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
            </div>

            <p className="text-sm text-gray-400 mb-4">{plan.description}</p>

            <div className="mb-6">
              <span className="text-3xl font-bold text-white">
                ${plan.price}
              </span>
              <span className="text-gray-400 text-sm">/{plan.period}</span>
            </div>

            <ul className="space-y-2.5 mb-6">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-gray-300"
                >
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              className={cn(
                'w-full py-2.5 rounded-lg text-sm font-medium transition-colors',
                plan.current
                  ? 'bg-gray-700 text-gray-400 cursor-default'
                  : plan.popular
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
              )}
              disabled={plan.current}
            >
              {plan.current ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BillingPage;
