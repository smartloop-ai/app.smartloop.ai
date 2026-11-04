'use client';

/**
 * Published capability against model size.
 *
 * Every figure here is a single model measured on its own — no routing, no
 * ensemble, no tool use. That framing matters on this page, because the
 * platform's own orchestration model is not one of these marks and is not
 * measured this way.
 *
 * Both axes are measurements. X is parameter count; Y is GPQA Diamond, chosen
 * because it is the one benchmark published for every family on the platform —
 * an axis is only worth drawing if every mark on it was measured the same way.
 * A model with no published figure is named under the chart rather than placed
 * by guesswork, and the mode each figure was measured in travels with it into
 * the table, because Gemma 4's published run uses thinking mode and Gemma 3's
 * does not. That difference flatters the newer family; the caption says so
 * rather than letting the shape imply a clean generational jump.
 *
 * Log x: parameter counts span more than an order of magnitude, and a linear
 * axis piles every small model into the first few pixels. Y runs 0–100 (the
 * benchmark's own range) so the climb is not exaggerated by a truncated
 * baseline.
 *
 * Hexagons rather than dots so the marks read as a set of discrete models
 * rather than a sampled curve — the connecting line orders them by size, it
 * does not interpolate between them.
 *
 * One series, so no legend: the heading says what is plotted and every mark is
 * directly labelled. Colour is the Smartloop-pink ordinal ramp re-encoding the
 * size the x-axis already carries, so nothing rides on colour alone; both mode
 * ramps pass all four ordinal checks against this app's surfaces (#ffffff /
 * #0a0a0a) — light end 2.65:1, dark end 3.28:1, monotone lightness, 6° hue
 * spread. The table underneath is the table view and carries every number with
 * its source.
 */

import { useState } from 'react';
import { Box } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTheme } from '@/app/components/theme-provider';

export interface GraphEntry {
  id: string;
  label: string;
  /** Parameter count in billions. */
  params: number;
  /** Published benchmark score, 0–100. */
  score: number;
  /** How that score was produced, e.g. "Thinking" — null for a standard run. */
  mode: string | null;
  source: string;
  accessible: boolean;
}

const RAMP_LIGHT = ['#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d'];
const RAMP_DARK = ['#be185d', '#db2777', '#ec4899', '#f472b6', '#f9a8d4'];

const W = 720;
const H = 280;
const PAD_L = 46;
const PAD_R = 54;
const PAD_T = 20;
const PAD_B = 42;
const INSET_X = 24;
const Y_TICKS = [0, 25, 50, 75, 100];

const hexPoints = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 90);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

const formatParams = (b: number) => `${b}B`;

