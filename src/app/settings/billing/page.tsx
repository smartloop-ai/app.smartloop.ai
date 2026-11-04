'use client';

import { Suspense } from 'react';
import { Box } from '@mui/material';
import { useAuth } from '@/app/hooks/useAuth';
import LoadingSpinner from '@/app/components/loading-spinner';
import SettingsShell from '@/app/settings/settings-shell';
import BillingSection from '@/app/settings/sections/billing';
import CreditsSection from '@/app/settings/sections/credits';

export default function BillingSettings() {
  const [user] = useAuth();
  if (!user) return null;
  return (
    <SettingsShell user={user}>
      {/* BillingSection reads ?plan=pro for the checkout hand-off. */}
      <Suspense fallback={<LoadingSpinner />}>
        <BillingSection />
      </Suspense>
      {/* What the plan buys this month, under the plan itself. */}
      <Box className="mt-10">
        <CreditsSection user={user} />
      </Box>
    </SettingsShell>
  );
}
