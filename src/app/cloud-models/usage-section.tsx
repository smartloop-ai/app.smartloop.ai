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
import Link from 'next/link';
import { Box, CircularProgress } from '@mui/material';
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';
import { Row, Section } from '@/app/components/rows';
import ActivityChart from '@/app/components/activity-chart';
import type { ModelEntry } from '@/app/models/catalog';
import {
  type CloudStatus,
  type CloudUsage,
  PLAN_LABEL,
  count,
  credits,
  fetchStatus,
  fetchUsage,
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

function CreditsRow({ status }: { status: CloudStatus }) {
  const { quota, reason } = status;

  if (quota.percent_used === null || quota.percent_available === null) {
    return (
      <Row label="Credits" description="This account has no monthly limit." stacked>
        <Balance
          headline={quota.used !== null ? `${credits(quota.used)} credits used` : 'No limit'}
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
  const reserved = reason === 'quota_reserved';
  // Same scale as Web Search: amber before the wall, red at it.
  const barColor = spent ? 'bg-danger' : low || reserved || used >= 80 ? 'bg-warn' : 'bg-accent-strong';
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
            style={{ width: `${Math.max(used, used > 0 ? 2 : 0)}%` }}
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
        {(spent || low || reserved) && (
          <p className="text-xs text-muted mt-1">
            {spent
              ? 'Cloud models are paused until the reset.'
              : reserved
                ? "Your open cloud sessions are holding the rest of your credits, so a new one can't start until they end."
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

function ModelList({ models }: { models: ModelEntry[] }) {
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

const RANGES = [7, 30, 90] as const;

type Metric = 'credits' | 'sessions' | 'usd';

const METRIC_LABEL: Record<Metric, string> = {
  credits: 'Credits',
  sessions: 'Sessions',
  usd: 'Upstream USD',
};

const METRIC_FORMAT: Record<Metric, (v: number) => string> = {
  credits,
  sessions: count,
  usd: (v) => `$${v.toFixed(v > 0 && v < 0.01 ? 4 : 2)}`,
};

/** A pill group, as the history page's range picker. */
function Toggle<T extends string | number>({ options, value, label, onChange }: {
  options: readonly T[];
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <Box className="inline-flex rounded-lg border border-border p-0.5">
      {options.map((o) => (
        <button
          key={String(o)}
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === o ? 'bg-surface-2 text-content' : 'text-muted hover:text-content'
          }`}
        >
          {label(o)}
        </button>
      ))}
    </Box>
  );
}

/**
 * Cloud use per day. GET /v1/chat/usage sends the last 90 days already
 * counted per day in the browser's time zone, so switching the range or the
 * measure only re-slices what is on hand: no request.
 */
function UsageChart({ usage }: { usage: CloudUsage | null | undefined }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [metric, setMetric] = useState<Metric>('credits');
  const metrics: Metric[] = usage?.totals.usd !== undefined ? ['credits', 'sessions', 'usd'] : ['credits', 'sessions'];
  const shown = (usage?.days ?? []).slice(-days);
  const format = METRIC_FORMAT[metric];
  // A failed load shows in the section's error row.
  if (usage === null) return null;

  return (
    <Box className="flex flex-col gap-3">
      <Box className="flex items-center gap-2 flex-wrap">
        <Toggle options={RANGES} value={days} label={(d) => `${d} days`} onChange={setDays} />
        <Toggle options={metrics} value={metric} label={(m) => METRIC_LABEL[m]} onChange={setMetric} />
      </Box>
      <ActivityChart
        binned={{
          dates: shown.map((d) => d.date),
          series: [{ key: metric, label: METRIC_LABEL[metric], values: shown.map((d) => d[metric] ?? 0) }],
        }}
        format={format}
        emptyText={`No cloud sessions in the last ${days} days.`}
        loading={usage === undefined}
      />
    </Box>
  );
}

/** Run one request into its own state; the section shows its rows once every
 * request has answered. */
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
  const usage = useLoad(user, () => fetchUsage(90));
  const models = useLoad(user, fetchModels);

  const failed = status === null || usage === null || models === null;
  // The rows render together once all three have answered, so the page
  // appears in one step instead of filling in row by row as each lands.
  const ready = status !== undefined && usage !== undefined && models !== undefined;

  // Free accounts get no credits: cloud models are a Pro feature. If status
  // could not be loaded, the plan comes from the user.
  const needsPro = status
    ? status.reason === 'plan_required'
    : !!user && !user.admin && !(user.is_paid || user.is_premium);

  return (
    <Section
      title="Cloud Models"
      description="Larger models that run in Smartloop's cloud instead of on your device — no setup and no API key of your own. Pro includes credits every month, spent on what you use; unused credits don't carry over."
    >
      {ready && needsPro && (
        <Row
          label="Included with Pro"
          description="Cloud models are part of Pro, with credits every month. Upgrade to use them in the desktop app and the CLI."
        >
          <Link
            href="/settings/billing/"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-accent-border hover:bg-accent-soft text-accent-text whitespace-nowrap"
          >
            Upgrade to Pro
          </Link>
        </Row>
      )}

      {!ready && (
        <Row>
          <Box className="flex items-center gap-2">
            <Pending />
            <span className="text-sm text-faint">Loading…</span>
          </Box>
        </Row>
      )}

      {ready && !needsPro && status && <CreditsRow status={status} />}

      {ready && !needsPro && (
        <Row
          label="Usage per day"
          description={
            <>
              Sessions count on the day they start; their credits once they end and are charged. Every session
              is itemized in{' '}
              {/* In-app navigation, as the sidebar does: a plain link reloads the
                  whole app and re-checks the session. */}
              <Link href="/cloud-models/history/" className={LINK_CLASS}>
                Session History
              </Link>
              .
            </>
          }
          stacked
        >
          <UsageChart usage={usage} />
        </Row>
      )}

      {ready && (
        <Row label={needsPro ? 'Models in Pro' : 'Available models'} stacked>
          <ModelList models={models ?? []} />
        </Row>
      )}

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
