'use client';

/** Shared frame for every Settings route: the app shell plus a page heading. */

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import AppShell from '@/app/components/app-shell';

export default function SettingsShell({
  user,
  children,
}: {
  user: any;
  children: ReactNode;
}) {
  return (
    <AppShell user={user}>
      <Box className="max-w-3xl">{children}</Box>
    </AppShell>
  );
}
