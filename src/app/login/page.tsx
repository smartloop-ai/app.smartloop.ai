'use client'

import './page.css';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'

import { API_ENDPOINT } from '@/app/constants';
import { getPostAuthPath, isValidEmail, OAuthUtils } from '@/app/shared/utils';
import { userService } from '@/app/services/user.service';
import { refreshStoredSession, sendTokensToDesktop, storeRefreshToken, REFRESH_TOKEN_KEY } from '@/app/shared/desktop';
import { Box, CircularProgress } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';

import LoadingSpinner from '../components/loading-spinner';
import AuthHeader from '../components/auth-header';
import SocialLogin from '../components/social-login';

/**
 * Sign-in, without a password.
 *
 * There are two ways in and neither of them is a credential this app holds:
 *   - Google / Apple, which hand back through the existing OAuth callback.
 *   - Email, which mails a six-digit code. One screen for the address, one for
 *     the code.
 *
 * /auth/otp/verify returns the same access + refresh pair /auth/jwt/login used
 * to, so everything downstream of a successful sign-in — the OAuth hand-off,
 * desktop mode, the post-login destination — is unchanged and shared by both
 * routes through `completeSignIn`.
 *
 * Accounts are still made with a password on /signup, and /forgot still resets
 * it; this page simply no longer asks for one. An account that has one signs in
 * with a code like everyone else.
 */

/** Which of the two email screens is showing. */
type Step = 'identify' | 'code';

const CODE_LENGTH = 6;

/**
 * The API answers failures with a machine code in `detail.code` and a sentence
 * in `detail.message`. Switching on the code keeps the wording ours and matches
 * what the desktop app shows for the same failure; anything unrecognised falls
 * through to the server's own sentence, then to the status.
 */
const OTP_MESSAGES: Record<string, string> = {
  OTP_NO_ACCOUNT: 'No Smartloop account uses that email.',
  OTP_INVALID: 'That code is not right. Check the email and try again.',
  OTP_EXPIRED: 'That code has expired. Send a new one.',
  OTP_TOO_MANY_ATTEMPTS: 'Too many tries. Send a new code and start again.',
  OTP_RATE_LIMITED: 'Too many codes requested. Wait a minute and try again.',
  OTP_ACCOUNT_INACTIVE: 'That account is not active.',
  OTP_SEND_FAILED: 'Could not send the email. Please try again.',
  OTP_INVALID_EMAIL: 'That is not an email address.',
};

const authErrorCode = (body: any): string | undefined => {
  const detail = body?.detail;
  return typeof detail === 'string' ? detail : detail?.code;
};

const authErrorMessage = (status: number, body: any): string => {
  const detail = body?.detail;
  const code = authErrorCode(body);

  if (code && OTP_MESSAGES[code]) return OTP_MESSAGES[code];
  if (typeof detail === 'string' && detail) return detail;
  if (typeof detail?.message === 'string' && detail.message) return detail.message;
  // slowapi answers its own 429 without a `detail`, so this is the only thing
  // standing between a rate-limited caller and a bare HTTP number.
  if (status === 429) return 'Too many codes requested. Wait a minute and try again.';
  if (status === 422) return 'Check the email address and try again.';
  return `Sign-in failed (HTTP ${status}).`;
};

