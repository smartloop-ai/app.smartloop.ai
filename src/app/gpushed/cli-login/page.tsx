'use client';

/**
 * Approve a gpushed CLI sign-in. `gpushed login` opens
 * /gpushed/cli-login?code=XXXX-XXXX; once you approve here, the CLI (which
 * polls the gpushed API) gets its token. The code is shown in your terminal
 * too: approving only when they match stops someone from getting you to sign
 * in their terminal with a link of theirs.
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import AuthHeader from '@/app/components/auth-header';
import LoadingSpinner from '@/app/components/loading-spinner';
import { GPUSHED_ENDPOINT } from '@/app/constants';
import { userService } from '@/app/services/user.service';

type State = 'loading' | 'ready' | 'approving' | 'approved' | 'error';

function CliLoginContent() {
  const searchParams = useSearchParams();
  const code = (searchParams.get('code') ?? '').toUpperCase();
  const [state, setState] = useState<State>('loading');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  // Signed out: sign in first, then come back here with the same code.
  useEffect(() => {
    const back = `/gpushed/cli-login?code=${encodeURIComponent(code)}`;
    userService
      .get()
      .then((u: any) => {
        if (!u) {
          window.location.href = `/login?redirect=${encodeURIComponent(back)}`;
          return;
        }
        setEmail(u.email ?? '');
        setState('ready');
      })
      .catch(() => {
        window.location.href = `/login?redirect=${encodeURIComponent(back)}`;
      });
  }, [code]);

  const approve = async () => {
    setState('approving');
    try {
      const r: Response | undefined = await userService.makeAuthenticatedRequest(`${GPUSHED_ENDPOINT}/auth/cli/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_code: code }),
      });
      if (!r) return; // session expired: makeAuthenticatedRequest sends you to /login
      if (r.ok) {
        setState('approved');
        return;
      }
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? 'Could not approve this sign-in. Run gpushed login again.');
      setState('error');
    } catch {
      setError('Could not reach gpushed. Try again in a moment.');
      setState('error');
    }
  };

  if (state === 'loading') {
    return <LoadingSpinner showLogo message="Checking your session..." size={48} />;
  }

  // Same card and controls as /login, so approving reads as part of signing in.
  const primaryButtonClass =
    'w-full flex items-center justify-center gap-2 py-4 rounded-lg font-medium transition-all '
    + 'bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed '
    + 'disabled:hover:bg-pink-500';

  const card = (children: React.ReactNode) => (
    <Box className="min-h-screen bg-bg flex flex-col">
      <AuthHeader />
      <Box className="flex-1 flex flex-col items-center px-6">
        <div className="flex-[2]" aria-hidden />
        <Box
          sx={{
            maxWidth: '460px',
            width: '100%',
            bgcolor: 'var(--surface-2)',
            border: '1px solid var(--border-2)',
            borderRadius: '16px',
            padding: '40px',
          }}
        >
          {children}
        </Box>
        <div className="flex-[3]" aria-hidden />
      </Box>
    </Box>
  );

  if (state === 'approved') {
    return card(
      <>
        <h1 className="text-3xl font-normal text-content mb-2">gpushed is signed in</h1>
        <p className="text-sm text-muted">
          Head back to your terminal; you can close this tab.
        </p>
      </>
    );
  }

  if (!code) {
    return card(
      <>
        <h1 className="text-3xl font-normal text-content mb-2">No sign-in code</h1>
        <p className="text-sm text-muted">
          Run <span className="text-content font-mono">gpushed login</span> in your terminal; it opens this page with its code.
        </p>
      </>
    );
  }

  // The code in the same boxes /login uses for emailed codes, dash between groups.
  const [first, second] = code.split('-');
  const boxes = (group: string) =>
    Array.from(group ?? '').map((ch, i) => (
      <span
        key={i}
        className="w-[48px] h-[56px] flex items-center justify-center rounded-lg text-xl font-medium font-mono bg-surface text-content border border-border-2"
      >
        {ch}
      </span>
    ));

  return card(
    <>
      <h1 className="text-3xl font-normal text-content mb-2">Sign in to gpushed</h1>
      <p className="text-sm text-muted mb-8">
        Approve only if your terminal shows this code
        {email && <> and you meant to sign in as <span className="text-content">{email}</span></>}.
      </p>

      <Box className="flex justify-center items-center gap-2 mb-6" aria-label={`Sign-in code ${code}`}>
        {boxes(first)}
        <span className="text-muted text-xl" aria-hidden>–</span>
        {boxes(second)}
      </Box>

      {state === 'error' && (
        <Box className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-800 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </Box>
      )}

      <button type="button" onClick={approve} disabled={state === 'approving'} className={`${primaryButtonClass} mb-6`}>
        {state === 'approving' && <CircularProgress size={18} sx={{ color: 'inherit' }} />}
        Approve
      </button>

      <Box className="text-center">
        <p className="text-sm text-muted">
          Didn&apos;t run <span className="text-content font-mono">gpushed login</span>? Close this tab; nothing is signed in.
        </p>
      </Box>
    </>
  );
}

export default function GpushedCliLogin() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CliLoginContent />
    </Suspense>
  );
}
