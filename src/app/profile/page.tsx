'use client';

/**
 * Profile — what the hosted account actually knows about you.
 *
 * This page used to show a usage chart built from Math.random(), plan credit
 * allowances that do not exist, and project/document counts that are always
 * zero because projects live locally and are never sent to us. Everything here
 * now comes from a real endpoint, and anything we do not track is simply absent.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from '@/app/hooks/useAuth';
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';
import AppShell from '@/app/components/app-shell';
import { Row, Section } from '@/app/components/rows';
import ActivityChart from '@/app/components/activity-chart';
import moment from 'moment';

interface AccessLogEntry {
  id: string;
  timestamp: string;
  action: string;
  status: number;
  client?: string | null;
  user_agent?: string | null;
  detail?: string | null;
}

const LOG_PREVIEW_COUNT = 5;

const ACTION_LABELS: Record<string, string> = {
  websearch: 'Web search',
};

function StatusChip({ status }: { status: number }) {
  const ok = status < 400;
  // 4xx is the interesting case for an owner reading their own log — it means
  // something used the account and was turned away.
  const tone = ok ? 'ok' : status < 500 ? 'warn' : 'danger';
  return (
    <span
      className="inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded-md"
      style={{
        backgroundColor: `var(--${tone}-soft)`,
        color: `var(--${tone}-text)`,
        border: `1px solid var(--${tone}-border)`,
      }}
    >
      {status}
    </span>
  );
}

export default function Profile() {
  const router = useRouter();
  const [user] = useAuth();
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showAllLogs, setShowAllLogs] = useState(false);

  useEffect(() => {
    if (!user) return;

    const load = async (path: string, apply: (data: any[]) => void) => {
      try {
        const response = await userService.makeAuthenticatedRequest(
          `${API_ENDPOINT}${path}`,
          { method: 'GET' }
        );
        if (response && response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) apply(data);
        }
      } catch (err) {
        console.error(`Failed to load ${path}:`, err);
      }
    };

    load('/logs/access?days=30&limit=500', (data) => setLogs(data)).finally(() =>
      setLoadingLogs(false)
    );
  }, [user]);

  const plan = user?.is_premium ? 'Premium' : user?.is_paid ? 'Pro' : 'Free';

  if (!user) return null;

  return (
    <AppShell user={user}>
      <Box className="max-w-3xl">
        <Box className="mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-content tracking-tight">Profile</h1>
          <p className="text-muted text-sm mt-1.5 leading-relaxed">
            Your account, recent activity, and where it has been used from.
          </p>
        </Box>

        <Section title="Account">
          <Row label="Name">
            <span className="text-sm text-muted">{user.name || '—'}</span>
          </Row>
          <Row label="Email">
            <Box className="flex items-center gap-2">
              <span className="text-sm text-muted">{user.email}</span>
              {user.is_verified ? (
                <CheckCircleIcon sx={{ fontSize: 16, color: 'var(--ok-text)' }} titleAccess="Verified" />
              ) : (
                <CancelIcon sx={{ fontSize: 16, color: 'var(--warn-text)' }} titleAccess="Not verified" />
              )}
            </Box>
          </Row>
          <Row label="Plan" description={plan === 'Free' ? 'Upgrade for larger models and priority support.' : undefined}>
            <Box className="flex items-center gap-3">
              <span className="text-sm text-muted">{plan}</span>
              <button
                onClick={() => router.push('/settings/billing')}
                className="text-sm text-accent-text hover:opacity-80 hover:underline font-medium transition-colors whitespace-nowrap"
              >
                Manage billing
              </button>
            </Box>
          </Row>
          {(user.created_at || user.createdAt) && (
            <Row label="Member since">
              <span className="text-sm text-muted">
                {moment(user.created_at || user.createdAt).format('MMM DD, YYYY')}
              </span>
            </Row>
          )}
        </Section>

        <Box className="mt-10">
          <Section
            title="Activity"
            description="Requests your account made over the last 14 days, by category."
          >
            <Row label="Tokens processed" description="No monthly allowance to run out of.">
              <span className="text-sm text-muted">
                {(user.number_of_tokens_processed || 0).toLocaleString()}
              </span>
            </Row>
            <Row stacked>
              {loadingLogs ? (
                <Box className="flex items-center gap-2">
                  <CircularProgress size={16} sx={{ color: 'var(--muted)' }} />
                  <span className="text-sm text-faint">Loading…</span>
                </Box>
              ) : (
                <ActivityChart entries={logs} />
              )}
            </Row>
          </Section>
        </Box>

        <Box className="mt-10">
          <Section
            title="Access log"
            description="Where your account has been used in the last 30 days, and by which client. Search queries are never recorded."
          >
            {loadingLogs ? (
              <Row>
                <Box className="flex items-center gap-2">
                  <CircularProgress size={16} sx={{ color: 'var(--muted)' }} />
                  <span className="text-sm text-faint">Loading…</span>
                </Box>
              </Row>
            ) : logs.length === 0 ? (
              <Row description="No recorded activity yet." />
            ) : (
              <>
                {(showAllLogs ? logs : logs.slice(0, LOG_PREVIEW_COUNT)).map((entry) => (
                  <Row
                    key={entry.id}
                    label={ACTION_LABELS[entry.action] || entry.action}
                    description={
                      <>
                        {moment(entry.timestamp).fromNow()}
                        {entry.client ? ` · ${entry.client}` : ''}
                        {entry.detail ? ` · ${entry.detail}` : ''}
                      </>
                    }
                  >
                    <StatusChip status={entry.status} />
                  </Row>
                ))}

                {logs.length > LOG_PREVIEW_COUNT && (
                  <Row stacked>
                    <Box className="flex justify-center">
                      <button
                        onClick={() => setShowAllLogs((v) => !v)}
                        className="inline-flex items-center gap-1 text-sm text-muted hover:text-content transition-colors"
                      >
                        {showAllLogs
                          ? 'Show less'
                          : `Show ${logs.length - LOG_PREVIEW_COUNT} more`}
                        <ExpandMoreIcon
                          sx={{
                            fontSize: 18,
                            transition: 'transform 0.15s ease',
                            transform: showAllLogs ? 'rotate(180deg)' : 'none',
                          }}
                        />
                      </button>
                    </Box>
                  </Row>
                )}
              </>
            )}
          </Section>
        </Box>
      </Box>
    </AppShell>
  );
}
