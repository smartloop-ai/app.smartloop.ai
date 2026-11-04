/**
 * What the Cloud Models pages read from the API, and how they format it.
 *
 * Cloud (remote) models run on Smartloop's provider accounts behind
 * POST /v1/chat/completions, so every call is metered against a monthly,
 * per-plan allowance of credits and recorded in the cloud ledger
 * (GET /v1/chat/ledger). Each model has a rate card in credits per million
 * tokens; what that costs us upstream stays server-side.
 *
 * Users see credits: what is left of the month, what each call cost, and each
 * model's rate. The API sends the month's credit counts to superusers only for
 * now, so for everyone else they are null and the usage row falls back to
 * percentages. Which upstream served a call and what it cost in USD are
 * superuser-only too: the API sends them as null to everyone else, and the
 * pages show a field only when it has a value.
 */

import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';

export interface CloudQuota {
  /** Credits this month. null when unmetered (admin accounts) or withheld. */
  limit: number | null;
  /** Credits spent on settled calls. null when withheld. */
  used: number | null;
  /** Credits left. null when unmetered or withheld. */
  remaining: number | null;
  /** Credits held by calls in flight. null when withheld. */
  reserved: number | null;
  /** 0–100 of the month's credits spent on settled calls. null means
   * unmetered (admin accounts). */
  percent_used: number | null;
  /** 0–100 a new call can still use, after settled spend and what calls in
   * flight are holding. null when unmetered. */
  percent_available: number | null;
  /** Calls still running, each holding its worst case until it settles. */
  in_flight: number;
  prompt_tokens: number;
  completion_tokens: number;
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

export interface LedgerEntry {
  id: string;
  created_at: string;
  /** Catalog name, e.g. gpt-oss-20b. */
  model: string;
  project_id: string | null;
  streamed: boolean;
  prompt_tokens: number;
  completion_tokens: number;
  /** The provider never reported usage for this call, so its tokens are our
   * estimate from the text in and out. */
  estimated: boolean;
  /** Credits the call cost. */
  cost: number | null;
  period: string;
  // Sent with a value only to accounts allowed to see them (the upstream and
  // USD fields: superusers): shown when present, never assumed.
  /** Who served the call through OpenRouter, e.g. "CoreWeave". */
  upstream_provider?: string | null;
  /** Our upstream (e.g. openrouter) and the model's id there. */
  provider?: string | null;
  provider_model?: string | null;
  /** How many of completion_tokens went to reasoning, when reported. */
  reasoning_tokens?: number | null;
  /** The reasoning effort sent upstream. */
  reasoning_effort?: string | null;
  /** Anything else the API adds to a row: listed in its details as is. */
  [field: string]: unknown;
}

export const PLAN_LABEL: Record<CloudQuota['plan'], string> = {
  free: 'Free',
  paid: 'Pro',
  admin: 'Admin',
};

export const count = (n: number) => n.toLocaleString();

/** A credit amount that may be a fraction: a small call costs well under one
 * credit, so a fixed number of decimals would show most rows as 0. */
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
