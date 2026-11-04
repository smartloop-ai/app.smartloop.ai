import { SHA256 } from 'crypto-js';
import { API_ENDPOINT } from '@/app/constants';

export const isValidEmail = (email: string)=>{
	if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/i.test(email)){
		return false;
	}
	return true;
}

export const gravatar = (user: { email: any }) => {
    return `https://gravatar.com/avatar/${SHA256(user.email)}?d=retro`;
}

// Dedicated route whose only job is to start Stripe checkout for a plan.
export const CHECKOUT_PATH = '/upgrade';

// The plans an account can be on, as the API reports them (`plan` on
// /users/me, /payments/subscription and the usage meters), low to high.
export const PLAN_RANK: Record<string, number> = { free: 0, paid: 1, plus: 2, admin: 3 };

// What checkout takes (the marketing names) -> the plan it puts the account on.
export const PURCHASABLE_PLANS: Record<string, string> = { pro: 'paid', plus: 'plus' };

// The checkout route for a purchasable plan; Pro is the route's default.
export const checkoutPath = (plan: string) =>
    plan === 'pro' ? CHECKOUT_PATH : `${CHECKOUT_PATH}?plan=${encodeURIComponent(plan)}`;

// Whether an account on `current` already has everything `plan` buys.
export const alreadyOn = (current: string | undefined, plan: string) =>
    (PLAN_RANK[current ?? 'free'] ?? 0) >= (PLAN_RANK[PURCHASABLE_PLANS[plan] ?? 'paid'] ?? 0);

/**
 * Resolves the post-auth destination from a login/signup URL. Two friendly
 * forms are supported:
 *   1. A named plan slug: "Get Started" -> /login?plan=pro, which lands on
 *      /upgrade and goes straight to Stripe checkout.
 *   2. An explicit internal path: /login?redirect=/billing
 * Only internal, absolute paths are honored, to avoid open-redirect issues.
 *
 * Accepts a raw query string because `useSearchParams()` is empty on the first
 * client render of a statically exported page — callers that need the value
 * inside a mount effect must pass `window.location.search` instead.
 */
export const getPostAuthPath = (search?: URLSearchParams | string | null): string => {
    if (!search) return '/';

    const params = typeof search === 'string' ? new URLSearchParams(search) : search;

    const planSlug = params.get('plan');
    if (planSlug) {
        return PURCHASABLE_PLANS[planSlug] ? checkoutPath(planSlug) : '/billing';
    }

    const redirectParam = params.get('redirect');
    if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
        return redirectParam;
    }

    return '/';
}

interface OAuthUtilsType {
  getOAuthParams(searchParams: URLSearchParams): {
    responseType: string | null;
    clientId: string | null;
    redirectUri: string | null;
    state: string | null;
    code: string | null;
    token: string | null;
  };
  isOAuthFlow(params: ReturnType<typeof OAuthUtils.getOAuthParams>): boolean;
  createToken(accessToken: string, name: string): Promise<string | null>;
  deleteToken(tokenId: string, accessToken: string): Promise<boolean>;
  getTokens(accessToken: string): Promise<any>;
  createToken(accessToken: string, name: string): Promise<string | null>;
}

export const OAuthUtils: OAuthUtilsType = {
  /**
   * Extracts OAuth parameters from URL search parameters
   */
  getOAuthParams(searchParams: URLSearchParams) {
    return {
      responseType: searchParams.get('response_type'),
      clientId: searchParams.get('client_id'),
      redirectUri: searchParams.get('redirect_uri'),
      state: searchParams.get('state'),
      code: searchParams.get('code'),
      token: searchParams.get('token')
    };
  },

  /**
   * Checks if the current request is part of an OAuth flow
   */
  isOAuthFlow(params: ReturnType<typeof OAuthUtils.getOAuthParams>): boolean {
    return Boolean(params.responseType && params.clientId && params.redirectUri);
  },

  /**
   * Creates a token with the given name
   */
  async createToken(accessToken: string, name: string) {
    try {
      const url = `${API_ENDPOINT}/users/me/tokens`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        throw new Error(`Failed to create token: ${response.status}`);
      }

      const result = await response.json();
      return result.token;
    } catch (error) {
      console.error("Error creating token:", error);
      return null;
    }
  },

  /**
   * Deletes a token by ID
   */
  async deleteToken(tokenId: string, accessToken: string) {
    try {
      const url = `${API_ENDPOINT}/users/me/tokens/${tokenId}`;
      const options = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      };

      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Failed to delete token: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("Error deleting token:", error);
      return false;
    }
  },

  /**
   * Gets all tokens for a user
   */
  async getTokens(accessToken: string) {
    try {
      const url = `${API_ENDPOINT}/users/me/tokens`;
      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      };

      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Failed to fetch tokens: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching tokens:", error);
      return null;
    }
  },
}

// The old getPlans() helper lived here and duplicated plan names, prices and
// feature bullets from the marketing site — which is how the app came to
// advertise $19/mo while smartloop.ai/pricing said $5. That copy now has
// exactly one home: smartloop.ai/pricing, linked via PRICING_URL.


