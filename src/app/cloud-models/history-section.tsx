'use client';

/**
 * Session History: the account's cloud sessions, newest first — when each
 * started, where it is, and the credits it cost.
 *
 * No project column: projects are local to the desktop app, and the cloud
 * only ever sees an opaque project id it cannot name. Per-project cloud usage
 * belongs in the desktop app, which can resolve those ids itself.
 *
 * GET /v1/chat/sessions pages on the server: the first page brings the
 * range's summary, which feeds the footer, so the table never loads every
 * row; "Show more" asks for the next page. Sessions that ended without
 * charging anything (a key the app replaced before using it) are hidden
 * unless asked for, and the summary says how many there are. The export is
 * the whole range as the server writes it.
 *
 * The API decides what each account may see by leaving fields out, so the
 * page shows whatever it sends: the USD column appears when rows have it, and
 * a row opens to list every field it came with.
 *
 * Changing the range or the filter keeps the current rows on screen, dimmed,
 * until the new ones arrive, so the table never collapses to a spinner and
 * back.
 */

import { Fragment, useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Row, Section } from '@/app/components/rows';
import {
  SESSION_PAGE,
  type SessionPage,
  type SessionRow,
  type SessionStatus,
  count,
  credits,
  fetchSessions,
  fetchSessionsCsv,
} from './shared';

const RANGES = [7, 30, 90] as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const STATUS_LABEL: Record<SessionStatus, string> = {
  active: 'In progress',
  ended: 'Charge pending',
  settled: 'Settled',
};

/** Labels for the fields a row's details list; any other field gets its key,
 * de-snaked. Listed in this order, then the rest as the API sent them. */
const FIELD_LABEL: Record<string, string> = {
  status: 'Status',
  started_at: 'Started',
  expires_at: 'Key expires',
  settled_at: 'Settled',
  credits: 'Credits',
  reserved: 'Credits held',
  usd: 'Upstream cost',
  limit_usd: 'Key limit',
  markup: 'Markup',
  project_id: 'Project id',
  key_hash: 'OpenRouter key',
  id: 'Session id',
};

