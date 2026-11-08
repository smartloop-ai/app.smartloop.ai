/**
 * What the Cloud Models pages read from the API, and how they format it.
 *
 * Cloud model use is metered in sessions. Each session holds part of the
 * account's monthly allowance of credits while it is open; once it ends, what
 * it used is charged to it (GET /v1/chat/sessions). There is no per-model or
 * token detail: one charge per session.
 *
 * Users see credits: what is left of the month and what each session cost.
 * Some accounts don't get the month's credit counts, so for them they are null
 * and the usage row falls back to percentages. Other fields are withheld the
 * same way: the API sends them as null, and the pages show a field only when
 * it has a value.
 */

import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';

export interface CloudQuota {
  /** Credits this month. null when unmetered (admin accounts) or withheld. */
  limit: number | null;
  /** Credits charged for settled sessions. null when withheld. */
  used: number | null;
  /** Credits left. null when unmetered or withheld. */
  remaining: number | null;
  /** Credits held by open sessions. null when withheld. */
  reserved: number | null;
  /** 0–100 of the month's credits charged for settled sessions. null means
   * unmetered (admin accounts). */
  percent_used: number | null;
  /** 0–100 a new session can still hold, after settled spend and what open
   * sessions are holding. null when unmetered. */
  percent_available: number | null;
  /** Open sessions, each holding its budget until it is settled. */
  in_flight: number;
  /** YYYY-MM. */
  period: string;
  resets_at: string;
  plan: 'free' | 'paid' | 'admin';
}

/** Why cloud models can't run right now, from GET /v1/chat/status. */
export type CloudStatusReason = 'plan_required' | 'unconfigured' | 'quota_exceeded' | 'quota_low';

export interface CloudStatus {
  enabled: boolean;
  reason: CloudStatusReason | null;
  quota: CloudQuota;
}

export const PLAN_LABEL: Record<CloudQuota['plan'], string> = {
  free: 'Free',
  paid: 'Pro',
  admin: 'Admin',
};

export const count = (n: number) => n.toLocaleString();

/** A credit amount that may be a fraction: a short session costs well under
 * one credit, so a fixed number of decimals would show most rows as 0. */
export function credits(n: number): string {
  if (n === 0) return '0';
  if (n < 0.01) return '<0.01';
  if (n < 10) return n.toFixed(2);
  return Math.round(n).toLocaleString();
}

/** A balance, in whole credits: "188 credits". Floored, so it never shows
 * more than can be spent. */
export function wholeCredits(n: number): string {
  const whole = Math.max(0, Math.floor(n));
  return whole === 1 ? '1 credit' : `${whole.toLocaleString()} credits`;
}

export const resetDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

async function getJson<T>(path: string): Promise<T | null> {
  const response = await userService.makeAuthenticatedRequest(`${API_ENDPOINT}${path}`, {
    method: 'GET',
  });
  return response && response.ok ? ((await response.json()) as T) : null;
}

export const fetchStatus = () => getJson<CloudStatus>('/chat/status');

/** The browser's time zone, so days are the user's days. */
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** One day of cloud use, in the browser's time zone. */
export interface UsageDay {
  /** YYYY-MM-DD. */
  date: string;
  /** Sessions started that day, settled or not. */
  sessions: number;
  /** Credits charged for them; a session adds its credits once settled. */
  credits: number;
  /** What OpenRouter charged, in USD. Sent only to accounts allowed to see it. */
  usd?: number;
}

/** GET /v1/chat/usage: every day of the range, oldest first, zeros included. */
export interface CloudUsage {
  tz: string;
  totals: Omit<UsageDay, 'date'>;
  days: UsageDay[];
}

export const fetchUsage = (days: number) =>
  getJson<CloudUsage>(`/chat/usage?${new URLSearchParams({ days: String(days), tz: browserTimeZone() })}`);

/** Where a session is: its key still works, its key expired and the charge is
 * pending, or it has been charged. */
export type SessionStatus = 'active' | 'ended' | 'settled';

/** One cloud session, from GET /v1/chat/sessions. */
export interface SessionRow {
  id: string;
  started_at: string;
  /** When its key stops working. */
  expires_at: string;
  settled_at: string | null;
  status: SessionStatus;
  /** Credits charged; null until settled. */
  credits: number | null;
  /** Credits held while it is open. */
  reserved: number;
  project_id: string | null;
  // Sent only to accounts allowed to see them: shown when present.
  /** What OpenRouter charged, in USD. */
  usd?: number | null;
  limit_usd?: number;
  markup?: number;
  key_hash?: string;
  [field: string]: unknown;
}

/** The whole range, counting what the empty filter hides. */
export interface SessionSummary {
  sessions: number;
  /** Settled sessions that charged nothing. */
  empty: number;
  credits: number;
  usd?: number;
}

export interface SessionPage {
  tz: string;
  /** On the first page only. */
  summary?: SessionSummary;
  sessions: SessionRow[];
  /** Pass as `before` for the next page; null on the last. */
  next: string | null;
}

/** Sessions per page of history. */
export const SESSION_PAGE = 50;

export interface SessionQuery {
  days: number;
  /** Include settled sessions that charged nothing. */
  empty: boolean;
  before?: string | null;
}

function sessionsPath({ days, empty, before }: SessionQuery, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    days: String(days),
    tz: browserTimeZone(),
    empty: String(empty),
    limit: String(SESSION_PAGE),
    ...extra,
  });
  if (before) params.set('before', before);
  return `/chat/sessions?${params}`;
}

export const fetchSessions = (query: SessionQuery) => getJson<SessionPage>(sessionsPath(query));

/** Every session in the range as a CSV file, as the server writes it. */
export async function fetchSessionsCsv(query: SessionQuery): Promise<Blob | null> {
  const response = await userService.makeAuthenticatedRequest(
    `${API_ENDPOINT}${sessionsPath({ ...query, before: null }, { format: 'csv' })}`,
    { method: 'GET' },
  );
  return response && response.ok ? await response.blob() : null;
}
