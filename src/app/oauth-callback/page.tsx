'use client'

import './page.css';

import Image from "next/image";
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_ENDPOINT } from '@/app/constants';

import { userService } from '@/app/services/user.service';
import { sendTokensToDesktop, storeRefreshToken } from '@/app/shared/desktop';
import LoadingSpinner from '../components/loading-spinner';

// Content component that uses searchParams
function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const hasCalledApi = useRef(false);

  // Helper function to handle app redirect (native, desktop, or regular)
  const handleAppRedirect = async (token: string, refreshToken: string | null, cliState: string | null, mode: string | null) => {
    if (mode === 'desktop') {
      const port = localStorage.getItem('desktop_port');
      if (port) {
        await sendTokensToDesktop(token, refreshToken, port);
      } else {
        console.error('Desktop mode but no port found');
        router.push('/');
      }
    } else if (mode === 'native') {
      // Legacy native mode - redirect via custom URL scheme
      const redirectPageUrl = new URLSearchParams();
      redirectPageUrl.append('token', token);

      if (cliState) {
        redirectPageUrl.append('state', cliState);
      }

      console.log(`Navigating to redirect page for native app`);
      router.push(`/redirect?${redirectPageUrl.toString()}`);
    } else {
      // Regular mode - use Next.js router. Honor an optional post-login
      // destination stashed before the provider round-trip (e.g. "Get Started"
      // -> /upgrade straight to Stripe checkout).
      const postLoginRedirect = localStorage.getItem('post_login_redirect');
      if (postLoginRedirect) {
        localStorage.removeItem('post_login_redirect');
      }
      const dest =
        postLoginRedirect && postLoginRedirect.startsWith('/') && !postLoginRedirect.startsWith('//')
          ? postLoginRedirect
          : '/';
      console.log(`Redirecting to ${dest}`);
      router.push(dest);
    }
  };


  // Handle all OAuth callbacks
  const handleOAuthCallback = async () => {
    if (hasCalledApi.current) return;
    hasCalledApi.current = true;

    try {
      // Check for mode parameter from localStorage
      let mode = localStorage.getItem('oauth_mode');
      if (mode) {
        localStorage.removeItem('oauth_mode');
      }

      // Check for CLI parameters from URL or localStorage
      let cliRedirectUri = searchParams.get('cli_redirect_uri');
      let cliClientId = searchParams.get('cli_client_id');
      let cliState = searchParams.get('cli_state');

      // If not in URL params, try localStorage
      if (!cliRedirectUri) {
        cliRedirectUri = localStorage.getItem('cli_redirect_uri');
        if (cliRedirectUri) {
          // Clear after use
          localStorage.removeItem('cli_redirect_uri');
        }
      }

      if (!cliClientId) {
        cliClientId = localStorage.getItem('cli_client_id');
        if (cliClientId) {
          localStorage.removeItem('cli_client_id');
        }
      }

      if (!cliState) {
        cliState = localStorage.getItem('cli_state');
        if (cliState) {
          localStorage.removeItem('cli_state');
        }
      }

      // Standard social login callback
      const provider = searchParams.get("provider");

      if (!provider || (provider !== "google" && provider !== "github" && provider !== "apple")) {
        setErrorMessage("Invalid or missing provider.");
        return;
      }

      // Handle Apple OAuth differently since it redirects with token as URL parameter
      if (provider === "apple") {
        const token = searchParams.get("code");
        if (!token) {
          setErrorMessage("Missing token from Apple OAuth.");
          return;
        }

        // Store the token
        localStorage.setItem("token", token);
        storeRefreshToken(null);

        // Handle redirect for both native and regular modes
        // Apple OAuth doesn't provide a refresh_token here
        await handleAppRedirect(token, null, cliState, mode);
        return;
      }

      const query = window.location.search;
      const callbackUrl = `${API_ENDPOINT}/auth/${provider}/callback${query}`;

      setIsLoading(true);

      const response = await fetch(callbackUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      storeRefreshToken(data.refresh_token);

      // Handle redirect for both native and regular modes
      await handleAppRedirect(data.access_token, data.refresh_token || null, cliState, mode);
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(`Unable to login. Please try again.`);
      console.error("OAuth callback error:", error);
    }
  };

  // Check URL and handle the appropriate callback
  useEffect(() => {
    handleOAuthCallback();
  }, [searchParams]);

  if (isLoading) {
    return <LoadingSpinner showLogo message="Redirecting, please wait..." size={48} />;
  }

  return (
    <main className="justify-center min-h-screen w-full">
      <section className="page__projects w-full flex items-center flex-col gap-10">
        <Image src="/img/logo.svg" width={178} height={33} alt="logo" />

        <div className="flex flex-col gap-4">
          <div className="welcome-page__container">
            <div className="welcome-page__body flex flex-col items-center">
              {errorMessage.length > 0 && (
                <div className="items-center justify-center flex w-full" role="alert">
                  <p>
                    {errorMessage} Please create a{' '}
                    <a className="text-pink-100 underline" href="/support">
                      support
                    </a>{' '}
                    ticket if you continue to experience issues.
                  </p>
                </div>
              )}
            </div>
          </div>
          {errorMessage.length === 0 && (
            <div className="flex flex-col items-center">
              <a
                href="/"
                className="text-xs text-blue-400 hover:underline py-5"
              >
                Click to continue
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// Wrap with Suspense
export default function OAuthCallback() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