const postJson = async (path: string, payload: Record<string, string>) => {
  const res = await fetch(`${API_ENDPOINT}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* empty or non-JSON body */ }
  return { ok: res.ok, status: res.status, body };
};

// Main content component that uses useSearchParams
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>('identify');
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [errorMessage, setErrorMessage] = useState("");
  // The platform answers "no account" distinctly, and it is the one failure
  // here a retry cannot fix — so the way forward is /signup, not the field.
  const [noAccount, setNoAccount] = useState(false);
  const [resent, setResent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join('');

  // Extract OAuth parameters from URL using the utility
  const oauthParams = OAuthUtils.getOAuthParams(searchParams);
  const isOAuthFlow = OAuthUtils.isOAuthFlow(oauthParams);

  // Extract mode parameter for native app integration
  const mode = searchParams.get('mode');
  const desktopPort = searchParams.get('port');

  // Optional post-login destination — /login?plan=pro goes straight to Stripe
  // checkout, /login?redirect=/some/path to an internal page. See getPostAuthPath.
  const postLoginPath = getPostAuthPath(searchParams);

  // Function to handle OAuth flow and token management
  const handleOAuthFlow = async (accessToken: string) => {
    try {
      // Use optimized method to get or create a token
      const developerToken = await OAuthUtils.createToken(
        accessToken,
        oauthParams.clientId || 'oauth-client'
      );

      // Use the redirectUri from search params
      if (!oauthParams.redirectUri) {
        throw new Error('No redirect URI provided');
      }

      // Build the redirect URL with appropriate parameters
      const redirectUrl = new URL(oauthParams.redirectUri);

      // Add parameters
      redirectUrl.searchParams.append('code', accessToken);
      if (developerToken) {
        redirectUrl.searchParams.append('token', developerToken);
      }
      if (oauthParams.state) {
        redirectUrl.searchParams.append('state', oauthParams.state);
      }

      // Redirect to the callback URL
      window.location.href = redirectUrl.toString();
    } catch (error) {
      console.error('Error handling OAuth flow:', error);
      // Fallback - redirect without token if redirectUri exists
      if (oauthParams.redirectUri) {
        const redirectUrl = new URL(oauthParams.redirectUri);
        redirectUrl.searchParams.append('code', accessToken);
        if (oauthParams.state) {
          redirectUrl.searchParams.append('state', oauthParams.state);
        }
        window.location.href = redirectUrl.toString();
      } else {
        // If no redirect URI, go to home page
        router.push('/');
      }
    }
  };

  /**
   * Everything that happens once tokens exist, whatever minted them.
   *
   * The emailed code and the old password form return the identical pair, so
   * this is lifted out whole rather than reimplemented for the new route.
   */
  const completeSignIn = async (result: { access_token: string, refresh_token?: string }) => {
    localStorage.setItem("token", result.access_token);
    storeRefreshToken(result.refresh_token);

    // Handle OAuth flow if present
    if (isOAuthFlow) {
      await handleOAuthFlow(result.access_token);
      return;
    }

    // Clear any OAuth parameters to ensure clean login
    localStorage.removeItem('cli_redirect_uri');
    localStorage.removeItem('cli_client_id');
    localStorage.removeItem('cli_state');
    localStorage.removeItem('cli_response_type');

    // Handle desktop mode - send tokens to localhost
    if (mode === 'desktop' && desktopPort) {
      await sendTokensToDesktop(result.access_token, result.refresh_token, desktopPort);
    } else if (mode === 'native') {
      // Legacy native mode - redirect via custom URL scheme
      console.log(`Navigating to redirect page for native app`);
      router.push(`/redirect?token=${result.access_token}`);
    } else {
      // Standard login flow - redirect to the intended destination
      // (e.g. "Get Started" -> /upgrade straight to Stripe checkout)
      // or fall back to home/dashboard.
      router.push(postLoginPath);
    }
  };

  // Store desktop port in localStorage so it survives OAuth redirects
  useEffect(() => {
    if (mode === 'desktop' && desktopPort) {
      localStorage.setItem('desktop_port', desktopPort);
    }
  }, [mode, desktopPort]);

  // If the user already has a valid session, skip the login form and send them
  // straight to their destination (e.g. "Get Started" -> /login?plan=pro lands
  // on /upgrade, which goes straight to checkout — instead of the dashboard).
  // Desktop mode does the same when a refresh token is stored: it is exchanged
  // for a fresh pair and handed to the local agent, as a sign-in would. OAuth /
  // native still re-auth so their tokens reach the right place.
  //
  // The destination is re-read from window.location here rather than taken from
  // `postLoginPath`: this page is statically exported, so `useSearchParams()` is
  // still empty when this mount effect runs and ?plan / ?redirect would be lost.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    const urlPort = params.get('port');
    const isOAuth = OAuthUtils.isOAuthFlow(OAuthUtils.getOAuthParams(params));

    if (!isOAuth && urlMode === 'desktop' && urlPort) {
      let active = true;
      refreshStoredSession().then((pair) => {
        if (!active) return;
        if (pair) {
          sendTokensToDesktop(pair.access_token, pair.refresh_token, urlPort);
        } else {
          setCheckingSession(false);
        }
      });
      return () => { active = false; };
    }

    const isStandardFlow = !isOAuth
      && urlMode !== 'desktop' && urlMode !== 'native';
    if (!isStandardFlow) {
      setCheckingSession(false);
      return;
    }

    let active = true;
    userService.get()
      .then((u: any) => {
        if (!active) return;
        if (u) {
          router.replace(getPostAuthPath(window.location.search));
        } else {
          setCheckingSession(false);
        }
      })
      .catch(() => {
        if (active) setCheckingSession(false);
      });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear OAuth parameters from localStorage on component mount for regular login
  useEffect(() => {
    // If not an OAuth flow, clear any leftover CLI parameters from localStorage
    if (!isOAuthFlow) {
      localStorage.removeItem('cli_redirect_uri');
      localStorage.removeItem('cli_client_id');
      localStorage.removeItem('cli_state');
      localStorage.removeItem('cli_response_type');
    }
  }, [isOAuthFlow]);

  // Land the caret in the first box whenever the code screen appears.
  useEffect(() => {
    if (step !== 'code') return;
    const t = setTimeout(() => codeInputs.current[0]?.focus(), 60);
    return () => clearTimeout(t);
  }, [step]);

  // ── Email code flow ─────────────────────────────────────────────────────────
  const emailLooksValid = useMemo(() => isValidEmail(email.trim()), [email]);

  const sendCode = async () => {
    const { ok, status, body } = await postJson('/auth/otp/request', { email: email.trim() });
    if (!ok) {
      setNoAccount(authErrorCode(body) === 'OTP_NO_ACCOUNT');
      setErrorMessage(authErrorMessage(status, body));
      return false;
    }
    return true;
  };

  const requestCode = async (e?: any) => {
    e?.preventDefault();
    if (isLoading || !emailLooksValid) return;

    setIsLoading(true);
    setErrorMessage("");
    setNoAccount(false);
    try {
      if (!await sendCode()) return;
      setDigits(Array(CODE_LENGTH).fill(''));
      setStep('code');
    } catch (error) {
      console.error("Sign-in code request failed:", error);
      setErrorMessage("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage("");
    try {
      if (!await sendCode()) return;
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch (error) {
      console.error("Sign-in code resend failed:", error);
      setErrorMessage("Could not resend the code.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = useCallback(async (value: string) => {
    if (isLoading || value.length !== CODE_LENGTH) return;

    setIsLoading(true);
    setErrorMessage("");
    try {
      const { ok, status, body } = await postJson('/auth/otp/verify', {
        email: email.trim(),
        code: value,
      });

      if (!ok || !body?.access_token) {
        setErrorMessage(authErrorMessage(status, body));
        // A wrong code is worth another go, and an empty field is a clearer
        // invitation to retype than six boxes that have to be cleared first.
        setDigits(Array(CODE_LENGTH).fill(''));
        codeInputs.current[0]?.focus();
        localStorage.removeItem("token");
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem("u");
        return;
      }

      await completeSignIn(body);
    } catch (error) {
      console.error("Sign-in code verification failed:", error);
      setErrorMessage("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, isLoading, isOAuthFlow, mode, desktopPort, postLoginPath]);

  /** Write one box and move on; a full code verifies without another click. */
  const setDigit = (index: number, raw: string) => {
    const chars = raw.replace(/\D/g, '');
    if (!chars) return;

    setDigits((prev) => {
      const next = [...prev];
      // A paste lands in one box but fills the rest — people paste the whole
      // code out of the email far more often than they retype it.
      for (let i = 0; i < chars.length && index + i < CODE_LENGTH; i++) {
        next[index + i] = chars[i];
      }
      const landed = Math.min(index + chars.length, CODE_LENGTH - 1);
      codeInputs.current[landed]?.focus();

      const joined = next.join('');
      if (joined.length === CODE_LENGTH && !joined.includes('')) void verifyCode(joined);
      return next;
    });
  };

  const onCodeKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      setDigits((prev) => {
        const next = [...prev];
        // Backspace in an empty box steps back and clears the one before it,
        // which is what every OS code field does.
        if (next[index]) next[index] = '';
        else if (index > 0) {
          next[index - 1] = '';
          codeInputs.current[index - 1]?.focus();
        }
        return next;
      });
    } else if (event.key === 'ArrowLeft' && index > 0) {
      codeInputs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      codeInputs.current[index + 1]?.focus();
    }
  };

  const backToEmail = () => {
    setStep('identify');
    setErrorMessage("");
    setResent(false);
    setDigits(Array(CODE_LENGTH).fill(''));
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  // While we check for an existing session, show the branded spinner rather than
  // flashing the login form (and then redirecting an already-signed-in user).
  if (checkingSession) {
    return <LoadingSpinner showLogo message="Loading..." size={48} />;
  }

  const inputClass =
    'w-full rounded-lg px-4 py-3 text-sm bg-surface text-content border border-border-2 '
    + 'outline-none transition-colors placeholder:text-muted '
    + 'hover:border-muted focus:border-faint';

  const primaryButtonClass =
    'w-full flex items-center justify-center gap-2 py-4 rounded-lg font-medium transition-all '
    + 'bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed '
    + 'disabled:hover:bg-pink-500';

  const card = (children: React.ReactNode) => (
    <Box className="min-h-screen bg-bg flex flex-col">
      {/* Top Navigation */}
      <AuthHeader />

      {/* Main Content */}
      <Box className="flex-1 flex flex-col items-center px-6">
        <div className="flex-[2]" aria-hidden />
        <Box
          sx={{
            maxWidth: '460px',
            width: '100%',
            bgcolor: 'var(--surface-2)',
            border: '1px solid var(--border-2)',
            borderRadius: '16px',
            padding: '40px',
          }}
        >
          {children}
        </Box>
        <div className="flex-[3]" aria-hidden />
      </Box>
    </Box>
  );

  if (step === 'code') {
    return card(
      <>
        <button
          type="button"
          onClick={backToEmail}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors mb-6"
        >
          <ArrowBackIosNewIcon sx={{ fontSize: 12 }} />
          Back
        </button>

        <h1 className="text-3xl font-normal text-content mb-2">Verify your email</h1>
        <p className="text-sm text-muted mb-8">
          Enter the code we sent to <span className="text-content">{email.trim()}</span>
        </p>

        <Box className="flex justify-center gap-2 mb-4">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { codeInputs.current[index] = el; }}
              value={digit}
              onChange={(e) => setDigit(index, e.target.value)}
              onKeyDown={onCodeKeyDown(index)}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={CODE_LENGTH}
              disabled={isLoading}
              aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
              className="w-[48px] h-[56px] rounded-lg text-center text-xl font-medium bg-surface text-content border border-border-2 outline-none transition-colors focus:border-pink-500 disabled:opacity-60"
            />
          ))}
        </Box>

        {errorMessage.length > 0 && (
          <Box className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-800 rounded-lg">
            <p className="text-red-400 text-sm">{errorMessage}</p>
          </Box>
        )}

        <Box className="text-center text-sm text-muted mb-6">
          {resent ? (
            <span className="text-content">A new code is on its way.</span>
          ) : (
            <span>
              Didn&apos;t get it?{' '}
              <button
                type="button"
                onClick={resendCode}
                disabled={isLoading}
                className="text-content font-medium hover:text-pink-500 transition-colors disabled:opacity-50"
              >
                Resend
              </button>
            </span>
          )}
        </Box>

        <button
          type="button"
          onClick={() => verifyCode(code)}
          disabled={isLoading || code.length !== CODE_LENGTH}
          className={primaryButtonClass}
        >
          {isLoading && <CircularProgress size={18} sx={{ color: 'inherit' }} />}
          Verify
        </button>
      </>
    );
  }

  return card(
    <>
      <h1 className="text-3xl font-normal text-content mb-2">Sign in to Smartloop</h1>
      <p className="text-sm text-muted mb-8">
        Enter your email and we&apos;ll send you a sign-in code
      </p>

      {/* Social Login Buttons — stacked and full width: with the password gone
          these are one of only two ways in, not an aside to a form. */}
      <SocialLogin
        onError={(msg: string) => setErrorMessage(msg)}
        searchParams={searchParams}
        mode={mode || undefined}
        layout="stacked"
        providers={['apple', 'google']}
      />

      {/* Divider */}
      <Box className="flex items-center gap-3 my-6">
        <span className="flex-1 h-px bg-border-2" />
        <span className="text-sm text-muted">or</span>
        <span className="flex-1 h-px bg-border-2" />
      </Box>

      <form onSubmit={requestCode} autoComplete="on">
        <Box className="mb-4">
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrorMessage(""); setNoAccount(false); }}
            className={inputClass}
          />
        </Box>

        {errorMessage.length > 0 && (
          <Box className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-800 rounded-lg">
            <p className="text-red-400 text-sm">
              {errorMessage}
              {/* Nothing to retry — an address with no account needs an
                  account, and this page cannot make one. */}
              {noAccount && (
                <>
                  {' '}
                  <a href="/signup" className="underline text-content hover:text-pink-500">
                    Create an account
                  </a>
                </>
              )}
            </p>
          </Box>
        )}

        <button
          type="submit"
          disabled={isLoading || !emailLooksValid}
          className={`${primaryButtonClass} mb-6`}
        >
          {isLoading && <CircularProgress size={18} sx={{ color: 'inherit' }} />}
          Continue with email
        </button>

        {/* Footer Text */}
        <Box className="text-center">
          <p className="text-sm text-muted mb-2">
            New to Smartloop?{' '}
            <a href="/signup" className="underline hover:text-content">
              Create an account
            </a>
          </p>
          <p className="text-sm text-muted">
            By joining, you agree to the{' '}
            <a href="https://smartloop.ai/terms/" target="_blank" rel="noopener noreferrer" className="underline hover:text-content">
              Terms and Privacy Policy.
            </a>
          </p>
        </Box>
      </form>
    </>
  );
}

// Wrap with Suspense
export default function Login() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LoginContent />
    </Suspense>
  );
}
