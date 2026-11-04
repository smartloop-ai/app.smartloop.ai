'use client'

import './page.css';

import { Box } from '@mui/material';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LoadingSpinner from '../../components/loading-spinner';
import AuthHeader from '../../components/auth-header';

// Content component that uses searchParams
function MCPOAuthCallbackContent() {
  const searchParams = useSearchParams();
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double execution
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const success = searchParams.get('success');
    const serverId = searchParams.get('server_id');

    if (success === 'true' && serverId) {
      // Construct the smartloop://mcp-authorization URL with server_id
      const url = `smartloop://mcp-authorization?server_id=${encodeURIComponent(serverId)}`;
      setRedirectUrl(url);
    } else if (success === 'false') {
      setError('MCP authorization failed. Please try again.');
    } else if (!serverId) {
      setError('Missing server ID. Please try again.');
    }
  }, [searchParams]);

  if (error) {
    return (
      <Box className="min-h-screen bg-bg flex flex-col">
        <AuthHeader />
        <Box className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-[460px] w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10">
            <div className="flex flex-col items-center gap-6">
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-semibold text-content">
                  Authorization Failed
                </h3>
                <p className="text-muted text-sm">{error}</p>
              </div>
              <a
                href="/dashboard"
                className="px-8 py-4 rounded-lg font-medium transition-all text-lg w-full text-center"
                style={{
                  background: 'linear-gradient(to right, #e9d5ff, #ddd6fe)',
                  color: '#1f2937',
                }}
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </Box>
        <Box className="py-10 flex justify-center">
          {/*  placeholder for additional content */}
        </Box>
      </Box>
    );
  }

  if (!redirectUrl) {
    return <LoadingSpinner showLogo message="Preparing redirect..." size={48} />;
  }

  return (
    <Box className="min-h-screen bg-bg flex flex-col">
      {/* Top Navigation */}
      <AuthHeader />

      {/* Main Content */}
      <Box className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-[460px] w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10">
          <div className="flex flex-col items-center gap-6">
            <div className="text-center space-y-3">
              {/* <h3 className="text-2xl font-semibold text-content">
                 Authorization Successful
              </h3> */}
              <p className="text-muted text-sm">
                Click below to return to the studio app and start using your MCP server.
              </p>
            </div>
            <div className="rounded-lg p-4 w-full bg-surface/30 border border-border-2/20">
              <p className="text-xs text-center text-muted">
                Your MCP server has been authorized successfully and is ready to use.
              </p>
            </div>

            <a
              href={redirectUrl}
              className="px-8 py-4 rounded-lg font-medium transition-all text-lg w-full text-center"
              style={{
                background: 'linear-gradient(to right, #e9d5ff, #ddd6fe)',
                color: '#1f2937',
              }}
            >
              Return to App
            </a>

            <div className="text-center">
              <a
                href="/dashboard"
                className="text-sm text-muted hover:text-content transition-colors underline"
              >
                Or visit your dashboard
              </a>
            </div>
          </div>
        </div>
      </Box>

      <Box className="py-10 flex justify-center">
        {/*  placeholder for additional content */}
      </Box>

    </Box>
  );
}

// Wrap with Suspense
export default function MCPOAuthCallback() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MCPOAuthCallbackContent />
    </Suspense>
  );
}
