'use client'

import { useState } from 'react';
import { Box, IconButton, Popover, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { APP_DESCRIPTION } from '@/app/constants';
import Logo from './logo';

export default function AuthHeader() {
  const [helpAnchorEl, setHelpAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <Box className="flex justify-between items-center p-6">
      <Logo />
      <IconButton
        onClick={(e) => setHelpAnchorEl(e.currentTarget)}
        sx={{
          border: '1px solid var(--border-2)',
          borderRadius: '8px',
          color: 'var(--content)',
          '&:hover': {
            bgcolor: 'var(--border)',
          },
        }}
      >
        <HelpOutlineIcon />
      </IconButton>
      <Popover
        open={Boolean(helpAnchorEl)}
        anchorEl={helpAnchorEl}
        onClose={() => setHelpAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            bgcolor: 'var(--border)',
            border: '1px solid var(--border-2)',
            borderRadius: '12px',
            maxWidth: '400px',
            mt: 1,
          }
        }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            {APP_DESCRIPTION}
          </Typography>
        </Box>
      </Popover>
    </Box>
  );
}
