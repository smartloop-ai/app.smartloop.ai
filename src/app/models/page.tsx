'use client';

/**
 * Models available on the platform, and which of them this account can use.
 *
 * The catalogue is readable signed out (the API returns `is_accessible: false`
 * rather than hiding Pro models) so the page can show what a plan unlocks
 * instead of an empty list. Internal models are filtered out server-side for
 * anyone who is not a superuser — nothing here has to hide them.
 */

import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useAuth } from '@/app/hooks/useAuth';
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';
import AppShell from '@/app/components/app-shell';
import { Section } from '@/app/components/rows';
import ModelCapabilityGraph, { type GraphEntry } from '@/app/components/model-capability-graph';
import {
  type ModelEntry,
  capabilitiesFor,
  labelFor,
  modelParams,
  scoreFor,
} from './catalog';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-md"
      style={{
        backgroundColor: 'var(--surface-2)',
        color: 'var(--muted)',
        border: '1px solid var(--border)',
      }}
    >
      {children}
    </span>
  );
}

function GroupHeader({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={4} className="pt-5 pb-2 text-xs font-semibold uppercase tracking-wide text-faint">
        {title}
      </td>
    </tr>
  );
}

function ModelRow({ m, hasPlan }: { m: ModelEntry; hasPlan: boolean }) {
  const params = modelParams(m);
  const text = [m.description, m.is_trainable ? 'Fine-tunable' : null]
    .filter(Boolean)
    .join(' · ');
  const caps = capabilitiesFor(m);
  const isPro = m.access_level === 'pro';
  const locked = (isPro || m.access_level === 'internal') && !hasPlan;
  return (
    <tr className="border-t border-border align-top">
      <td className="text-left text-content py-3 pr-4 whitespace-nowrap">
        <span>{labelFor(m)}</span>
      </td>
      <td className="text-right text-muted py-3 px-4 tabular-nums">
        {params ? `${params}B` : '—'}
      </td>
      <td className="text-left text-faint py-3 px-4 hidden md:table-cell">
        {text && <span className="block text-muted">{text}</span>}
        {caps.length > 0 && (
          <span className="flex flex-wrap gap-1.5 mt-1.5">
            {caps.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </span>
        )}
      </td>
      <td className="text-right py-3 pl-4 whitespace-nowrap">
        {locked ? (
          <span
            className="inline-flex items-center text-faint"
            title="Locked"
            aria-label="Locked"
          >
            <LockOutlinedIcon sx={{ fontSize: 17 }} />
          </span>
        ) : (
          <span className="inline-flex items-center text-muted" title="Available">
            <LockOpenIcon sx={{ fontSize: 17, color: 'var(--ok-text)' }} />
          </span>
        )}
      </td>
    </tr>
  );
}

function ModelRows({ models, hasPlan }: { models: ModelEntry[]; hasPlan: boolean }) {
  // Every account here is signed in, so free-with-login is simply free.
  const free = models.filter((m) => m.access_level === 'free' || m.access_level === 'free_login');
  const pro = models.filter((m) => m.access_level === 'pro');
  const internal = models.filter((m) => m.access_level === 'internal');
  return (
    <Box className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left font-medium text-faint py-2 pr-4 whitespace-nowrap">Model</th>
            <th className="text-right font-medium text-faint py-2 px-4 whitespace-nowrap">Parameters</th>
            <th className="text-left font-medium text-faint py-2 px-4 whitespace-nowrap hidden md:table-cell">Details</th>
            <th className="text-right font-medium text-faint py-2 pl-4 whitespace-nowrap">Access</th>
          </tr>
        </thead>
        <tbody>
          {free.length > 0 && (
            <>
              <GroupHeader title="Free models" />
              {free.map((m) => (
                <ModelRow key={m.id} m={m} hasPlan={hasPlan} />
              ))}
            </>
          )}
          {pro.length > 0 && (
            <>
              <GroupHeader title="Pro models" />
              {pro.map((m) => (
                <ModelRow key={m.id} m={m} hasPlan={hasPlan} />
              ))}
            </>
          )}
          {internal.length > 0 && (
            <>
              <GroupHeader title="Internal models" />
              {internal.map((m) => (
                <ModelRow key={m.id} m={m} hasPlan={hasPlan} />
              ))}
            </>
          )}
        </tbody>
      </table>
    </Box>
  );
}

export default function Models() {
  const [user] = useAuth();
  const [models, setModels] = useState<ModelEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const response = await userService.makeAuthenticatedRequest(
          `${API_ENDPOINT}/models`,
          { method: 'GET' }
        );
        if (response && response.ok) {
          const data = await response.json();
          // Cloud models have no size or published score to plot; they are
          // listed, with their usage, under Cloud Models.
          if (Array.isArray(data)) {
            setModels(data.filter((m) => !m.is_bootstrap && m.type !== 'remote'));
          }
        } else {
          setError('Could not load the model catalogue.');
        }
      } catch (err) {
        console.error('Failed to load models:', err);
        setError('Could not load the model catalogue.');
      }
    };
    load();
  }, [user]);

  if (!user) return null;

  const allModels = models || [];
  const hasPlan = !!(user.is_paid || user.is_premium);

  // Models with a published figure are plotted; the rest are named under the
  // chart. SL-mini is among the latter — it routes between these models rather
  // than competing with them, and publishes no benchmark of its own.
  const plotted: GraphEntry[] = [];
  const unscored: string[] = [];
  for (const m of allModels.filter((e) => e.access_level !== 'internal')) {
    const params = modelParams(m);
    const figure = scoreFor(m);
    if (params !== null && figure) {
      plotted.push({
        id: m.id,
        label: labelFor(m),
        params,
        score: figure.score,
        mode: figure.mode,
        source: figure.source,
        accessible: m.is_accessible,
      });
    } else {
      unscored.push(labelFor(m));
    }
  }

  return (
    <AppShell user={user}>
      <Box className="max-w-3xl">
        <Box className="mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-content tracking-tight">Models</h1>
          <p className="text-muted text-sm mt-1.5 leading-relaxed">
            The models available on the platform, and which your plan can use.
          </p>
        </Box>

        {error && (
          <Box className="mb-4 p-3 rounded-lg border border-danger-border bg-danger-soft">
            <p className="text-sm text-danger">{error}</p>
          </Box>
        )}

        {models === null && !error ? (
          <Box className="flex items-center gap-2 py-2">
            <CircularProgress size={16} sx={{ color: 'var(--muted)' }} />
            <span className="text-sm text-faint">Loading…</span>
          </Box>
        ) : (
          <>
            {/* Between the title and the lists: it is what someone comes here to
                compare, and the lists below are the detail behind it. */}
            {plotted.length > 0 && (
              <Box className="mb-10">
                <Section
                  title="Capability by size"
                  description="Published single-model benchmark scores against parameter count."
                >
                  <ModelCapabilityGraph models={plotted} unscored={unscored} />
                </Section>
              </Box>
            )}

            <Section
              title="Models"
              description="Every model on the platform and which plan unlocks it."
            >
              <ModelRows models={allModels} hasPlan={hasPlan} />
            </Section>
          </>
        )}
      </Box>
    </AppShell>
  );
}
