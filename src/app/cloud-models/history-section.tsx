'use client';

/**
 * Session History: the account's view of the cloud ledger, one row per cloud
 * session — when it was settled and the credits it cost.
 *
 * No project column: projects are local to the desktop app, and the cloud
 * only ever sees an opaque project id it cannot name. Per-project cloud usage
 * belongs in the desktop app, which can resolve those ids itself.
 *
 * The ledger is a billing record, so this page is itemized rather than
 * summarized and can be exported. The API decides what each account may see
 * by leaving fields out, so the page shows whatever it sends: the Credits and
 * USD columns appear when any row has them, a row
 * opens to list every field it came with, and the export has a column for
 * every field.
 *
 * GET /v1/chat/ledger returns the whole range in one response, so rows are
 * paged here, in the browser.
 *
 * Changing the range keeps the current rows on screen, dimmed, until the new
 * range arrives, so the table never collapses to a spinner and back.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Row, Section } from '@/app/components/rows';
import { type LedgerEntry, count, credits, fetchLedger } from './shared';

const RANGES = [7, 30, 90] as const;
const PAGE = 50;

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** Labels for the fields a row's details list; any other field gets its key,
 * de-snaked. Listed in this order, then the rest as the API sent them. */
const FIELD_LABEL: Record<string, string> = {
  created_at: 'Settled',
  cost: 'Credits',
  upstream_cost_micros: 'Upstream cost',
  provider: 'Provider',
  plan: 'Plan',
  period: 'Period',
  project_id: 'Project id',
  id: 'Session id',
};

