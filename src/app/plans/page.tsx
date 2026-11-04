'use client';

// The billing dashboard moved to /billing. This stub only exists so links
// already in the wild — the marketing site's /plans?plan=pro among them — keep
// working. It forwards the query string untouched so the ?plan=pro hand-off to
// checkout still happens on the other side.
//
// Static export means there is no server redirect to do this for us.

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/app/components/loading-spinner';

function PlansRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    router.replace(query ? `/billing?${query}` : '/billing');
  }, [router, searchParams]);

  return <LoadingSpinner showLogo size={48} />;
}

export default function Plans() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PlansRedirect />
    </Suspense>
  );
}
