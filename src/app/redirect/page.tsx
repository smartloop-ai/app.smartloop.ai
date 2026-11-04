'use client'

import './page.css';

import { Box } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import LoadingSpinner from '../components/loading-spinner';
import AuthHeader from '../components/auth-header';
import { userService } from '@/app/services/user.service';

// Content component that uses searchParams
function RedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Fetch user information
    const fetchUser = async () => {
      try {
        const user = await userService.get();
        if (user && user.name) {
          // Extract first name (text before first space)
          const firstName = user.name.split(' ')[0];
          setUserName(firstName);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    // Prevent double execution
    if (hasRedirected.current) return;

    const mode = searchParams.get('mode');

    // Desktop mode: tokens already POSTed to localhost, just show success
    if (mode === 'desktop') {
      hasRedirected.current = true;
      setIsDesktopMode(true);
      return;
    }

    // Legacy native mode: construct smartloop:// URL
    const token = searchParams.get('token');
    const state = searchParams.get('state');

    if (token) {
      hasRedirected.current = true;

      const redirectUrl = new URL('smartloop://oauth/callback');
      redirectUrl.searchParams.append('token', token);

      if (state) {
        redirectUrl.searchParams.append('state', state);
      }

      setRedirectUrl(redirectUrl.toString());
    }
  }, [searchParams, router]);

  if (!isDesktopMode && !redirectUrl) {
    return <LoadingSpinner showLogo message="Preparing redirect..." size={48} />;
  }

  return (
    <Box className="min-h-screen bg-bg flex flex-col">
      {/* Top Navigation */}
      <AuthHeader />

      {/* Main Content */}
      <Box className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-[460px] w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10">
          {isDesktopMode ? (
            <div className="flex flex-col items-center gap-6">
              <CheckCircleIcon sx={{ fontSize: 56, color: 'var(--accent-text)' }} />
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-semibold text-content">
                  You&apos;re signed in{userName && `, ${userName}`}
                </h3>
                <p className="text-muted text-sm">
                  Your account is now connected. Head back to the app to continue — you can close this tab.
                </p>
              </div>

              <div className="text-center">
                <a
                  href="/dashboard"
                  className="text-sm text-muted hover:text-content transition-colors underline"
                >
                  Or visit your dashboard
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-semibold text-content">
                  Welcome{userName && `, ${userName}`}
                </h3>
                <p className="text-muted text-sm">
                  Click below to launch the studio app and start extracting insights with your AI assistant.
                </p>
              </div>
              <div className="rounded-lg p-4 w-full bg-surface/30 border border-border-2/20">
                <p className="text-xs text-center text-muted">
                  💡 <span className="font-semibold">Quick tip:</span> Your studio app is where the magic happens. It is your private AI assistant that runs on your device and designed to safe-guard your information
                </p>
              </div>

              <a
                href={redirectUrl!}
                className="px-8 py-4 rounded-lg font-medium transition-all text-lg w-full text-center bg-pink-500 text-white hover:bg-pink-600"
              >
                Launch Studio App
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
          )}
        </div>
      </Box>

      <Box className="py-10 flex justify-center">
        {/*  placeholder for additional content */}
      </Box>

    </Box>
  );
}

// Wrap with Suspense
export default function Redirect() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RedirectContent />
    </Suspense>
  );
}
