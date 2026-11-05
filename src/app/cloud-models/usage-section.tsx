'use client';

/**
 * Cloud model usage: how much of this month's credits are spent, how many
 * sessions spent them, and which cloud models the account can run.
 *
 * Laid out like the credits menu in ScreenForge's agent panel: the balance
 * first with the plan beside it, then what it is out of, then a bar. An
 * unmetered (admin) account gets the same row with what it used and
 * "Unlimited". Until the API sends credit counts to every account, the row
 * falls back to percentages.
 *
 * GET /v1/chat/status carries the quota and, when cloud models can't run, why
 * not; the copy follows that reason rather than re-deriving it from numbers.
 * A session can't start without credits to hold, so "out of credits" stops
 * every cloud model until the reset.
 *
 * Cloud models are a Pro feature: there are no free credits, so a free
 * account gets the case for upgrading and the catalog, with nothing to meter.
 */

import { type ReactNode, useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';
import { Row, Section } from '@/app/components/rows';
import ActivityChart from '@/app/components/activity-chart';
import type { ModelEntry } from '@/app/models/catalog';
import {
  type CloudStatus,
  PLAN_LABEL,
  count,
  credits,
  fetchLedger,
  fetchStatus,
  resetDate,
  wholeCredits,
} from './shared';

const CAPABILITY_LABEL: Record<string, string> = {
  general: 'General',
  reasoning: 'Reasoning',
  dp: 'Documents',
  vision: 'Vision',
  coding: 'Coding',
};

const LINK_CLASS = 'text-accent-text hover:opacity-80 hover:underline font-medium transition-colors';

const contextLabel = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M context`
  : n >= 1024 ? `${Math.round(n / 1024)}K context`
  : `${n} context`;

function Pending() {
  return <CircularProgress size={12} sx={{ color: 'var(--muted)' }} />;
}

/** The plan beside the balance, as in the desktop app's credits menu. */
function PlanBadge({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className={`inline-block whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 border border-border ${
        accent ? 'text-accent-text' : 'text-muted'
      }`}
    >
      {label}
    </span>
  );
}

/** Balance first, then what it is out of, then the bar. */
function Balance({ headline, detail, badge, danger }: {
  headline: string;
  detail: string;
  badge: ReactNode;
  danger?: boolean;
}) {
  return (
    <Box className="flex flex-col gap-0.5">
      <Box className="flex items-center gap-2">
        <span className={`text-lg font-semibold tabular-nums ${danger ? 'text-danger' : 'text-content'}`}>
          {headline}
        </span>
        {badge}
      </Box>
      <span className="text-xs text-faint tabular-nums">{detail}</span>
    </Box>
  );
}

/** The credits row's shape before status arrives: no numbers, an empty bar. */
function CreditsPlaceholder() {
  return (
    <Row label="Credits" description="Checking your credits…" stacked>
      <Box className="flex flex-col gap-2">
        <Box className="flex items-center gap-2">
          <span className="text-lg font-semibold text-faint">— credits left</span>
          <Pending />
        </Box>
        <Box className="h-1.5 w-full rounded-full bg-surface-2 mt-1.5" />
      </Box>
    </Row>
  );
}

function CreditsRow({ status }: { status: CloudStatus }) {
  const { quota, reason } = status;

  if (quota.percent_used === null || quota.percent_available === null) {
    return (
      <Row label="Credits" description="This account has no monthly limit." stacked>
        <Balance
          headline={quota.used !== null ? `${credits(quota.used)} credits used` : `${count(quota.requests)} sessions`}
          detail="This month"
          badge={<PlanBadge label="Unlimited" />}
        />
      </Row>
    );
  }

  const used = quota.percent_used;
  // What open sessions hold sits between settled spend and what's left.
  const held = Math.max(0, 100 - quota.percent_available - used);
  const spent = reason === 'quota_exceeded';
  const low = reason === 'quota_low';
  // Same scale as Web Search: amber before the wall, red at it.
  const barColor = spent ? 'bg-danger' : low || used >= 80 ? 'bg-warn' : 'bg-accent-strong';
  // Counts when the API sends them; percentages until it does for everyone.
  const counted = quota.limit !== null && quota.used !== null && quota.remaining !== null;

  return (
    <Row
      label="Credits"
      description={`Resets on ${resetDate(quota.resets_at)}. Your ${PLAN_LABEL[quota.plan]} plan includes ${
        quota.limit !== null ? wholeCredits(quota.limit) : 'credits'
      } every month; unused credits don't carry over.`}
      stacked
    >
      <Box className="flex flex-col gap-2">
        <Balance
          headline={
            spent ? 'Out of credits'
            : counted ? `${wholeCredits(quota.remaining!)} left`
            : `${Math.round(quota.percent_available)}% left`
          }
          detail={
            counted
              ? `${credits(quota.used!)} of ${count(quota.limit!)} used this month`
              : `${Math.round(used)}% of your credits used this month`
          }
          badge={<PlanBadge label={PLAN_LABEL[quota.plan]} accent />}
          danger={spent}
        />
        <Box className="flex h-1.5 w-full rounded-full bg-surface-2 overflow-hidden mt-1">
          <Box
            className={`h-full transition-all ${barColor}`}
            style={{ width: `${Math.max(used, quota.requests > 0 ? 2 : 0)}%` }}
          />
          {held > 0 && (
            <Box className={`h-full transition-all opacity-40 ${barColor}`} style={{ width: `${held}%` }} />
          )}
        </Box>
        {quota.in_flight > 0 && (
          <p className="text-xs text-faint">
            {quota.in_flight === 1 ? 'A cloud session is open. ' : `${count(quota.in_flight)} cloud sessions are open. `}
            The lighter part of the bar{quota.reserved ? ` (${credits(quota.reserved)} credits)` : ''} is held for{' '}
            {quota.in_flight === 1 ? 'it' : 'them'} until {quota.in_flight === 1 ? 'it ends' : 'they end'}; only what
            was used is charged, and the rest comes back.
          </p>
        )}
        {(spent || low) && (
          <p className="text-xs text-muted mt-1">
            {spent
              ? 'Cloud models are paused until the reset.'
              : 'There are too few credits left for another cloud session, so cloud models are paused until the reset.'}{' '}
            Everything that runs on your device keeps working.
          </p>
        )}
      </Box>
    </Row>
  );
}

