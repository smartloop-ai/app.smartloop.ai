'use client';

/**
 * Dashboard — getting started, token usage, and estimated savings.
 *
 * Laid out with the same Section/Row primitives as Settings and Profile: flat
 * sections split by hairlines rather than nested cards, so the signed-in app
 * reads as one surface instead of three different ones.
 */

import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAuth } from '@/app/hooks/useAuth';
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';
import AppShell from '@/app/components/app-shell';
import { Row, Section } from '@/app/components/rows';

interface DailyUsage {
  date: string;
  fullDate: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}

// What the same traffic would have cost on a typical hosted frontier model,
// which is the saving running locally represents.
const COST_INPUT = 2.5 / 1_000_000;
const COST_OUTPUT = 10.0 / 1_000_000;

const STEPS = [
  {
    n: 1,
    icon: DownloadOutlinedIcon,
    title: 'Install Studio',
    desc: 'Download and launch the desktop app to run models privately on your device.',
  },
  {
    n: 2,
    icon: FolderOpenOutlinedIcon,
    title: 'Create a project',
    desc: 'Add your documents or connect a data source to build a workspace.',
  },
  {
    n: 3,
    icon: AutoAwesomeOutlinedIcon,
    title: 'Extract with AI',
    desc: 'Ask questions in plain language and let your assistant surface the answers.',
  },
];

