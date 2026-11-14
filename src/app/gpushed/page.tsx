'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/hooks/useAuth';
import SettingsShell from '@/app/settings/settings-shell';
import GpushedSection from '@/app/gpushed/gpushed-section';

// TEMP: superusers only until gpushed launches (its API isn't deployed yet).
// At launch, remove the redirect here and adminOnly on the sidebar group.
export default function GpushedPage() {
  const [user] = useAuth();
  const router = useRouter();
  const denied = !!user && !user.admin;
  useEffect(() => {
    if (denied) router.replace('/dashboard');
  }, [denied, router]);
  return <SettingsShell user={user}>{denied ? null : <GpushedSection user={user} />}</SettingsShell>;
}
