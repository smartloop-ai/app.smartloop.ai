'use client';

// Landing page for Stripe checkout cancellations. The backend sets the
// checkout session's cancel_url to /payment/cancel; without this route the
// user lands on a blank 404 after backing out of Stripe.

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Box } from '@mui/material';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import LoadingSpinner from '@/app/components/loading-spinner';
import AuthHeader from '@/app/components/auth-header';
import { CHECKOUT_PATH } from '@/app/shared/utils';

function PaymentCancelContent() {
  const router = useRouter();

  return (
    <Box className="min-h-screen bg-bg flex flex-col">
      <AuthHeader />

      <Box className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-[460px] w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10">
          <div className="flex flex-col items-center gap-6 text-center">
            <HighlightOffIcon sx={{ fontSize: 56, color: 'var(--muted)' }} />
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold text-content">Checkout canceled</h3>
              <p className="text-muted text-sm">
                No worries — your card was not charged. You can upgrade to Pro
                whenever you&apos;re ready.
              </p>
            </div>

            <button
              onClick={() => router.push(CHECKOUT_PATH)}
              className="w-full py-4 rounded-lg font-medium transition-all bg-pink-500 text-white hover:bg-pink-600"
            >
              Try again
            </button>

            <a
              href="/dashboard"
              className="text-sm text-muted hover:text-content transition-colors underline"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </Box>
    </Box>
  );
}

export default function PaymentCancel() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PaymentCancelContent />
    </Suspense>
  );
}
