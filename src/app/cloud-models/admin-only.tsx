'use client';

/**
 * TEMP: cloud models are superuser-only in the API until launch
 * (REMOTE_MODELS_SUPERUSER_ONLY), so these pages are too. Anyone else who
 * lands on one by URL goes back to the dashboard. Remove at launch.
 *
 * While the user is still loading the children render, so the page can show
 * its headings. They carry no data: the API refuses non-admins anyway.
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminOnly({ user, children }: { user: any; children: ReactNode }) {
  const router = useRouter();
  const denied = !!user && !user.admin;
  useEffect(() => {
    if (denied) router.replace('/dashboard');
  }, [denied, router]);
  return denied ? null : <>{children}</>;
}
