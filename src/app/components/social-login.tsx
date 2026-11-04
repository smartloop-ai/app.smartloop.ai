'use client';

import { Box, IconButton } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import AppleIcon from '@mui/icons-material/Apple';
import { API_ENDPOINT } from '@/app/constants';
import { getPostAuthPath } from '@/app/shared/utils';

type Provider = 'google' | 'apple' | 'github';

/**
 * The provider buttons, shared by /login and /signup.
 *
 * `layout` is what separates the two callers. Signing in is passwordless now,
 * so on /login these buttons are one of only two ways in and are stacked
 * full-width, the same shape the desktop app gives them. Signing up still
 * leads with a form, so there they stay the compact row they have always been.
 */
export default function SocialLogin(props: {
    onError: any,
    searchParams?: URLSearchParams,
    mode?: string,
    layout?: 'row' | 'stacked',
    providers?: Provider[],
}) {
    const layout = props.layout ?? 'row';
    const providers = props.providers ?? ['google', 'apple'];
  // Fetch the OAuth client login URL and on success forward to the google login flow
    const handleOauthLogin = async (e: React.MouseEvent<HTMLAnchorElement>, provider: string) => {
        props.onError("");

        try {
            let url = `${API_ENDPOINT}/auth/${provider}/authorize`;

            // Store mode parameter if present (desktop port is already stored by login page)
            if (props.mode) {
                localStorage.setItem('oauth_mode', props.mode);
            } else {
                localStorage.removeItem('oauth_mode');
            }

            // Store an optional post-login destination so it survives the
            // provider round-trip. Supports the named slug (?plan=pro) and an
            // explicit internal path (?redirect=/billing). Read straight from the
            // URL so a statically exported first render can't lose it.
            const postAuthPath = getPostAuthPath(window.location.search);
            const postLoginRedirect = postAuthPath === '/' ? null : postAuthPath;
            if (postLoginRedirect) {
                localStorage.setItem('post_login_redirect', postLoginRedirect);
            } else {
                localStorage.removeItem('post_login_redirect');
            }

            // If we have CLI OAuth parameters, store them in localStorage
            if (props.searchParams) {
                const redirectUri = props.searchParams.get('redirect_uri');
                const clientId = props.searchParams.get('client_id');
                const state = props.searchParams.get('state');
                const responseType = props.searchParams.get('response_type');

                // Store OAuth parameters in localStorage for later retrieval only if this is an OAuth flow
                if (redirectUri && clientId) {
                    // Clear any existing parameters first
                    localStorage.removeItem('cli_redirect_uri');
                    localStorage.removeItem('cli_client_id');
                    localStorage.removeItem('cli_state');
                    localStorage.removeItem('cli_response_type');

                    // Store new parameters
                    localStorage.setItem('cli_redirect_uri', redirectUri);
                    localStorage.setItem('cli_client_id', clientId);

                    if (state) {
                        localStorage.setItem('cli_state', state);
                    }

                    if (responseType) {
                        localStorage.setItem('cli_response_type', responseType);
                    }

                    // Also add to URL for server-side processing
                    url += `?cli_redirect_uri=${encodeURIComponent(redirectUri)}`;
                    url += `&cli_client_id=${encodeURIComponent(clientId)}`;

                    if (state) {
                        url += `&cli_state=${encodeURIComponent(state)}`;
                    }

                    if (responseType) {
                        url += `&cli_response_type=${encodeURIComponent(responseType)}`;
                    }
                } else {
                    // Not an OAuth flow, clear any leftover parameters
                    localStorage.removeItem('cli_redirect_uri');
                    localStorage.removeItem('cli_client_id');
                    localStorage.removeItem('cli_state');
                    localStorage.removeItem('cli_response_type');
                }
            }

            const options = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            const response = await fetch(url, options);

            if (response.ok) {
                const result = await response.json();

                if (result.authorization_url) {
                    // Forward to provider login flow
                    window.location.href = result.authorization_url;
                } else {
                    props.onError(`Failed to fetch ${provider} login URL.`);
                }
            } else {
                props.onError("Failed to contact the server.");
            }
        } catch (error) {
            props.onError(`An error occurred while trying to log in with ${provider}.`);
            console.error(`${provider} login error:`, error);
        }
    };

    // Inline so the button pulls in nothing remote, and so the mark keeps its
    // own colours against either surface.
    const googleMark = (
        <img src="/img/google-symbol.svg" alt="" aria-hidden style={{ width: '20px', height: '20px' }} />
    );

    const label: Record<Provider, string> = {
        apple: 'Continue with Apple',
        google: 'Continue with Google',
        github: 'Continue with GitHub',
    };
    const icon: Record<Provider, React.ReactNode> = {
        apple: <AppleIcon sx={{ fontSize: 18, mt: '-2px' }} />,
        google: googleMark,
        github: <GitHubIcon sx={{ fontSize: 18 }} />,
    };

    const start = (provider: Provider) => (e: any) => {
        e.preventDefault();
        handleOauthLogin(e, provider);
    };

    if (layout === 'stacked') {
        return (
            <Box className="flex flex-col gap-2">
                {providers.map((provider) => (
                    <button
                        key={provider}
                        type="button"
                        onClick={start(provider)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface hover:bg-surface-2 text-content border border-border-2 rounded-lg font-medium transition-colors"
                    >
                        {icon[provider]}
                        <span>{label[provider]}</span>
                    </button>
                ))}
            </Box>
        );
    }

    // Row: the first provider carries the label and takes the space left over,
    // the rest are icon squares beside it.
    const [lead, ...rest] = providers;

    return (
        <Box className="flex gap-3 mb-6">
            {lead && (
                <button
                    type="button"
                    onClick={start(lead)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-surface hover:bg-surface-2 text-content border border-border-2 rounded-lg font-medium transition-colors"
                >
                    {icon[lead]}
                    <span>{label[lead]}</span>
                </button>
            )}

            {rest.map((provider) => (
                <IconButton
                    key={provider}
                    type="button"
                    aria-label={label[provider]}
                    onClick={start(provider)}
                    sx={{
                        bgcolor: 'var(--surface)',
                        border: '1px solid var(--border-2)',
                        borderRadius: '8px',
                        width: '48px',
                        height: '48px',
                        color: 'var(--content)',
                        '&:hover': {
                            bgcolor: 'var(--surface-2)',
                        },
                    }}
                >
                    {icon[provider]}
                </IconButton>
            ))}
        </Box>
    )
}
