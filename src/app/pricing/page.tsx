'use client';

// The app has no pricing page — plans and prices are the marketing site's job.
// This stub keeps old links working: ?plan=pro or ?plan=plus still means "buy
// now" and goes to checkout, anything else goes out to smartloop.ai/pricing.

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/app/components/loading-spinner';
import { PURCHASABLE_PLANS, checkoutPath } from '@/app/shared/utils';
import { PRICING_URL } from '@/app/constants';

function PricingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // ?plan=pro or ?plan=plus means "buy now" — hand straight to checkout.
    const plan = new URLSearchParams(window.location.search).get('plan');
    if (plan && PURCHASABLE_PLANS[plan]) {
      router.replace(checkoutPath(plan));
      return;
    }
    // Leaves the app entirely, so router.replace() won't do.
    window.location.replace(PRICING_URL);
  }, [router, searchParams]);

  return <LoadingSpinner showLogo message="Redirecting..." size={48} />;
}

export default function Pricing() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PricingRedirect />
    </Suspense>
  );
}
