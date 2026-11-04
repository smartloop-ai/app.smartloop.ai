'use client';

/**
 * Web search settings.
 *
 * There is nothing to connect here any more. Search used to be
 * bring-your-own-key — a Brave subscription token pasted into this page, which
 * before that had been pinned to one desktop machine. It now runs on
 * Smartloop's own Google Programmable Search credentials, so the account
 * configures nothing and the page's job is to answer two questions instead:
 * is search working, and how much of this month's allowance is left.
 *
 * Everything comes from GET /v1/websearch/status, which is also the call the
 * desktop app makes before every search — so what this page shows is exactly
 * what the assistant is acting on.
 */

import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';
import { CodeBlock, Row, Section } from '@/app/components/rows';

interface Quota {
  /** Searches a month's credits would buy; null means unmetered (admins). */
  limit: number | null;
  used: number;
  /** Searches the credits left this month still buy — shared with cloud models. */
  remaining: number | null;
  /** What one search costs, in credits. */
  credits_per_search?: number;
  credits_remaining?: number | null;
  period: string;
  resets_at: string;
  plan: 'free' | 'paid' | 'plus' | 'admin';
}

interface SearchStatus {
  enabled: boolean;
  provider: string | null;
  /** 'unconfigured' (our side) or 'quota_exceeded' (this account). */
  reason: string | null;
  quota: Quota | null;
}

// Exercises the real path: our endpoint runs the search server-side and
// returns result links. The User-Agent is what the access log attributes the
// call to, so the example sets one; X-API-KEY takes a personal access token
// (see the Access Tokens section) and the endpoint also accepts a Bearer JWT.
const websearchCurl = () =>
  `curl -s "${API_ENDPOINT}/websearch?q=smartloop&count=5" \\
  -H "Accept: application/json" \\
  -H "User-Agent: smartloop-curl/1.0" \\
  -H "X-API-KEY: YOUR_ACCESS_TOKEN"`;

const PLAN_LABEL: Record<Quota['plan'], string> = {
  free: 'Free',
  paid: 'Pro',
  plus: 'Plus',
  admin: 'Admin',
};

/** "1,000" — the allowances are big enough that the separator earns its place. */
const count = (n: number) => n.toLocaleString();

const resetDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

export default function WebSearchSection({ user }: { user: any }) {
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [curlCopied, setCurlCopied] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const response = await userService.makeAuthenticatedRequest(
        `${API_ENDPOINT}/websearch/status`,
        { method: 'GET' }
      );
      if (response && response.ok) {
        setStatus(await response.json());
      } else {
        setError('Could not load your web search settings.');
      }
    } catch (err) {
      console.error('Failed to fetch web search status:', err);
      setError('Could not load your web search settings.');
    }
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const quota = status?.quota ?? null;
  const unmetered = quota != null && quota.limit === null;
  // Only meaningful for a metered plan; an admin's bar would never fill.
  const pct =
    quota && quota.limit
      ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
      : 0;
  const spent = quota?.remaining === 0;
  // Amber before the wall, red at it — the point is to be warned in time to
  // upgrade, not to find out by the assistant going quiet.
  const barColor = spent ? 'bg-danger' : pct >= 80 ? 'bg-warn' : 'bg-accent-strong';

  return (
    <Section
      title="Web Search"
      description="The assistant can look things up on the web — everywhere you use Smartloop, with no setup and no API key of your own. Searches run through Smartloop, so each one costs a little of the month's credits, the same credits cloud models use; when they run out the assistant quietly falls back to the model's own knowledge."
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
                ? 'Your apps will use web search when a question needs it.'
                : status.reason === 'quota_exceeded'
                  ? "You've used this month's searches. Answers still work — they just stop reaching the web."
                  : 'Web search is unavailable right now. Nothing to fix on your side.'
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
                    {status.reason === 'quota_exceeded' ? 'Limit reached' : 'Unavailable'}
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
                  : `Resets on ${resetDate(quota.resets_at)}. ${PLAN_LABEL[quota.plan]} plan: the month's credits buy up to ${count(quota.limit!)} searches${quota.credits_per_search ? ` at ${quota.credits_per_search} credits each` : ''}.`
              }
              stacked
            >
              {unmetered ? (
                <Box className="flex items-center gap-2">
                  <TravelExploreIcon sx={{ fontSize: 16, color: 'var(--muted)' }} />
                  <span className="text-sm text-muted">
                    {count(quota.used)} searches so far — unlimited
                  </span>
                </Box>
              ) : (
                <Box className="flex flex-col gap-2">
                  <Box className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-content">
                      <span className="font-semibold">{count(quota.used)}</span>
                      <span className="text-faint"> / {count(quota.limit!)} searches</span>
                    </span>
                    <span className="text-xs text-faint">
                      {count(quota.remaining ?? 0)} left
                      {quota.credits_remaining != null ? ` · ${count(Math.round(quota.credits_remaining))} credits` : ''}
                    </span>
                  </Box>
                  <Box className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                    <Box
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.max(pct, quota.used > 0 ? 2 : 0)}%` }}
                    />
                  </Box>
                </Box>
              )}
            </Row>
          )}

          {/* Only on the plans that have somewhere to go. Shown before the
              limit is hit as well as after — finding out at zero is too late
              to be useful. The allowances themselves are on the billing page,
              read from the API, so no number is kept here. */}
          {(quota?.plan === 'free' || quota?.plan === 'paid') && (
            <Row
              label="Need more searches?"
              description={
                quota.plan === 'free'
                  ? 'Pro brings more monthly credits, and Plus more still.'
                  : 'Plus brings more monthly credits.'
              }
            >
              <a
                href="/settings/billing"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-accent-border hover:bg-accent-soft text-accent-text whitespace-nowrap"
              >
                {quota.plan === 'free' ? 'See plans' : 'Upgrade to Plus'}
              </a>
            </Row>
          )}
        </>
      )}

      {/* A diagnostic, and most useful precisely when search stops working:
          it runs the same call the apps make, through your own account. */}
      {status !== null && (
        <Row
          label="Try it"
          description={
            <>
              Runs a real search through your account — the same call your apps
              make, and it counts against the allowance above. Swap in a token
              from{' '}
              <a
                href="/settings/tokens"
                className="text-accent-text hover:opacity-80 hover:underline font-medium transition-colors"
              >
                Access Tokens
              </a>
              . A 429 means this month&apos;s searches are used up.
            </>
          }
          stacked
        >
          <CodeBlock
            code={websearchCurl()}
            copied={curlCopied}
            onCopy={() => {
              navigator.clipboard?.writeText(websearchCurl());
              setCurlCopied(true);
              setTimeout(() => setCurlCopied(false), 2000);
            }}
          />
        </Row>
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
