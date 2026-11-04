'use client';

import { useAuth } from '@/app/hooks/useAuth';
import SettingsShell from '@/app/settings/settings-shell';
import WebSearchSection from '@/app/settings/sections/websearch';

export default function WebSearchSettings() {
  const [user] = useAuth();
  if (!user) return null;
  return (
    <SettingsShell user={user}>
      <WebSearchSection user={user} />
    </SettingsShell>
  );
}