const label = (key: string) =>
  FIELD_LABEL[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** One field's value as the details show it. Amounts kept in micro-USD or
 * millicredits on the ledger read in dollars and credits. */
function display(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (key.endsWith('_micros')) return `$${(value / 1_000_000).toFixed(6).replace(/\.?0+$/, '')}`;
    if (key.endsWith('_millicredits')) return `${credits(value / 1000)} credits`;
    if (key === 'cost') return `${credits(value)} credits`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  if (key === 'created_at' && typeof value === 'string') return new Date(value).toLocaleString();
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** The fields present on a row, labelled ones first. */
function fieldsOf(e: LedgerEntry): string[] {
  const present = Object.keys(e).filter((k) => e[k] !== null && e[k] !== undefined);
  const known = Object.keys(FIELD_LABEL).filter((k) => present.includes(k));
  return [...known, ...present.filter((k) => !(k in FIELD_LABEL))];
}

/** Every field any row has, as columns: the export is for reconciling, so it
 * keeps full precision and leaves nothing out. */
function toCsv(entries: LedgerEntry[]): string {
  const columns: string[] = [];
  for (const e of entries) for (const k of fieldsOf(e)) if (!columns.includes(k)) columns.push(k);
  const quote = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cell = (v: unknown) =>
    v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const rows = entries.map((e) => columns.map((k) => quote(cell(e[k]))).join(','));
  return [columns.join(','), ...rows].join('\n');
}

const has = (entries: LedgerEntry[], key: string) =>
  entries.some((e) => e[key] !== null && e[key] !== undefined);

const TH = 'font-medium py-2 px-4 first:pl-0 last:pr-0 whitespace-nowrap';
const TD = 'py-2.5 px-4 first:pl-0 last:pr-0';

const usd = (micros: number) => `$${(micros / 1_000_000).toFixed(micros < 10_000 ? 4 : 2)}`;

function Details({ entry }: { entry: LedgerEntry }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-xs py-3">
      {fieldsOf(entry).map((k) => (
        <Fragment key={k}>
          <dt className="text-faint whitespace-nowrap">{label(k)}</dt>
          <dd className="text-content font-mono break-all">{display(k, entry[k])}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export default function CloudHistorySection({ user }: { user: any }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  // The days the rows on screen are for. Differs from `days` while a new
  // range is loading.
  const [loadedDays, setLoadedDays] = useState(days);
  const loading = !error && (entries === null || loadedDays !== days);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setError(null);
    fetchLedger(days)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setEntries(data);
          setLoadedDays(days);
          setShown(PAGE);
        } else {
          setError('Could not load your session history.');
        }
      })
      .catch((err) => {
        console.error('Failed to load cloud ledger:', err);
        if (!cancelled) setError('Could not load your session history.');
      });
    return () => {
      cancelled = true;
    };
  }, [user, days]);

  const totals = useMemo(
    () =>
      (entries ?? []).reduce(
        (t, e) => ({
          cost: t.cost + (e.cost ?? 0),
          usd: t.usd + (e.upstream_cost_micros ?? 0),
        }),
        { cost: 0, usd: 0 }
      ),
    [entries]
  );

  const rows = entries ?? [];
  const showCost = has(rows, 'cost');
  const showUsd = has(rows, 'upstream_cost_micros');
  const columns = 2 + Number(showCost) + Number(showUsd);

  const exportCsv = () => {
    if (!entries?.length) return;
    const blob = new Blob([toCsv(entries)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartloop-cloud-sessions-${loadedDays}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section
      title="Session History"
      description="Every cloud model session your account used, newest first, with the credits it cost. A session is charged for what it used once it ends. Open one to see everything recorded for it."
    >
      <Row>
        <Box className="flex items-center gap-2 flex-wrap">
          <Box className="inline-flex rounded-lg border border-border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  days === r ? 'bg-surface-2 text-content' : 'text-muted hover:text-content'
                }`}
              >
                {r} days
              </button>
            ))}
          </Box>
          <button
            onClick={exportCsv}
            disabled={!entries?.length || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted hover:text-content hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} />
            Export CSV
          </button>
          {loading && entries !== null && (
            <CircularProgress size={14} sx={{ color: 'var(--muted)' }} />
          )}
        </Box>
      </Row>

      {entries === null && !error ? (
        <Row>
          <Box className="flex items-center gap-2">
            <CircularProgress size={16} sx={{ color: 'var(--muted)' }} />
            <span className="text-sm text-faint">Loading…</span>
          </Box>
        </Row>
      ) : entries && entries.length === 0 ? (
        <Row
          description={
            <span className={loading ? 'opacity-60' : ''}>
              No cloud sessions in the last {loadedDays} days.
            </span>
          }
        />
      ) : entries ? (
        <Row stacked>
          <Box className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-faint">
                  <th className={`${TH} w-5`} aria-label="Details" />
                  <th className={`${TH} text-left`}>Settled</th>
                  {showCost && <th className={`${TH} text-right`}>Credits</th>}
                  {showUsd && <th className={`${TH} text-right`}>Upstream</th>}
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, shown).map((e) => {
                  const isOpen = open === e.id;
                  return (
                    <Fragment key={e.id}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : e.id)}
                        className={`border-t border-border cursor-pointer hover:bg-surface-2 ${isOpen ? 'bg-surface-2' : ''}`}
                      >
                        <td className={`${TD} text-faint`}>
                          <ChevronRightIcon
                            sx={{ fontSize: 16, transition: 'transform 150ms', transform: isOpen ? 'rotate(90deg)' : 'none' }}
                          />
                        </td>
                        <td className={`${TD} text-left text-muted whitespace-nowrap`}>{when(e.created_at)}</td>
                        {showCost && (
                          <td className={`${TD} text-right text-content tabular-nums whitespace-nowrap`}>
                            {e.cost == null ? '—' : credits(e.cost)}
                          </td>
                        )}
                        {showUsd && (
                          <td className={`${TD} text-right text-muted tabular-nums whitespace-nowrap`}>
                            {e.upstream_cost_micros == null ? '—' : usd(e.upstream_cost_micros)}
                          </td>
                        )}
                      </tr>
                      {isOpen && (
                        <tr className="bg-surface-2">
                          <td />
                          <td colSpan={columns - 1} className="pr-4">
                            <Details entry={e} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-2 font-medium">
                  <td className={TD} />
                  <td className={`${TD} text-left text-content`}>
                    {count(entries.length)} {entries.length === 1 ? 'session' : 'sessions'}
                  </td>
                  {showCost && <td className={`${TD} text-right text-content tabular-nums`}>{credits(totals.cost)}</td>}
                  {showUsd && <td className={`${TD} text-right text-content tabular-nums`}>{usd(totals.usd)}</td>}
                </tr>
              </tfoot>
            </table>
          </Box>
          {shown < entries.length && (
            <Box className="mt-3">
              <button
                onClick={() => setShown((n) => n + PAGE)}
                className="text-xs font-medium text-accent-text hover:opacity-80 hover:underline"
              >
                Show {Math.min(PAGE, entries.length - shown)} more of {count(entries.length - shown)}
              </button>
            </Box>
          )}
        </Row>
      ) : null}

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
