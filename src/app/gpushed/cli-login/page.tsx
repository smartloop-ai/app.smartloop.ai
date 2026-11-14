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
import { Box } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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

  const button =
    'px-8 py-4 rounded-lg font-medium transition-all text-lg w-full text-center bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-60';

  return (
    <Box className="min-h-screen bg-bg flex flex-col">
      <AuthHeader />
      <Box className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-[460px] w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10">
          {state === 'approved' ? (
            <div className="flex flex-col items-center gap-6">
              <CheckCircleIcon sx={{ fontSize: 56, color: 'var(--accent-text)' }} />
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-semibold text-content">gpushed is signed in</h3>
                <p className="text-muted text-sm">Head back to your terminal; you can close this tab.</p>
              </div>
            </div>
          ) : !code ? (
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-semibold text-content">No sign-in code</h3>
              <p className="text-muted text-sm">
                Run <code className="font-mono">gpushed login</code> in your terminal; it opens this page with its code.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-semibold text-content">Sign in to gpushed?</h3>
                <p className="text-muted text-sm">
                  Approve only if your terminal shows this code{email && <> and you meant to sign in as {email}</>}.
                </p>
              </div>
              <div className="font-mono text-3xl tracking-[0.2em] text-content py-2">{code}</div>
              {state === 'error' && <p className="text-sm text-center text-red-500">{error}</p>}
              <button type="button" onClick={approve} disabled={state === 'approving'} className={button}>
                {state === 'approving' ? 'Approving…' : 'Approve'}
              </button>
              <p className="text-xs text-center text-muted">
                Didn&apos;t run <code className="font-mono">gpushed login</code>? Close this tab; nothing is signed in.
              </p>
            </div>
          )}
        </div>
      </Box>
    </Box>
  );
}

export default function GpushedCliLogin() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CliLoginContent />
    </Suspense>
  );
}