export default function Dashboard() {
  const [user] = useAuth();
  const [usageData, setUsageData] = useState<DailyUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    if (user) fetchUsageMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchUsageMetrics = async () => {
    setUsageLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINT}/usage/tokens?days=7`, {
        headers: { Authorization: `Bearer ${userService.token()}` },
      });
      if (response.ok) {
        const records = await response.json();
        const toLocalKey = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const grouped: Record<string, { totalTokens: number; promptTokens: number; completionTokens: number }> = {};

        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          grouped[toLocalKey(d)] = { totalTokens: 0, promptTokens: 0, completionTokens: 0 };
        }

        for (const r of records) {
          const key = toLocalKey(new Date(r.timestamp));
          if (grouped[key]) {
            grouped[key].totalTokens += r.total_tokens;
            grouped[key].promptTokens += r.prompt_tokens;
            grouped[key].completionTokens += r.completion_tokens;
          }
        }

        const daily: DailyUsage[] = Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dateStr, vals]) => {
            const d = new Date(dateStr + 'T00:00:00');
            return {
              date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              fullDate: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              ...vals,
            };
          });

        setUsageData(daily);
      }
    } catch (err) {
      console.error('Usage metrics fetch error:', err);
    } finally {
      setUsageLoading(false);
    }
  };

  if (!user) return null;

  const totalTokens = usageData.reduce((sum, d) => sum + d.totalTokens, 0);
  const dailyCosts = usageData.map(d => d.promptTokens * COST_INPUT + d.completionTokens * COST_OUTPUT);
  const totalSaved = dailyCosts.reduce((sum, c) => sum + c, 0);
  const maxCost = Math.max(...dailyCosts, 0.001);
  const firstName = user?.name ? `, ${user.name.split(' ')[0]}` : '';

  const spinner = (
    <Row>
      <Box className="flex items-center gap-2">
        <CircularProgress size={16} sx={{ color: 'var(--muted)' }} />
        <span className="text-sm text-faint">Loading…</span>
      </Box>
    </Row>
  );

  // Sparkline geometry for the 7-day token series.
  const sparkline = (() => {
    if (!usageData.length) return null;
    const maxTokens = Math.max(...usageData.map(d => d.totalTokens), 1);
    const h = 120;
    const pad = 20;
    const graphH = h - pad * 2;
    const stepX = usageData.length > 1 ? 100 / (usageData.length - 1) : 50;
    const points = usageData.map((d, i) => ({
      x: i * stepX,
      y: pad + graphH - (d.totalTokens / maxTokens) * graphH,
    }));
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
    return { linePath, areaPath: `${linePath} L100 ${h} L0 ${h} Z`, h };
  })();

  return (
    <AppShell user={user}>
      <Box className="max-w-3xl">
        <Box className="mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-content tracking-tight">Dashboard</h1>
          <p className="text-muted text-sm mt-1.5 leading-relaxed">
            Get started, track your token usage, and see your estimated cost savings.
          </p>
        </Box>

        <Section
          title={`Getting started${firstName}`}
          description="Smartloop turns your documents into answers with private, on-device AI. Three steps to your first extraction."
        >
          {STEPS.map(({ n, icon: Icon, title, desc }) => (
            <Row
              key={n}
              label={
                <Box className="flex items-center gap-2">
                  <Icon sx={{ fontSize: 16, color: 'var(--accent)' }} />
                  <span>{title}</span>
                </Box>
              }
              description={desc}
            >
              <span className="text-xs text-faint whitespace-nowrap">Step {n}</span>
            </Row>
          ))}

          <Row stacked>
            <Box className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a
                href="https://www.smartloop.ai/download"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent-text hover:opacity-80 transition-colors"
              >
                <DownloadOutlinedIcon sx={{ fontSize: 16 }} />
                Download app
              </a>
              <a
                href="https://www.smartloop.ai/docs/intro/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors"
              >
                <MenuBookOutlinedIcon sx={{ fontSize: 16 }} />
                Read the docs
              </a>
              <a
                href="/settings/tokens"
                className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors"
              >
                Access tokens
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </a>
            </Box>
          </Row>
        </Section>

        <Box className="mt-10">
          <Section title="Token usage" description="Processed by the hosted API over the last 7 days.">
            {usageLoading ? spinner : (
              <>
                <Row label="Last 7 days">
                  <span className="text-sm text-muted">{totalTokens.toLocaleString()} tokens</span>
                </Row>
                <Row stacked>
                  {sparkline && (
                    <>
                      <svg
                        viewBox={`0 0 100 ${sparkline.h}`}
                        preserveAspectRatio="none"
                        style={{ width: '100%', height: '120px', display: 'block' }}
                      >
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={sparkline.areaPath} fill="url(#areaGrad)" />
                        <path
                          d={sparkline.linePath}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="0.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                      <Box className="flex justify-between mt-1.5">
                        {usageData.map((day, i) => (
                          <span key={i} className="text-[10px] text-faint">{day.date}</span>
                        ))}
                      </Box>
                    </>
                  )}
                  {totalTokens === 0 && (
                    <p className="text-xs text-faint mt-2">
                      No token usage recorded in the last 7 days.
                    </p>
                  )}
                </Row>
              </>
            )}
          </Section>
        </Box>

        <Box className="mt-10">
          <Section
            title="Estimated cost saved"
            description="What the same traffic would have cost on a hosted frontier model, at $2.50 per million input and $10.00 per million output tokens."
          >
            {usageLoading ? spinner : (
              <>
                <Row label="Last 7 days">
                  <span className="text-sm text-muted">${totalSaved.toFixed(4)}</span>
                </Row>
                <Row stacked>
                  <Box className="flex items-end gap-2" sx={{ height: '120px' }}>
                      {dailyCosts.map((cost, i) => (
                        <Box key={i} className="flex-1 flex flex-col items-center justify-end" sx={{ height: '100%' }}>
                          <Box
                            title={`${usageData[i].fullDate}: $${cost.toFixed(4)}`}
                            sx={{
                              width: '100%',
                              height: `${Math.max((cost / maxCost) * 100, 4)}%`,
                              bgcolor: cost > 0 ? 'var(--ok-text)' : 'var(--chart-empty)',
                              borderRadius: '3px 3px 0 0',
                              transition: 'opacity 0.2s ease',
                              '&:hover': cost > 0 ? { opacity: 0.85 } : {},
                            }}
                          />
                          <span className="text-[10px] text-faint mt-1.5">{usageData[i].date}</span>
                        </Box>
                      ))}
                  </Box>
                  {totalSaved === 0 && (
                    <p className="text-xs text-faint mt-2">
                      Nothing to compare yet — run a few requests first.
                    </p>
                  )}
                </Row>
              </>
            )}
          </Section>
        </Box>
      </Box>
    </AppShell>
  );
}
