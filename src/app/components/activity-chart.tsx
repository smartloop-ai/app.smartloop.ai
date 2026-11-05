'use client';

/**
 * Access-log activity over time — grouped bars, one series per action
 * category.
 *
 * Bars rather than lines: these are per-day counts, and the series is sparse
 * (most days are zero for most categories). A line through mostly-zero points
 * implies a continuous quantity that dips and recovers; bars read as discrete
 * counts and make an empty day obviously empty.
 *
 * Categorical colour, so hues are assigned in a fixed order and never cycled:
 * a category keeps its colour no matter how many others are present or how
 * they rank. Both palettes are the dataviz reference theme, stepped per mode
 * and validated against this app's surfaces (#ffffff / #0a0a0a) — all six
 * checks pass. Three light-mode hues sit under 3:1 against white, which
 * obligates visible labels rather than colour alone; the legend supplies them.
 */

import { useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@/app/components/theme-provider';

export interface ActivityEntry {
  timestamp: string;
  action: string;
}

// Fixed slot order — index is the category's identity, not its rank.
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];

// Categories we know about, in the order they take colour slots. Anything new
// is appended alphabetically so its colour is stable across renders and does
// not shift when another category appears or disappears.
const KNOWN_ACTIONS = ['websearch'];

const DAYS = 14;
const W = 720;
const H = 160;
const PAD_L = 28;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 22;
// Surface gap between adjacent bars in a group.
const BAR_GAP = 2;

const defaultLabel = (action: string) =>
  action === 'websearch' ? 'Web search' : action.replace(/[-_]/g, ' ');

export default function ActivityChart({
  entries,
  // Callers whose "action" isn't an access-log category name it themselves
  // (the Cloud Models page charts sessions).
  labelFor = defaultLabel,
  emptyText = `No recorded activity in the last ${DAYS} days.`,
  // Draw the empty frame instead of the empty sentence, so the chart holds its
  // place while its entries are still on the way.
  loading = false,
}: {
  entries: ActivityEntry[];
  labelFor?: (action: string) => string;
  emptyText?: string;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  const palette = theme === 'dark' ? SERIES_DARK : SERIES_LIGHT;
  const [hover, setHover] = useState<number | null>(null);

  const dayKeys: string[] = [];
  const dayLabels: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toDateString());
    dayLabels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }

  const actions = Array.from(new Set(entries.map((e) => e.action)));
  const ordered = [
    ...KNOWN_ACTIONS.filter((a) => actions.includes(a)),
    ...actions.filter((a) => !KNOWN_ACTIONS.includes(a)).sort(),
  ];

  const series = ordered.map((action, i) => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.action !== action) continue;
      const key = new Date(e.timestamp).toDateString();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return {
      action,
      label: labelFor(action),
      // Slot by fixed position; a 7th category would fold into "Other" rather
      // than generating a hue.
      color: palette[i % palette.length],
      values: dayKeys.map((k) => counts.get(k) || 0),
      total: entries.filter((e) => e.action === action).length,
    };
  });

  const peak = Math.max(1, ...series.flatMap((s) => s.values));
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  // DAYS is fixed at >1, so the divisor is always safe.
  // One band per day, bars centred in their band — so nothing overhangs the
  // plot the way a point scale would at the first and last day.
  const band = plotW / DAYS;
  const x = (i: number) => PAD_L + band * (i + 0.5);

  // Thin marks: the group occupies part of its band, never all of it.
  const groupW = band * 0.62;
  const barW = Math.max(2, (groupW - BAR_GAP * (series.length - 1)) / series.length);
  const y = (v: number) => PAD_T + plotH - (v / peak) * plotH;

  if (!series.length && !loading) {
    return <p className="text-xs text-faint">{emptyText}</p>;
  }

  return (
    <Box>
      <Box sx={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHover(null)}
        >
          {/* Recessive frame: a baseline and a peak rule, no full grid. */}
          <line x1={PAD_L} y1={y(0)} x2={W - PAD_R} y2={y(0)} stroke="var(--chart-grid)" strokeWidth="1" />
          <line x1={PAD_L} y1={y(peak)} x2={W - PAD_R} y2={y(peak)} stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray="2 4" />
          <text x={PAD_L - 6} y={y(peak) + 4} textAnchor="end" fontSize="10" fill="var(--faint)">{peak}</text>
          <text x={PAD_L - 6} y={y(0) + 4} textAnchor="end" fontSize="10" fill="var(--faint)">0</text>

          {/* Grouped bars: one per series per day, 4px rounded ends anchored
              to the baseline, with a 2px gap so adjacent fills stay distinct. */}
          {series.map((s, si) =>
            s.values.map((v, i) => {
              if (v <= 0) return null;
              const h = Math.max((v / peak) * plotH, 2);
              return (
                <rect
                  key={`${s.action}-${i}`}
                  x={x(i) - groupW / 2 + si * (barW + BAR_GAP)}
                  y={y(0) - h}
                  width={barW}
                  height={h}
                  rx={Math.min(4, barW / 2)}
                  fill={s.color}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              );
            })
          )}

          {/* Hover columns — hit targets wider than the marks. */}
          {series.length > 0 && dayKeys.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={PAD_L + band * i}
              y={PAD_T}
              width={band}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}

          {dayLabels.map((label, i) =>
            i % 3 === 0 || i === DAYS - 1 ? (
              <text key={label} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--faint)">
                {label}
              </text>
            ) : null
          )}
        </svg>

        {hover !== null && (
          <Box
            className="pointer-events-none absolute top-0 px-2.5 py-1.5 rounded-lg text-xs"
            sx={{
              left: `${(x(hover) / W) * 100}%`,
              transform: 'translateX(-50%)',
              bgcolor: 'var(--surface)',
              border: '1px solid var(--border-2)',
              whiteSpace: 'nowrap',
              zIndex: 1,
            }}
          >
            <div className="text-content font-medium mb-0.5">{dayLabels[hover]}</div>
            {series.map((s) => (
              <div key={s.action} className="flex items-center gap-1.5 text-muted">
                <span
                  style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color, display: 'inline-block' }}
                />
                {s.label}: {s.values[hover]}
              </div>
            ))}
          </Box>
        )}
      </Box>

      {/* Legend is always present, and carries the visible labels the light
          palette's sub-3:1 hues require. */}
      <Box className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {series.map((s) => (
          <span key={s.action} className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span
              style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color, display: 'inline-block' }}
            />
            {s.label}
            <span className="text-faint">({s.total})</span>
          </span>
        ))}
      </Box>
    </Box>
  );
}
