'use client';

import { useAuth } from '@/app/hooks/useAuth';
import SettingsShell from '@/app/settings/settings-shell';
import AdminOnly from '@/app/cloud-models/admin-only';
import GpushedSection from '@/app/gpushed/gpushed-section';

// TEMP: admin-only (like Cloud Models) until gpushed launches; remove AdminOnly
// here and adminOnly on the sidebar group then.
export default function GpushedPage() {
  const [user] = useAuth();
  return (
    <SettingsShell user={user}>
      <AdminOnly user={user}>
        <GpushedSection user={user} />
      </AdminOnly>
    </SettingsShell>
  );
}
