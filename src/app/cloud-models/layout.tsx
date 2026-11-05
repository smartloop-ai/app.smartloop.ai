'use client';

/**
 * The frame for every Cloud Models page. A layout stays mounted while you move
 * between its child routes, so going from Usage to Session History swaps only
 * the section: the sidebar and header stay put and /users/me is not fetched
 * again.
 *
 * The frame and the pages render before the user has loaded. Each section
 * shows its headings straight away and fills in its numbers as they arrive,
 * instead of the whole screen appearing at once.
 */

import type { ReactNode } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import SettingsShell from '@/app/settings/settings-shell';
import AdminOnly from '@/app/cloud-models/admin-only';
import { CloudUserContext } from '@/app/cloud-models/user-context';

export default function CloudModelsLayout({ children }: { children: ReactNode }) {
  const [user] = useAuth();
  return (
    <SettingsShell user={user}>
      <AdminOnly user={user}>
        <CloudUserContext.Provider value={user}>{children}</CloudUserContext.Provider>
      </AdminOnly>
    </SettingsShell>
  );
}