export default function ModelCapabilityGraph({
  models,
  unscored = [],
}: {
  models: GraphEntry[];
  /** Catalogue models with no published figure — named, not plotted. */
  unscored?: string[];
}) {
  const { theme } = useTheme();
  const ramp = theme === 'dark' ? RAMP_DARK : RAMP_LIGHT;
  const [hover, setHover] = useState<number | null>(null);

  if (models.length === 0) return null;

  const ordered = [...models].sort((a, b) => a.params - b.params);
  const n = ordered.length;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const logs = ordered.map((m) => Math.log(m.params));
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  const span = hi - lo;
  const x = (p: number) =>
    span === 0 ? PAD_L + plotW / 2 : PAD_L + INSET_X + ((Math.log(p) - lo) / span) * (plotW - INSET_X);
  const y = (score: number) => PAD_T + plotH - (score / 100) * plotH;

  // Label placement, left to right. Two things go wrong without it: the
  // smallest model's label runs back over the y-axis ticks, and two models
  // close in both size and score print on top of each other. So a label that
  // would cross the axis anchors to its mark instead of centring on it, and one
  // that would collide steps up a row until it is clear.
  //
  // Every placed label is tested, not just the previous one — with two families
  // interleaved by size, the label a mark collides with is often two or three
  // positions back (a 31B lands on a 26B while a 27B sits between them, far
  // below both). Widths are estimated from character count: SVG has no text
  // metrics without measuring in the DOM, and 6px per character at 11px is
  // close enough to hold a gap.
  const placed: { left: number; right: number; y: number }[] = [];
  const hits = (left: number, right: number, ly: number) =>
    placed.some((b) => left < b.right + 8 && b.left < right + 8 && Math.abs(ly - b.y) < 26);
  const points = ordered.map((m, i) => {
    const r = n === 1 ? 10 : 9 + (i / (n - 1)) * 3;
    const cx = x(m.params);
    const cy = y(m.score);
    const scoreLine = `${m.score}${m.mode ? ` · ${m.mode}` : ''}${m.accessible ? '' : ' · Pro'}`;
    const width = Math.max(m.label.length * 6, scoreLine.length * 5.5);

    let anchor: 'start' | 'middle' | 'end' = 'middle';
    let labelX = cx;
    if (cx - width / 2 < PAD_L) {
      anchor = 'start';
      labelX = Math.max(cx - r, PAD_L);
    } else if (cx + width / 2 > W - 2) {
      anchor = 'end';
      labelX = Math.min(cx + r, W - 2);
    }

    const left = anchor === 'start' ? labelX : anchor === 'end' ? labelX - width : labelX - width / 2;
    const right = left + width;
    let labelY = Math.max(cy - r - 16, PAD_T + 10);
    while (labelY > 12 && hits(left, right, labelY)) labelY -= 26;
    // Out of room above: drop below the mark rather than stack on the top edge.
    if (hits(left, right, labelY)) labelY = cy + r + 18;
    placed.push({ left, right, y: labelY });

    return {
      ...m,
      cx,
      cy,
      r,
      anchor,
      labelX,
      labelY,
      color: ramp[Math.round((n === 1 ? 1 : i / (n - 1)) * (ramp.length - 1))],
    };
  });

  // The steepest adjacent step, called out in prose because it is the thing a
  // reader is here to learn and a line chart states it only implicitly. Same
  // family and same mode only: a step from a standard run to a thinking one
  // measures the mode, not the model.
  let biggestStep: { from: GraphEntry; to: GraphEntry; gain: number; extraParams: number } | null = null;
  for (let i = 1; i < ordered.length; i++) {
    const from = ordered[i - 1];
    const to = ordered[i];
    if (from.source !== to.source || from.mode !== to.mode) continue;
    const gain = to.score - from.score;
    if (gain > 0 && (!biggestStep || gain > biggestStep.gain)) {
      biggestStep = { from, to, gain, extraParams: to.params - from.params };
    }
  }

  const coherent = points.every((p) => p.source === points[0].source && p.mode === points[0].mode);

  let lastTick = -Infinity;
  const ticks = points.filter((p) => {
    if (p.cx - lastTick < 38) return false;
    lastTick = p.cx;
    return true;
  });

  return (
    <Box>
      <Box sx={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label="Published GPQA Diamond score against parameter count, one mark per model"
        >
          {Y_TICKS.map((t) => (
            <g key={`y-${t}`}>
              <line x1={PAD_L} y1={y(t)} x2={W - PAD_R} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
              <text x={PAD_L - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--faint)">
                {t}
              </text>
            </g>
          ))}
          <text
            x={14}
            y={PAD_T + plotH / 2}
            fontSize="10"
            fill="var(--faint)"
            textAnchor="middle"
            transform={`rotate(-90 14 ${PAD_T + plotH / 2})`}
          >
            GPQA Diamond
          </text>

          {/* Orders the models by size — it does not interpolate between them.
              Drawn only when every mark is the same family measured the same
              way: across families the line zigzags between incomparable points
              and reads as a trend, which is exactly what it is not. */}
          {points.length > 1 && coherent && (
            <polyline
              points={points.map((p) => `${p.cx},${p.cy}`).join(' ')}
              fill="none"
              stroke="var(--chart-grid)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {points.map((p, i) => (
            <g key={p.id} opacity={hover === null || hover === i ? 1 : 0.45} onMouseEnter={() => setHover(i)}>
              {/* Locked models read hollow — a shape difference, so access is
                  never carried by colour alone. */}
              <polygon
                points={hexPoints(p.cx, p.cy, p.r)}
                fill={p.color}
                fillOpacity={p.accessible ? 1 : 0.18}
                stroke={p.accessible ? 'var(--surface)' : p.color}
                strokeWidth="2"
              />
              {/* A label lifted clear of its mark keeps a leader line, so it
                  stays attached to the hexagon it describes. */}
              {p.cy - p.labelY > 34 && (
                <line x1={p.cx} y1={p.labelY + 16} x2={p.cx} y2={p.cy - p.r - 3} stroke="var(--chart-grid)" strokeWidth="1" />
              )}
              {p.labelY - p.cy > 20 && (
                <line x1={p.cx} y1={p.cy + p.r + 3} x2={p.cx} y2={p.labelY - 9} stroke="var(--chart-grid)" strokeWidth="1" />
              )}
              <text x={p.labelX} y={p.labelY} textAnchor={p.anchor} fontSize="11" fill="var(--content)">
                {p.label}
              </text>
              <text x={p.labelX} y={p.labelY + 12} textAnchor={p.anchor} fontSize="10" fill="var(--faint)">
                {p.score}
                {p.mode ? ` · ${p.mode}` : ''}
                {p.accessible ? '' : ' · Pro'}
              </text>
              {/* Hit target wider than the mark. */}
              <circle cx={p.cx} cy={p.cy} r={p.r + 8} fill="transparent" />
            </g>
          ))}

          {ticks.map((p) => (
            <text key={`tick-${p.id}`} x={p.cx} y={H - 18} textAnchor="middle" fontSize="10" fill="var(--faint)">
              {formatParams(p.params)}
            </text>
          ))}
          <text x={PAD_L + plotW / 2} y={H - 2} textAnchor="middle" fontSize="10" fill="var(--faint)">
            Parameters
          </text>
        </svg>

        {hover !== null && (
          <Box
            className="pointer-events-none absolute px-2.5 py-1.5 rounded-lg text-xs"
            sx={{
              left: `${(points[hover].cx / W) * 100}%`,
              top: `${(points[hover].cy / H) * 100}%`,
              transform: 'translate(-50%, -130%)',
              bgcolor: 'var(--surface)',
              border: '1px solid var(--border-2)',
              whiteSpace: 'nowrap',
              zIndex: 1,
            }}
          >
            <div className="text-content font-medium mb-0.5">{points[hover].label}</div>
            <div className="text-muted">
              {formatParams(points[hover].params)} · {points[hover].score} GPQA Diamond
              {points[hover].mode ? ` (${points[hover].mode})` : ''}
            </div>
            <div className="text-faint">
              {points[hover].accessible ? 'Available on your plan' : 'Requires Pro'}
            </div>
          </Box>
        )}
      </Box>

      {/* Table view — every number, with the source and run mode behind it. */}
      <Box className="mt-6 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-faint py-2 pr-4 whitespace-nowrap">Model</th>
              <th className="text-right font-medium text-faint py-2 px-4 whitespace-nowrap">Parameters</th>
              <th className="text-right font-medium text-faint py-2 px-4 whitespace-nowrap">GPQA Diamond</th>
              <th className="text-left font-medium text-faint py-2 pl-4 whitespace-nowrap">Source</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="text-left text-content py-2 pr-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {m.label}
                    {!m.accessible && <LockOutlinedIcon sx={{ fontSize: 12 }} />}
                  </span>
                </td>
                <td className="text-right text-muted py-2 px-4 tabular-nums">{formatParams(m.params)}</td>
                <td className="text-right text-content py-2 px-4 tabular-nums">
                  {m.score.toFixed(1)}
                  {m.mode && <span className="text-faint"> · {m.mode}</span>}
                </td>
                <td className="text-left text-faint py-2 pl-4">{m.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      {biggestStep && (
        <p className="text-xs text-muted leading-relaxed mt-4">
          Sharpest step: <span className="text-content">{biggestStep.from.label}</span> to{' '}
          <span className="text-content">{biggestStep.to.label}</span> adds{' '}
          {biggestStep.gain.toFixed(1)} points for {formatParams(biggestStep.extraParams)} more
          parameters — the size difference is small next to what it buys.
        </p>
      )}

      <p className="text-xs text-faint leading-relaxed mt-2">
        Single-model scores: each figure is one model measured on its own, not a routed or combined
        result. GPQA Diamond as published by each model&apos;s own release — the one benchmark reported
        across every family here. Run mode is marked where a family published one, and it moves this
        benchmark 20–30 points, so a thinking or reasoning figure is not comparable to a standard one.
        {unscored.length > 0 &&
          ` ${unscored.join(', ')} publish no figure on this benchmark, so ${
            unscored.length > 1 ? 'they are' : 'it is'
          } not plotted.`}
      </p>
    </Box>
  );
}
