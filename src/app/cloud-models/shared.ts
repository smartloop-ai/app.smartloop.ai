/**
 * What the Cloud Models pages read from the API, and how they format it.
 *
 * Cloud model use is metered in sessions. Each session holds part of the
 * account's monthly allowance of credits while it is open; once it ends, what
 * it used is charged and recorded as one row in the cloud ledger
 * (GET /v1/chat/ledger). The ledger has no per-model or token detail: one
 * charge per session.
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
  /** Sessions settled this month. */
  requests: number;
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

/** One settled session: when it was charged and what it cost. */
export interface LedgerEntry {
  id: string;
  /** When the session was settled, after it ended. */
  created_at: string;
  project_id: string | null;
  /** Credits the session cost. */
  cost: number | null;
  period: string;
  // Sent with a value only to accounts allowed to see them: shown when
  // present, never assumed.
  provider?: string | null;
  /** In micro-USD. */
  upstream_cost_micros?: number | null;
  /** Anything else the API adds to a row: listed in its details as is. */
  [field: string]: unknown;
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

export const fetchLedger = async (days: number) =>
  (await getJson<LedgerEntry[]>(`/chat/ledger?days=${days}`)) ?? null;
