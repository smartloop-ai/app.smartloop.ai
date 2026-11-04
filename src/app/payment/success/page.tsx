'use client';

// Landing page for successful Stripe checkout. The backend sets the checkout
// session's success_url to /payment/success; without this route the user would
// land on a blank 404 after paying. We confirm the upgrade, then send them into
// the billing view where their Pro plan is reflected.

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LoadingSpinner from '@/app/components/loading-spinner';
import AuthHeader from '@/app/components/auth-header';

function PaymentSuccessContent() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(4);

  // Auto-forward to the billing page after a short beat so the user can see the
  // confirmation, while still landing on their live Pro plan.
  useEffect(() => {
    if (countdown <= 0) {
      router.push('/billing');
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, router]);

  return (
    <Box className="min-h-screen bg-bg flex flex-col">
      <AuthHeader />

      <Box className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-[460px] w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10">
          <div className="flex flex-col items-center gap-6 text-center">
            <CheckCircleOutlineIcon sx={{ fontSize: 56, color: '#ec4899' }} />
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold text-content">You&apos;re on Pro 🎉</h3>
              {/* Deliberately claims no specific features. This used to promise
                  "unlimited projects", which Free also gets — feature copy that
                  lives anywhere but the marketing site goes stale unnoticed. */}
              <p className="text-muted text-sm">
                Thanks for upgrading! Your Pro plan is now active.
              </p>
            </div>

            <button
              onClick={() => router.push('/billing')}
              className="w-full py-4 rounded-lg font-medium transition-all bg-pink-500 text-white hover:bg-pink-600"
            >
              View billing
            </button>

            <p className="text-xs text-faint">
              Redirecting in {countdown}s…
            </p>
          </div>
        </div>
      </Box>
    </Box>
  );
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