const label = (key: string) =>
  FIELD_LABEL[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const usd = (n: number) => `$${n.toFixed(n < 0.01 ? 4 : 2)}`;

/** One field's value as the details show it. */
function display(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (key === 'usd' || key === 'limit_usd') return `$${value.toFixed(6).replace(/\.?0+$/, '')}`;
    if (key === 'credits' || key === 'reserved') return `${credits(value)} credits`;
    if (key === 'markup') return `×${value}`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  if (key === 'status' && typeof value === 'string') return STATUS_LABEL[value as SessionStatus] ?? value;
  if (key.endsWith('_at') && typeof value === 'string') return new Date(value).toLocaleString();
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** The fields present on a row, labelled ones first. */
function fieldsOf(row: SessionRow): string[] {
  const present = Object.keys(row).filter((k) => row[k] !== null && row[k] !== undefined);
  const known = Object.keys(FIELD_LABEL).filter((k) => present.includes(k));
  return [...known, ...present.filter((k) => !(k in FIELD_LABEL))];
}

const TH = 'font-medium py-2 px-4 first:pl-0 last:pr-0 whitespace-nowrap';
const TD = 'py-2.5 px-4 first:pl-0 last:pr-0';

function Details({ row }: { row: SessionRow }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-xs py-3">
      {fieldsOf(row).map((k) => (
        <Fragment key={k}>
          <dt className="text-faint whitespace-nowrap">{label(k)}</dt>
          <dd className="text-content font-mono break-all">{display(k, row[k])}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** What a session cost, or what it holds while its charge is still to come. */
function CreditsCell({ row }: { row: SessionRow }) {
  if (row.credits !== null) return <>{credits(row.credits)}</>;
  return <span className="text-faint">{row.reserved > 0 ? `${credits(row.reserved)} held` : '—'}</span>;
}

type Filter = { days: (typeof RANGES)[number]; empty: boolean };

export default function CloudHistorySection({ user }: { user: any }) {
  const [filter, setFilter] = useState<Filter>({ days: 30, empty: false });
  // The first page's summary and every page loaded since, for `loaded`.
  const [data, setData] = useState<(SessionPage & { loaded: Filter }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const loading = !error && (data === null || data.loaded.days !== filter.days || data.loaded.empty !== filter.empty);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setError(null);
    fetchSessions(filter)
      .then((page) => {
        if (cancelled) return;
        if (page) {
          setData({ ...page, loaded: filter });
          setOpen(null);
        } else {
          setError('Could not load your session history.');
        }
      })
      .catch((err) => {
        console.error('Failed to load cloud sessions:', err);
        if (!cancelled) setError('Could not load your session history.');
      });
    return () => {
      cancelled = true;
    };
  }, [user, filter]);

  const showMore = async () => {
    if (!data?.next || more) return;
    setMore(true);
    try {
      const page = await fetchSessions({ ...data.loaded, before: data.next });
      if (page) {
        setData((d) => d && { ...d, sessions: [...d.sessions, ...page.sessions], next: page.next });
      } else {
        setError('Could not load more sessions.');
      }
    } catch (err) {
      console.error('Failed to load more cloud sessions:', err);
      setError('Could not load more sessions.');
    } finally {
      setMore(false);
    }
  };

  const exportCsv = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const blob = await fetchSessionsCsv(data.loaded);
      if (!blob) {
        setError('Could not export your session history.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartloop-cloud-sessions-${data.loaded.days}d.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export cloud sessions:', err);
      setError('Could not export your session history.');
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.sessions ?? [];
  const summary = data?.summary;
  // The footer counts what the table can show: the summary includes the
  // empty sessions even when they are hidden.
  const total = summary ? summary.sessions - (data?.loaded.empty ? 0 : summary.empty) : rows.length;
  const remaining = Math.max(0, total - rows.length);
  const showUsd = rows.some((r) => r.usd !== undefined) || summary?.usd !== undefined;
  const columns = 4 + Number(showUsd);

  return (
    <Section
      title="Session History"
      description="Every cloud model session your account used, newest first, with the credits it cost. A session holds credits while it runs and is charged for what it used once it ends. Open one to see everything recorded for it."
    >
      <Row>
        <Box className="flex items-center gap-2 flex-wrap">
          <Box className="inline-flex rounded-lg border border-border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setFilter((f) => ({ ...f, days: r }))}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter.days === r ? 'bg-surface-2 text-content' : 'text-muted hover:text-content'
                }`}
              >
                {r} days
              </button>
            ))}
          </Box>
          <button
            onClick={exportCsv}
            disabled={!rows.length || loading || exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted hover:text-content hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} />
            Export CSV
          </button>
          {(filter.empty || (summary?.empty ?? 0) > 0) && (
            <label className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filter.empty}
                onChange={(e) => setFilter((f) => ({ ...f, empty: e.target.checked }))}
                className="accent-current"
              />
              {summary && summary.empty > 0
                ? `Show ${count(summary.empty)} with no charge`
                : 'Show sessions with no charge'}
            </label>
          )}
          {(loading || exporting) && data !== null && <CircularProgress size={14} sx={{ color: 'var(--muted)' }} />}
        </Box>
      </Row>

      {data === null && !error ? (
        <Row>
          <Box className="flex items-center gap-2">
            <CircularProgress size={16} sx={{ color: 'var(--muted)' }} />
            <span className="text-sm text-faint">Loading…</span>
          </Box>
        </Row>
      ) : data && rows.length === 0 ? (
        <Row
          description={
            <span className={loading ? 'opacity-60' : ''}>
              No cloud sessions in the last {data.loaded.days} days.
            </span>
          }
        />
      ) : data ? (
        <Row stacked>
          <Box className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-faint">
                  <th className={`${TH} w-5`} aria-label="Details" />
                  <th className={`${TH} text-left`}>Started</th>
                  <th className={`${TH} text-left`}>Status</th>
                  <th className={`${TH} text-right`}>Credits</th>
                  {showUsd && <th className={`${TH} text-right`}>Upstream</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOpen = open === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : r.id)}
                        className={`border-t border-border cursor-pointer hover:bg-surface-2 ${isOpen ? 'bg-surface-2' : ''}`}
                      >
                        <td className={`${TD} text-faint`}>
                          <ChevronRightIcon
                            sx={{ fontSize: 16, transition: 'transform 150ms', transform: isOpen ? 'rotate(90deg)' : 'none' }}
                          />
                        </td>
                        <td className={`${TD} text-left text-muted whitespace-nowrap`}>{when(r.started_at)}</td>
                        <td className={`${TD} text-left whitespace-nowrap ${r.status === 'settled' ? 'text-muted' : 'text-content'}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </td>
                        <td className={`${TD} text-right text-content tabular-nums whitespace-nowrap`}>
                          <CreditsCell row={r} />
                        </td>
                        {showUsd && (
                          <td className={`${TD} text-right text-muted tabular-nums whitespace-nowrap`}>
                            {r.usd == null ? '—' : usd(r.usd)}
                          </td>
                        )}
                      </tr>
                      {isOpen && (
                        <tr className="bg-surface-2">
                          <td />
                          <td colSpan={columns - 1} className="pr-4">
                            <Details row={r} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              {summary && (
                <tfoot>
                  <tr className="border-t border-border-2 font-medium">
                    <td className={TD} />
                    <td colSpan={2} className={`${TD} text-left text-content`}>
                      {count(total)} {total === 1 ? 'session' : 'sessions'}
                    </td>
                    <td className={`${TD} text-right text-content tabular-nums`}>{credits(summary.credits)}</td>
                    {showUsd && (
                      <td className={`${TD} text-right text-content tabular-nums`}>
                        {summary.usd == null ? '—' : usd(summary.usd)}
                      </td>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </Box>
          {data.next && remaining > 0 && (
            <Box className="mt-3 flex items-center gap-2">
              <button
                onClick={showMore}
                disabled={more || loading}
                className="text-xs font-medium text-accent-text hover:opacity-80 hover:underline disabled:opacity-50"
              >
                Show {count(Math.min(SESSION_PAGE, remaining))} more of {count(remaining)}
              </button>
              {more && <CircularProgress size={12} sx={{ color: 'var(--muted)' }} />}
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
