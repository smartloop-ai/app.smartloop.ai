'use client';

import { useAuth } from '@/app/hooks/useAuth';
import SettingsShell from '@/app/settings/settings-shell';
import TokensSection from '@/app/settings/sections/tokens';

export default function TokenSettings() {
  const [user] = useAuth();
  if (!user) return null;
  return (
    <SettingsShell user={user}>
      <TokensSection user={user} />
    </SettingsShell>
  );
}
