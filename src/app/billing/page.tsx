'use client';

/**
 * Billing moved under Settings. This redirect keeps older bookmarks, Stripe
 * return URLs, and the `?plan=pro` deep link working — the query string is
 * carried through so the checkout hand-off still fires.
 */

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/app/components/loading-spinner';

function BillingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    router.replace(`/settings/billing${query ? `?${query}` : ''}`);
  }, [router, searchParams]);

  return <LoadingSpinner />;
}

export default function Billing() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BillingRedirect />
    </Suspense>
  );
}
