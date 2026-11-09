import { API_ENDPOINT } from '@/app/constants';

/**
 * Where the browser keeps the refresh token beside `token`, so a session that
 * already exists can be handed to the desktop app or `docent` without signing
 * in again: they need the refresh token too, or their sign-in dies with the
 * access token.
 */
export const REFRESH_TOKEN_KEY = 'refresh_token';

/** Keep (or, when the sign-in route gave none, forget) the refresh token. */
export const storeRefreshToken = (refreshToken?: string | null) => {
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

/**
 * Hand a token pair to the local agent's `/v1/auth/callback` on `port`.
 * POST first (Firefox/Chrome); Safari blocks that mixed-content fetch, so fall
 * back to navigating to the callback with the tokens in the query.
 */
export const sendTokensToDesktop = async (accessToken: string, refreshToken: string | null | undefined, port: string) => {
  localStorage.removeItem('desktop_port');
  const callbackUrl = `http://127.0.0.1:${port}/v1/auth/callback`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    window.location.href = '/redirect/?mode=desktop';
  } catch {
    clearTimeout(timeout);
    window.location.href = callbackUrl
      + `?access_token=${encodeURIComponent(accessToken)}`
      + `&refresh_token=${encodeURIComponent(refreshToken || '')}`;
  }
};

/**
 * Turn the stored refresh token into a fresh pair, storing it. `null` when
 * there is none or the platform no longer honours it (expired, signed out
 * elsewhere): the caller then asks for a sign-in as usual.
 */
export const refreshStoredSession = async (): Promise<{ access_token: string, refresh_token: string } | null> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_ENDPOINT}/auth/jwt/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return null;
    }
    const pair = await res.json();
    if (!pair?.access_token || !pair?.refresh_token) return null;
    localStorage.setItem('token', pair.access_token);
    storeRefreshToken(pair.refresh_token);
    return pair;
  } catch {
    return null;
  }
};
