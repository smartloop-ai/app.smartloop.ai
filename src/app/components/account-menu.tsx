'use client';

/**
 * The avatar + account dropdown from the old top nav.
 *
 * Navigation moved into the sidebar (see app-shell.tsx), so this is reduced to
 * identity and the two account actions that do not belong in a nav list.
 * The theme toggle now lives at the foot of the sidebar.
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Menu, MenuItem } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { userService } from '@/app/services/user.service';

export default function AccountMenu({ user }: { user?: any }) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  const [liveUser, setLiveUser] = useState(user);
  const lastTokenCount = useRef(user?.number_of_tokens_processed || 0);

  useEffect(() => {
    setLiveUser(user);
    lastTokenCount.current = user?.number_of_tokens_processed || 0;
  }, [user]);

  const refreshUserData = async () => {
    try {
      const updatedUser = await userService.get();
      if (updatedUser) {
        setLiveUser(updatedUser);
        lastTokenCount.current = updatedUser.number_of_tokens_processed || 0;
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  useEffect(() => {
    const handleRefresh = () => { refreshUserData(); };
    window.addEventListener('refreshUserTokens', handleRefresh);
    return () => window.removeEventListener('refreshUserTokens', handleRefresh);
  }, []);

  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = () => {
    // Only clear auth tokens, keep chat history
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('u');
    sessionStorage.clear();
    router.push('/login');
    handleMenuClose();
  };

  if (!user) return null;

  return (
    <>
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        className="w-9 h-9 rounded-md flex items-center justify-center overflow-hidden cursor-pointer shrink-0 transition-colors"
        sx={{
          bgcolor: 'var(--accent-soft)',
          border: '1px solid var(--accent-border)',
          '&:hover': { bgcolor: 'var(--accent-soft)', opacity: 0.85 },
        }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
          {user.name
            ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
            : 'U'}
        </span>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            border: '1px solid var(--border-2)',
            borderRadius: '12px',
            minWidth: '220px',
            mt: 1,
          },
        }}
      >
        <Box className="px-4 py-3">
          <Box className="text-content text-sm font-medium leading-tight">{user.name || 'User'}</Box>
          {user.email && (
            <Box className="text-faint text-xs leading-tight mt-0.5 truncate">{user.email}</Box>
          )}
          <Box className="text-muted text-xs leading-tight mt-1.5">
            {(user.is_paid || user.is_premium ? 'Pro Plan' : 'Free Plan')}
          </Box>
        </Box>

        <Box sx={{ borderTop: '1px solid var(--border-2)' }} />

        <MenuItem
          onClick={() => { router.push('/profile'); handleMenuClose(); }}
          sx={{
            color: 'var(--content)',
            fontSize: '14px',
            mt: 0.5,
            '&:hover': { bgcolor: 'var(--surface-2)' },
          }}
        >
          <PersonOutlineIcon sx={{ fontSize: 18, mr: 2, color: 'var(--muted)' }} />
          Profile
        </MenuItem>

        <MenuItem
          onClick={handleLogout}
          sx={{
            color: 'var(--danger-text)',
            fontSize: '14px',
            '&:hover': { bgcolor: 'var(--surface-2)' },
          }}
        >
          <LogoutIcon sx={{ fontSize: 18, mr: 2, color: 'var(--danger-text)' }} />
          Logout
        </MenuItem>
      </Menu>
    </>
  );
}
