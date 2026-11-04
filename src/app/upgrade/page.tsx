'use client';

// Dedicated "take me to Stripe" route. Unlike /billing — which is the billing
// dashboard and only started checkout as a side effect of a ?plan=pro query —
// this page has exactly one job: get the signed-in user to Stripe checkout.
//
// Marketing links point here (directly, or via /login?plan=pro), so the intent
// survives the whole auth round-trip instead of being lost on the way to the
// dashboard. ?plan=plus buys Plus; no plan means Pro. Someone already paying
// for a lower plan is moved up through Stripe's plan-change confirmation,
// which the same API call returns.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LoadingSpinner from '@/app/components/loading-spinner';
import AuthHeader from '@/app/components/auth-header';
import { userService } from '@/app/services/user.service';
import { CHECKOUT_PATH, PURCHASABLE_PLANS, alreadyOn } from '@/app/shared/utils';
import { API_ENDPOINT } from '@/app/constants';

// Back here, plan and all, once signed in.
const loginPath = () =>
  `/login?redirect=${encodeURIComponent(`${CHECKOUT_PATH}${window.location.search}`)}`;

// The plan this visit buys: ?plan=plus, else Pro (an unknown slug reads as Pro).
const wantedPlan = () => {
  const slug = new URLSearchParams(window.location.search).get('plan') ?? 'pro';
  return PURCHASABLE_PLANS[slug] ? slug : 'pro';
};

export default function Upgrade() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Redirecting to checkout...');
  // Guards against a second Stripe session from React's double-invoked mount
  // effect in development, or from a retry landing while one is in flight.
  const checkoutInFlight = useRef(false);

  // For a user who is already subscribed. /payments/subscription carries the
  // Stripe-hosted portal URL; 404 means premium was granted outside Stripe, in
  // which case there is no portal to send them to and /billing is all we have.
  const openBillingPortal = async () => {
    if (checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setErrorMessage(null);
    setLoadingMessage('Opening your billing portal...');

    try {
      const response = await fetch(`${API_ENDPOINT}/payments/subscription`, {
        headers: { 'Authorization': `Bearer ${userService.token()}` },
      });

      if (response.ok) {
        const { portal_url } = await response.json();
        if (portal_url) {
          window.location.replace(portal_url);
          return;
        }
      }
    } catch (err) {
      console.error('Billing portal error:', err);
    }

    checkoutInFlight.current = false;
    router.replace('/billing');
  };

  const startCheckout = async () => {
    if (checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_ENDPOINT}/payments/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userService.token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan: wantedPlan() }),
      });

      if (response.ok) {
        const { checkout_url } = await response.json();
        // replace() so pressing Back from Stripe skips this page instead of
        // bouncing through it and opening a second checkout session.
        window.location.replace(checkout_url);
        return;
      }

      const errorData = await response.json().catch(() => ({}));

      if (response.status === 403) {
        const detail: string = errorData.detail || '';
        if (detail.toLowerCase().includes('verif')) {
          router.replace('/verify');
          return;
        }
        setErrorMessage(detail || 'Your account is not eligible to subscribe yet.');
      } else {
        console.error('Failed to start checkout:', errorData.detail || 'Unknown error');
        setErrorMessage('We could not start the checkout session. Please try again.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMessage('An error occurred. Please try again.');
    }

    checkoutInFlight.current = false;
  };

  useEffect(() => {
    let active = true;

    // No token at all — send them to log in and come straight back here.
    if (!userService.token()) {
      router.replace(loginPath());
      return;
    }

    userService.get()
      .then((u: any) => {
        if (!active) return;

        if (!u) {
          router.replace(loginPath());
          return;
        }

        // Already on this plan or a higher one — there is nothing to buy, so
        // send them to Stripe's customer portal instead. Paying for a lower
        // plan, checkout moves them up (the API answers with the portal's
        // plan-change confirmation). Either way this route ends up on Stripe.
        if ((u.is_paid || u.is_premium) && alreadyOn(u.plan, wantedPlan())) {
          openBillingPortal();
          return;
        }

        startCheckout();
      })
      .catch(() => {
        if (active) setErrorMessage('We could not verify your account. Please try again.');
      });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!errorMessage) {
    return <LoadingSpinner showLogo message={loadingMessage} size={48} />;
  }

  return (
    <Box className="min-h-screen bg-bg flex flex-col">
      <AuthHeader />

      <Box className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-[460px] w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10">
          <div className="flex flex-col items-center gap-6 text-center">
            <ErrorOutlineIcon sx={{ fontSize: 56, color: 'var(--muted)' }} />
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold text-content">Checkout unavailable</h3>
              <p className="text-muted text-sm">{errorMessage}</p>
            </div>

            <button
              onClick={startCheckout}
              className="w-full py-4 rounded-lg font-medium transition-all bg-pink-500 text-white hover:bg-pink-600"
            >
              Try again
            </button>

            <a
              href="/billing"
              className="text-sm text-muted hover:text-content transition-colors underline"
            >
              Back to billing
            </a>
          </div>
        </div>
      </Box>
    </Box>
  );
}
