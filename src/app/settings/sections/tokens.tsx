'use client';

/** Access token management — create, copy once, list, revoke. */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { userService } from '@/app/services/user.service';
import { OAuthUtils } from '@/app/shared/utils';
import { API_ENDPOINT } from '@/app/constants';
import { Row, Section } from '@/app/components/rows';
import moment from 'moment';

const BUTTON_CLASS =
  'px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ' +
  'border border-accent-border hover:bg-accent-soft text-accent-text whitespace-nowrap';

export default function TokensSection({ user }: { user: any }) {
  const router = useRouter();
  const [tokens, setTokens] = useState<{ id: string; name: string; created_at: Date; last_used_at: Date }[]>([]);
  const [tokenName, setTokenName] = useState('');
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTokens = async () => {
    try {
      const response = await userService.makeAuthenticatedRequest(`${API_ENDPOINT}/users/me/tokens`, { method: 'GET' });
      if (response && response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) setTokens(data);
      }
    } catch (err) {
      console.error('Failed to fetch tokens:', err);
    }
  };

  useEffect(() => {
    if (user) getTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const createToken = async () => {
    setDirty(true);
    setError(null);
    if (!tokenName.trim()) return;
    setLoading(true);
    try {
      const response = await userService.makeAuthenticatedRequest(`${API_ENDPOINT}/users/me/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tokenName }),
      });
      if (response && response.ok) {
        const result = await response.json();
        if (result) {
          setRawToken(result.token);
          setTokenName('');
          setDirty(false);
          setCopied(false);
          getTokens();
        }
      } else if (response && response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.detail?.toLowerCase().includes('verified') || errorData.detail?.toLowerCase().includes('verify')) {
          router.push('/verify');
        } else {
          setError(errorData.detail || 'You do not have an active subscription. Please upgrade your plan to generate tokens.');
        }
      }
    } catch (err) {
      console.error('Failed to create token:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteToken = async (tokenId: string) => {
    try {
      const success = await OAuthUtils.deleteToken(tokenId, `${userService.token()}`);
      if (success) setTokens(prev => prev.filter(t => t.id !== tokenId));
    } catch (err) {
      console.error('Failed to delete token:', err);
    }
  };

  return (
    <Section
      title="Access Tokens"
      description="Access the Smartloop platform programmatically via the API or the CLI. Tokens are scoped to your account — treat them like passwords and never share them publicly."
    >
      {rawToken && (
        <Row stacked>
          <Box className="p-3 rounded-lg border border-ok-border bg-ok-soft">
            <Box className="flex items-center gap-2 mb-2">
              <CheckCircleIcon sx={{ fontSize: 16, color: 'var(--ok-text)' }} />
              <span className="text-xs font-bold text-ok uppercase">Token generated — copy it now</span>
            </Box>
            <Box className="flex items-center gap-2 bg-bg border border-border-2 rounded-lg p-2">
              <code className="flex-1 text-accent-text break-all text-xs font-mono">{rawToken}</code>
              <CopyToClipboard text={rawToken} onCopy={() => setCopied(true)}>
                <button className="px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors flex-shrink-0">
                  {copied
                    ? <CheckCircleIcon sx={{ fontSize: 16, color: 'var(--ok-text)' }} />
                    : <ContentCopyIcon sx={{ fontSize: 16, color: 'var(--muted)' }} />}
                </button>
              </CopyToClipboard>
            </Box>
          </Box>
        </Row>
      )}

      {error && (
        <Row stacked>
          <Box className="p-3 rounded-lg border border-danger-border bg-danger-soft">
            <p className="text-sm text-danger">{error}</p>
          </Box>
        </Row>
      )}

      <Row label="New token" description="Name it after where it will be used." stacked>
        <Box className="flex flex-col sm:flex-row gap-2">
          <input
            autoComplete="off"
            type="text"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="Token name (e.g., Production)"
            className={`flex-1 min-w-0 px-4 py-2.5 rounded-lg text-sm text-content bg-surface border ${tokenName.trim().length === 0 && dirty ? 'border-danger-border' : 'border-border-2'} focus:outline-none focus:border-accent placeholder-gray-500`}
            onKeyDown={(e) => { if (e.key === 'Enter') createToken(); }}
          />
          <button onClick={createToken} disabled={loading} className={BUTTON_CLASS}>
            {loading ? <CircularProgress size={16} sx={{ color: 'var(--content)' }} /> : 'Generate'}
          </button>
        </Box>
      </Row>

      {tokens.length === 0 ? (
        <Row description="No tokens yet." />
      ) : (
        tokens.map((token) => (
          <Row
            key={token.id}
            label={token.name}
            description={
              <>
                Created {token.created_at ? moment(token.created_at).format('MMM DD, YYYY') : '--'}
                {token.last_used_at ? ` · Last used ${moment(token.last_used_at).format('MMM DD')}` : ' · Never used'}
              </>
            }
          >
            <button
              onClick={() => deleteToken(token.id)}
              className="text-faint hover:text-danger px-2.5 py-1.5 rounded-lg hover:bg-danger-soft transition-colors"
              aria-label={`Delete ${token.name}`}
            >
              <DeleteIcon sx={{ fontSize: 18 }} />
            </button>
          </Row>
        ))
      )}

      <Row stacked>
        <p className="text-xs text-faint">
          Need help?{' '}
          <a
            href="https://www.smartloop.ai/docs/getting-started/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-text hover:opacity-80 hover:underline font-medium transition-colors"
          >
            Read the documentation →
          </a>
        </p>
      </Row>
    </Section>
  );
}
