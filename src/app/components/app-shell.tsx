'use client';

/**
 * The signed-in application shell: a persistent left sidebar, a slim top bar,
 * and the page content.
 *
 * Navigation used to live as links centred in the top bar. As sections were
 * consolidated under Settings that list shrank to a single item marooned in the
 * middle of the bar, so navigation moved here. The sidebar is the app's nav:
 * grouped, always visible, and able to grow without redesigning the header.
 */

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, Switch } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import TerminalIcon from '@mui/icons-material/Terminal';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import HistoryIcon from '@mui/icons-material/History';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import Logo from '@/app/components/logo';
import AccountMenu from '@/app/components/account-menu';
import { useTheme } from '@/app/components/theme-provider';

const SIDEBAR_WIDTH = 248;

// `heading: null` renders the group without a label — used for the top item so
// it does not need a header of its own.
const NAV_GROUPS: {
  heading: string | null;
  adminOnly?: boolean;
  items: { label: string; path: string; icon: typeof TravelExploreIcon }[];
}[] = [
  {
    heading: null,
    items: [
      { label: 'Overview', path: '/dashboard', icon: SpaceDashboardOutlinedIcon },
      { label: 'Models', path: '/models', icon: MemoryOutlinedIcon },
    ],
  },
  {
    heading: 'Cloud Models',
    // TEMP: cloud models are superuser-only in the API until launch.
    adminOnly: true,
    items: [
      { label: 'Usage', path: '/cloud-models/usage', icon: CloudOutlinedIcon },
      { label: 'Session History', path: '/cloud-models/history', icon: HistoryIcon },
    ],
  },
  {
    heading: 'Settings',
    items: [
      { label: 'Web Search', path: '/settings/websearch', icon: TravelExploreIcon },
      { label: 'Access Tokens', path: '/settings/tokens', icon: TerminalIcon },
      { label: 'Billing', path: '/settings/billing', icon: ReceiptLongOutlinedIcon },
    ],
  },
  {
    heading: 'Account',
    items: [{ label: 'Profile', path: '/profile', icon: PersonOutlineIcon }],
  },
];

function SidebarContent({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const go = (path: string) => {
    router.push(path);
    onNavigate?.();
  };

  return (
    <Box className="flex flex-col h-full">
      <Box className="h-16 flex items-center px-5 shrink-0">
        <Logo />
      </Box>

      <Box component="nav" className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.filter((g) => isAdmin || !g.adminOnly).map((group, gi) => (
          <Box key={group.heading ?? gi} className={gi === 0 ? '' : 'mt-7'}>
            {group.heading && (
              <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
                {group.heading}
              </div>
            )}
            <Box className="flex flex-col gap-0.5">
              {group.items.map(({ label, path, icon: Icon }) => {
                const isActive = pathname === path || pathname.startsWith(`${path}/`);
                return (
                  <Box
                    key={path}
                    component="button"
                    onClick={() => go(path)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left w-full transition-colors ${
                      isActive
                        ? 'bg-surface-2 text-content font-medium'
                        : 'text-muted hover:bg-surface-2 hover:text-content'
                    }`}
                  >
                    <Icon
                      sx={{ fontSize: 18, color: isActive ? 'var(--accent-text)' : 'var(--muted)' }}
                    />
                    {label}
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Theme sits at the foot of the rail rather than inside the account
          menu — it is a display preference, not an account action. */}
      <Box
        className="shrink-0 px-5 py-4 flex items-center justify-between"
        sx={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-sm text-muted">Theme</span>
        <Switch
          size="small"
          checked={theme === 'dark'}
          onChange={toggleTheme}
          inputProps={{ 'aria-label': 'Toggle dark mode' }}
        />
      </Box>
    </Box>
  );
}

export default function AppShell({ user, children }: { user?: any; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box className="min-h-screen bg-bg text-content">
      {/* Desktop sidebar */}
      <Box
        component="aside"
        className="hidden md:block fixed inset-y-0 left-0 z-30"
        sx={{ width: SIDEBAR_WIDTH, borderRight: '1px solid var(--border)', bgcolor: 'var(--surface)' }}
      >
        <SidebarContent isAdmin={!!user?.admin} />
      </Box>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <Box
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed inset-0 z-40"
            sx={{ bgcolor: 'rgba(0,0,0,0.5)' }}
          />
          <Box
            component="aside"
            className="md:hidden fixed inset-y-0 left-0 z-50"
            sx={{ width: SIDEBAR_WIDTH, borderRight: '1px solid var(--border)', bgcolor: 'var(--surface)' }}
          >
            <SidebarContent isAdmin={!!user?.admin} onNavigate={() => setDrawerOpen(false)} />
          </Box>
        </>
      )}

      <Box className="md:pl-[248px] flex flex-col min-h-screen">
        <Box
          component="header"
          className="h-16 shrink-0 flex items-center gap-3 px-4 md:px-8 sticky top-0 z-20"
          sx={{
            borderBottom: '1px solid var(--border)',
            bgcolor: 'var(--surface)',
          }}
        >
          <Box
            component="button"
            onClick={() => setDrawerOpen((v) => !v)}
            className="md:hidden p-2 -ml-2 rounded-lg text-muted hover:bg-surface-2 hover:text-content transition-colors"
            aria-label="Toggle navigation"
          >
            {drawerOpen ? <CloseIcon sx={{ fontSize: 20 }} /> : <MenuIcon sx={{ fontSize: 20 }} />}
          </Box>

          <Box className="md:hidden">
            <Logo />
          </Box>

          <Box className="flex-1" />
          <AccountMenu user={user} />
        </Box>

        <Box className="flex-1 w-full px-4 md:px-8 py-8">{children}</Box>
      </Box>
    </Box>
  );
}
