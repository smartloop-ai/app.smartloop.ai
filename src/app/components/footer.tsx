'use client';

import { Box } from '@mui/material';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        borderTop: '1px solid var(--border)',
        mt: 'auto',
      }}
    >
      <Box
        className="mx-auto flex flex-col sm:flex-row items-center justify-between gap-2"
        sx={{
          maxWidth: '1024px',
          px: { xs: 2, md: 3 },
          py: 3,
        }}
      >
        <span className="text-xs text-faint">
          © {year} Smartloop Inc. All rights reserved.
        </span>
        <Box className="flex items-center gap-x-5">
          <a
            href="https://smartloop.ai/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-faint hover:text-muted transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="https://smartloop.ai/terms/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-faint hover:text-muted transition-colors"
          >
            Terms of Service
          </a>
        </Box>
      </Box>
    </Box>
  );
}