/** "131K" / "900K": token limits read at a glance. */
const tokensShort = (n: number) =>
  n >= 1000 ? `${Math.round(n / 1000).toLocaleString()}K` : n.toLocaleString();

/** "Up to 900K tokens in · 16K out, 8K by default". */
function limitsLabel(m: ModelEntry): string | null {
  const parts: string[] = [];
  if (m.max_input_tokens) parts.push(`Up to ${tokensShort(m.max_input_tokens)} tokens in`);
  if (m.max_output_tokens) {
    const byDefault = m.default_output_tokens ? `, ${tokensShort(m.default_output_tokens)} by default` : '';
    parts.push(`${tokensShort(m.max_output_tokens)} out${byDefault}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

/** "Reasoning: always on · low by default · minimal, low, medium, high ·
 * 2K budget". An effort of none is reasoning turned off. */
function reasoningLabel(m: ModelEntry): string | null {
  const efforts = m.reasoning_efforts ?? [];
  const effort = (e: string) => (e === 'none' ? 'off' : e);
  const parts: string[] = [];
  if (m.always_reasons) parts.push('always on');
  if (m.default_reasoning_effort) parts.push(`${effort(m.default_reasoning_effort)} by default`);
  if (efforts.length) parts.push(efforts.map(effort).join(', '));
  if (m.reasoning_budget_tokens) parts.push(`${tokensShort(m.reasoning_budget_tokens)} budget`);
  return parts.length ? `Reasoning: ${parts.join(' · ')}` : null;
}

const paramsLabel = (m: ModelEntry) =>
  m.param_size_b
    ? `${m.param_size_b}B${m.active_param_size_b ? ` (${m.active_param_size_b}B active)` : ''}`
    : null;

function ModelList({ models, locked }: { models: ModelEntry[]; locked: boolean }) {
  if (models.length === 0) {
    return <p className="text-xs text-faint">No cloud models are available yet.</p>;
  }
  return (
    <Box className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {models.map((m) => (
        <Box key={m.id} className="flex items-start gap-3 px-3 py-2.5">
          <Box className="min-w-0 flex-1">
            <div className="text-sm text-content">{m.display_name || m.name}</div>
            <div className="text-xs text-faint mt-0.5">
              <code className="font-mono">{m.name}</code>
              {paramsLabel(m) ? ` · ${paramsLabel(m)}` : ''}
              {m.context_length ? ` · ${contextLabel(m.context_length)}` : ''}
              {m.access_level === 'internal' ? ' · Internal' : ''}
            </div>
            {[limitsLabel(m), reasoningLabel(m)].filter(Boolean).map((line) => (
              <div key={line} className="text-xs text-muted mt-0.5 tabular-nums">{line}</div>
            ))}
            {(m.capabilities?.length ?? 0) > 0 && (
              <Box className="flex flex-wrap gap-1.5 mt-1.5">
                {m.capabilities!.map((c) => (
                  <span
                    key={c}
                    className="inline-block whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 text-muted border border-border"
                  >
                    {CAPABILITY_LABEL[c] ?? c}
                  </span>
                ))}
              </Box>
            )}
          </Box>
          {m.is_accessible && !locked ? (
            <span title="Available" className="pt-0.5">
              <LockOpenIcon sx={{ fontSize: 17, color: 'var(--ok-text)' }} />
            </span>
          ) : (
            <span title="Requires Pro" aria-label="Requires Pro" className="pt-0.5 text-faint">
              <LockOutlinedIcon sx={{ fontSize: 17 }} />
            </span>
          )}
        </Box>
      ))}
    </Box>
  );
}

/** undefined while loading, null if the request failed. */
type Loaded<T> = T | null | undefined;

const fetchModels = async (): Promise<ModelEntry[] | null> => {
  const r: Response | undefined = await userService.makeAuthenticatedRequest(
    `${API_ENDPOINT}/models`,
    { method: 'GET' }
  );
  if (!r || !r.ok) return null;
  const catalog = await r.json();
  // Internal models only reach admins (the API filters them out for everyone
  // else), so they are listed here and marked as internal.
  return Array.isArray(catalog) ? catalog.filter((m: ModelEntry) => m.type === 'remote') : [];
};

/** Run one request into its own state, so each row fills in when its own data
 * arrives rather than waiting for the slowest. */
function useLoad<T>(user: any, load: () => Promise<T | null>): Loaded<T> {
  const [value, setValue] = useState<Loaded<T>>(undefined);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    load()
      .then((v) => { if (!cancelled) setValue(v); })
      .catch((err) => {
        console.error('Failed to load cloud model usage:', err);
        if (!cancelled) setValue(null);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  return value;
}

export default function CloudUsageSection({ user }: { user: any }) {
  const status = useLoad(user, fetchStatus);
  const ledger = useLoad(user, () => fetchLedger(14));
  const models = useLoad(user, fetchModels);

  const failed = status === null || ledger === null || models === null;

  // Free accounts get no credits: cloud models are a Pro feature. Until status
  // arrives the plan comes from the user, so the page does not change shape
  // when it lands.
  const needsPro = status
    ? status.reason === 'plan_required'
    : !!user && !user.admin && !(user.is_paid || user.is_premium);

  return (
    <Section
      title="Cloud Models"
      description="Larger models that run in Smartloop's cloud instead of on your device — no setup and no API key of your own. Pro includes credits every month, spent on what you use; unused credits don't carry over."
    >
      {needsPro && (
        <Row
          label="Included with Pro"
          description="Cloud models are part of Pro, with credits every month. Upgrade to use them in the desktop app and the CLI."
        >
          <a
            href="/settings/billing"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-accent-border hover:bg-accent-soft text-accent-text whitespace-nowrap"
          >
            Upgrade to Pro
          </a>
        </Row>
      )}

      {!needsPro && (status ? <CreditsRow status={status} /> : status === undefined && <CreditsPlaceholder />)}

      {!needsPro && (
        <Row
          label="Sessions per day"
          description={
            <>
              Last 14 days. Every session and what it cost is itemized in{' '}
              <a href="/cloud-models/history" className={LINK_CLASS}>
                Session History
              </a>
              .
            </>
          }
          stacked
        >
          <ActivityChart
            entries={(ledger ?? []).map((e) => ({ timestamp: e.created_at, action: 'session' }))}
            labelFor={() => 'Sessions'}
            emptyText="No cloud sessions in the last 14 days."
            loading={ledger === undefined}
          />
        </Row>
      )}

      <Row label={needsPro ? 'Models in Pro' : 'Available models'} stacked>
        {models === undefined ? (
          <Box className="flex items-center gap-2">
            <Pending />
            <span className="text-sm text-faint">Loading…</span>
          </Box>
        ) : (
          <ModelList models={models ?? []} locked={needsPro} />
        )}
      </Row>

      {failed && (
        <Row stacked>
          <Box className="p-3 rounded-lg border border-danger-border bg-danger-soft">
            <p className="text-sm text-danger">Could not load your cloud model usage.</p>
          </Box>
        </Row>
      )}
    </Section>
  );
}
