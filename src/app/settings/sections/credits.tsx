'use client';

/**
 * Credits.
 *
 * One monthly pool pays for cloud models and web searches: a cloud session
 * at what it spent upstream once it ends, a search at a fixed price. Cloud models run on Smartloop's own provider accounts and searches
 * on its credentials, which is why both are metered; a model that runs on
 * your own machine costs nothing.
 *
 * Everything comes from GET /v1/chat/status, which is also what the apps read
 * before sending a request to a cloud model — so what this page shows is
 * exactly what the assistant is acting on. The API gives regular accounts the
 * percentage spent and keeps the credit amounts to admins, so the meter is
 * drawn from the percentage. While cloud models are limited to admins the
 * call answers 403, and the section stays out of the way.
 */

import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import TollIcon from '@mui/icons-material/Toll';
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';
import { Row, Section } from '@/app/components/rows';

interface Quota {
  /** Credits; null when unmetered (admins), or hidden from this account. */
  limit: number | null;
  used: number | null;
  remaining: number | null;
  /** 0–100 of the allowance spent; null when unmetered. */
  percent_used: number | null;
  /** Open cloud sessions, each holding credits until it is charged. */
  in_flight: number;
  period: string;
  resets_at: string;
  plan: 'free' | 'paid' | 'plus' | 'admin';
}

interface CreditStatus {
  enabled: boolean;
  /** 'plan_required', 'unconfigured', 'quota_exceeded' or 'quota_low'. */
  reason: string | null;
  quota: Quota;
}

const REASON_TEXT: Record<string, string> = {
  plan_required: 'Cloud models need a paid plan; on Free, your credits go to web searches. Answers still work — on the models that run on your machine.',
  unconfigured: 'No cloud model is available right now. Nothing to fix on your side.',
  quota_exceeded: "You've used this month's credits. Answers still work — on the models that run on your machine.",
  quota_low: "Too little is left this month for another cloud call. Answers still work — on the models that run on your machine.",
};

const PLAN_LABEL: Record<Quota['plan'], string> = {
  free: 'Free',
  paid: 'Pro',
  plus: 'Plus',
  admin: 'Admin',
};

const count = (n: number) => n.toLocaleString();

const resetDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

export default function CreditsSection({ user }: { user: any }) {
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cloud models aren't open to this account (403 while they are limited to
  // admins, 404 when the deployment has none): nothing to meter, so nothing
  // to show.
  const [hidden, setHidden] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const response = await userService.makeAuthenticatedRequest(
        `${API_ENDPOINT}/chat/status`,
        { method: 'GET' }
      );
      if (response && response.ok) {
        setStatus(await response.json());
      } else if (response && (response.status === 403 || response.status === 404)) {
        setHidden(true);
      } else {
        setError('Could not load your credits.');
      }
    } catch (err) {
      console.error('Failed to fetch cloud status:', err);
      setError('Could not load your credits.');
    }
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (hidden) return null;

  const quota = status?.quota ?? null;
  // Cloud models are off for the plan, but the pool is real: it pays for
  // searches. The status row says so; the meter still shows.
  const noAllowance = status?.reason === 'plan_required';
  const unmetered = quota != null && quota.percent_used === null;
  const pct = quota?.percent_used != null ? Math.min(100, Math.round(quota.percent_used)) : 0;
  const spent = status?.reason === 'quota_exceeded' || status?.reason === 'quota_low';
  // Credits show only for accounts the API gives the amounts to (admins).
  const amounts = quota != null && quota.limit != null && quota.used != null;
  // Amber before the wall, red at it — the point is to be warned in time to
  // upgrade, not to find out by the assistant staying on local models.
  const barColor = spent ? 'bg-danger' : pct >= 80 ? 'bg-warn' : 'bg-accent-strong';

  return (
    <Section
      title="Credits"
      description="One monthly allowance of credits pays for cloud models and web searches: a model call by how much it had to read and write, a search at a fixed price. Models that run on your own machine cost nothing. When the credits run out, the assistant stays on those and stops reaching the web."
    >
      {status === null ? (
        <Row>
          <Box className="flex items-center gap-2">
            <CircularProgress size={16} sx={{ color: 'var(--muted)' }} />
            <span className="text-sm text-faint">Loading…</span>
          </Box>
        </Row>
      ) : (
        <>
          <Row
            label="Status"
            description={
              status.enabled
                ? 'Your apps can use cloud models when a request calls for one.'
                : REASON_TEXT[status.reason ?? ''] ?? 'Cloud models are unavailable right now.'
            }
          >
            <Box className="flex items-center gap-1.5">
              {status.enabled ? (
                <>
                  <CheckCircleIcon sx={{ fontSize: 16, color: 'var(--ok-text)' }} />
                  <span className="text-sm font-medium text-ok">Active</span>
                </>
              ) : (
                <>
                  <ErrorOutlineIcon sx={{ fontSize: 16, color: 'var(--muted)' }} />
                  <span className="text-sm font-medium text-muted">
                    {spent ? 'Limit reached' : noAllowance ? 'Cloud models: paid plans' : 'Unavailable'}
                  </span>
                </>
              )}
            </Box>
          </Row>

          {quota && (
            <Row
              label="This month"
              description={
                unmetered
                  ? 'This account is not metered.'
                  : `Resets on ${resetDate(quota.resets_at)}. ${PLAN_LABEL[quota.plan]} plan.`
              }
              stacked
            >
              {unmetered ? (
                <Box className="flex items-center gap-2">
                  <TollIcon sx={{ fontSize: 16, color: 'var(--muted)' }} />
                  <span className="text-sm text-muted">
                    {quota.used != null
                      ? `${count(Math.round(quota.used))} credits used so far — unlimited`
                      : 'Unlimited'}
                  </span>
                </Box>
              ) : (
                <Box className="flex flex-col gap-2">
                  <Box className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-content">
                      {amounts ? (
                        <>
                          <span className="font-semibold">{count(quota.used!)}</span>
                          <span className="text-faint"> / {count(quota.limit!)} credits</span>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">{pct}%</span>
                          <span className="text-faint"> of this month&apos;s credits</span>
                        </>
                      )}
                    </span>
                    <span className="text-xs text-faint">
                      {amounts ? `${count(quota.remaining ?? 0)} left` : `${100 - pct}% left`}
                      {quota.in_flight > 0 &&
                        ` · ${count(quota.in_flight)} ${quota.in_flight === 1 ? 'session' : 'sessions'} open`}
                    </span>
                  </Box>
                  <Box className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                    <Box
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.max(pct, (quota.percent_used ?? 0) > 0 ? 2 : 0)}%` }}
                    />
                  </Box>
                </Box>
              )}
            </Row>
          )}
        </>
      )}

      {error && (
        <Row stacked>
          <Box className="p-3 rounded-lg border border-danger-border bg-danger-soft">
            <p className="text-sm text-danger">{error}</p>
          </Box>
        </Row>
      )}
    </Section>
  );
}
