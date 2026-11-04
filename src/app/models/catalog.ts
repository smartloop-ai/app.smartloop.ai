/**
 * Resolving a served checkpoint to what has been published about it.
 *
 * The data lives in published-scores.json, including the name patterns — the
 * models page and scripts/model-coverage.mjs both read that one file, so the
 * app and the coverage check can never disagree about which model is which.
 * Add a family or a size there, not here.
 */

import data from './published-scores.json';

export interface ModelEntry {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  /** free_login: free, but only to a signed-in account — which everyone in
   * this app is, so it reads as free here. */
  access_level: 'free' | 'free_login' | 'pro' | 'internal';
  /** local runs on the device; remote runs in Smartloop's cloud through
   * /v1/chat/completions and is metered (see the Cloud Models pages). */
  type?: 'local' | 'remote';
  capabilities?: string[];
  context_length?: number | null;
  param_size_b?: number | null;
  active_param_size_b?: number | null;
  /** Remote models only: what one request may send and ask for, and what it
   * gets when it asks for nothing. */
  max_input_tokens?: number | null;
  max_output_tokens?: number | null;
  default_output_tokens?: number | null;
  /** Remote models only: reasoning cannot be turned off. */
  always_reasons?: boolean;
  /** Remote models only: the efforts a request may ask for, and the one sent
   * when it names none. */
  reasoning_efforts?: string[];
  default_reasoning_effort?: string | null;
  reasoning_budget_tokens?: number | null;
  /** Remote models only: credits per million tokens in and out. */
  input_credits_per_mtok?: number | null;
  output_credits_per_mtok?: number | null;
  is_trainable: boolean;
  is_accessible: boolean;
  is_bootstrap: boolean;
}

/** A figure as the JSON stores it — the source label lives on the family. */
interface Figure {
  score: number;
  mode: string | null;
}

export interface Published extends Figure {
  source: string;
}

const SIZE_RE = new RegExp(data.sizePattern, 'i');
const REASONING_RE = new RegExp(data.reasoningPattern, 'i');
const FAMILIES = data.families.map((f) => ({ ...f, re: new RegExp(f.pattern, 'i') }));

const ALIASES: Record<string, string> = data.aliases;
const PARAM_OVERRIDES: Record<string, number> = data.paramOverrides;

/** The benchmark every score on the chart is measured on. */
export const BENCHMARK = data.benchmark.name;

const fullName = (m: ModelEntry) => `${m.name} ${m.display_name || ''}`;

/** Customer-facing name. slp-orchestra-mini ships as SL-mini, and the internal
 * name is not something to leak into the UI. */
export const labelFor = (m: ModelEntry) => ALIASES[m.name] || m.display_name || m.name;

/** Parameter count in billions, read off the model name: gemma3-4b → 4,
 * gemma4-e4b → 4. Derived rather than served: the API has no size field, and
 * most published models carry it in the name. Returns null when there is
 * nothing to read, so a model without one simply shows no size. */
export function modelParams(m: ModelEntry): number | null {
  const listed = PARAM_OVERRIDES[m.name];
  if (listed) return listed;
  for (const source of [m.name, m.display_name || '']) {
    const match = SIZE_RE.exec(source);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

/** Which published family a checkpoint belongs to. Order matters, and every
 * pattern guards against the neighbouring generation whose name is one
 * character away: gemma-3n-e4b is not Gemma 3 4B, qwen3.5 is not Qwen3, and
 * ministral-8b (the 2024 model) is not Ministral 3 8B. No match means no
 * numbers, which is the right failure — a wrong number is worse than none. */
export const familyOf = (m: ModelEntry): string | null =>
  FAMILIES.find((f) => f.re.test(fullName(m)))?.key ?? null;

/** Reasoning checkpoints ship as their own models and score differently, so the
 * name picks the variant. */
export const wantsReasoning = (m: ModelEntry) => REASONING_RE.test(fullName(m));

/** The published figure for a checkpoint, with the run mode it was measured in.
 * Mode is not a footnote: a reasoning run scores 20–30 points above a standard
 * one on this benchmark, so it travels with the number everywhere it is shown. */
export function scoreFor(m: ModelEntry): Published | null {
  const family = FAMILIES.find((f) => f.key === familyOf(m));
  const params = modelParams(m);
  if (!family || params === null) return null;
  const sizes = family.sizes as unknown as Record<string, { standard?: Figure; reasoning?: Figure }>;
  const variants = sizes[String(params)];
  if (!variants) return null;
  const chosen =
    (wantsReasoning(m) ? variants.reasoning : variants.standard) ??
    variants.standard ??
    variants.reasoning;
  return chosen ? { score: chosen.score, mode: chosen.mode ?? null, source: family.source } : null;
}

/** Published capabilities — facts per checkpoint, not inferred from size. The
 * Gemma 3 1B is text-only, English and 32K while its siblings are none of those
 * things, and no amount of pattern-matching on its neighbours would tell you. */
export function capabilitiesFor(m: ModelEntry): string[] {
  const family = FAMILIES.find((f) => f.key === familyOf(m));
  const params = modelParams(m);
  if (!family || params === null) return [];
  const caps = (family as { capabilities?: Record<string, string[]> }).capabilities;
  return caps?.[String(params)] ?? [];
}
