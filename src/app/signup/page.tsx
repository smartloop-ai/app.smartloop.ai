'use client'

import './page.css';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'

import { API_ENDPOINT } from '@/app/constants';
import { isValidEmail } from '@/app/shared/utils';
import { Box, CircularProgress } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SocialLogin from '@/app/components/social-login';
import LoadingSpinner from '@/app/components/loading-spinner';
import AuthHeader from '@/app/components/auth-header';

/**
 * Registration.
 *
 * Laid out as the mirror of /login: the same card, the same stacked provider
 * buttons above the same `or` rule, the same fields and primary button. Signing
 * in is passwordless now and this page is not — it still sets a password, which
 * /forgot and /reset still use — but the two pages are the two halves of one
 * door, and they should look like it.
 */

/** Both auth pages type into the same field. */
const inputClass =
	'w-full rounded-lg px-4 py-3 text-sm bg-surface text-content border border-border-2 '
	+ 'outline-none transition-colors placeholder:text-muted '
	+ 'hover:border-muted focus:border-faint';

const primaryButtonClass =
	'w-full flex items-center justify-center gap-2 py-4 rounded-lg font-medium transition-all '
	+ 'bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed '
	+ 'disabled:hover:bg-pink-500';

function SignupContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [successMessage, setSuccessMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [createNew, setCreateNew] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [inviteCode, setInviteCode] = useState("");
	const [formData, setFormData] = useState({
		password: "",
		name: "",
		email: ""
	});

	// Extract mode parameter for native app integration
	const mode = searchParams.get('mode');

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const inviteCodeParam = urlParams.get('inviteCode');
		if (inviteCodeParam) {
			setInviteCode(inviteCodeParam);
			console.log("Found inviteCode: " + inviteCode + " using it for signup.");
		}
	});

	const handleInput = (e: any) => {
		const fieldName = e.target.name;
		const fieldValue = e.target.value;

		setFormData((prevState) => ({
			...prevState,
			[fieldName]: fieldValue
		}));
	}

	const submitForm = async (e: any) => {
		e.preventDefault();

		setErrorMessage("");
		setCreateNew(false);
		setDirty(true);

		const url = `${API_ENDPOINT}/auth/register`;

		if (formData.email.length === 0
			|| formData.password.length === 0
			|| formData.name.length === 0) {
			return;
		}

		if (formData.name.split(' ').length == 1) {
			setErrorMessage("Name must contain first and last name separated by a space");
			return;
		}

		if (!isValidEmail(formData.email)) {
			setErrorMessage("Email address is invalid");
			return;
		}

		setIsLoading(true);

		const options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				password: formData.password,
				email: formData.email,
				name: formData.name,
				invite_code: inviteCode
			})
		}

		try {
			const response = await fetch(url, options);
			const result = await response.json();

			setIsLoading(false);

			if (response.ok) {
				// Carry an optional post-login destination through to login
				// (e.g. "Get Started" -> /signup?plan=pro or ?redirect=/billing).
				const planSlug = searchParams.get('plan');
				const redirectParam = searchParams.get('redirect');
				if (planSlug) {
					router.push(`/login?plan=${encodeURIComponent(planSlug)}`);
				} else if (redirectParam) {
					router.push(`/login?redirect=${encodeURIComponent(redirectParam)}`);
				} else {
					router.push('/login');
				}
			} else {
				setErrorMessage(result.detail || "Registration failed. Please try again.");
			}
		} catch (error) {
			setIsLoading(false);
			setErrorMessage("An error occurred. Please try again.");
		}
	}

	/** A field that turns its border red once the form has been tried empty. */
	const fieldClass = (value: string) =>
		`${inputClass}${value.length === 0 && dirty ? ' border-red-500 hover:border-red-500 focus:border-red-500' : ''}`;

	return (
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
					<h1 className="text-3xl font-normal text-content mb-2">Join Smartloop</h1>
					<p className="text-sm text-muted mb-8">
						Create an account to get started
					</p>

					{/* Social Login Buttons — stacked and full width, the shape
					    /login gives them. */}
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

					<form onSubmit={submitForm} autoComplete="off">
						{/* Name Input */}
						<Box className="mb-4">
							<input
								id="name"
								name="name"
								type="text"
								placeholder="Full name"
								value={formData.name}
								onChange={handleInput}
								autoComplete="name"
								className={fieldClass(formData.name)}
							/>
						</Box>

						{/* Email Input */}
						<Box className="mb-4">
							<input
								id="email"
								name="email"
								type="email"
								placeholder="you@example.com"
								value={formData.email}
								onChange={handleInput}
								autoComplete="email"
								className={fieldClass(formData.email)}
							/>
						</Box>

						{/* Password Input */}
						<Box className="mb-4 relative">
							<input
								id="password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								placeholder="Password"
								value={formData.password}
								onChange={handleInput}
								autoComplete="new-password"
								className={`${fieldClass(formData.password)} pr-12`}
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
								className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-muted hover:text-content transition-colors"
							>
								{showPassword ? <VisibilityOffIcon sx={{ fontSize: 20 }} /> : <VisibilityIcon sx={{ fontSize: 20 }} />}
							</button>
						</Box>

						{/* Invite Code Input (if present) */}
						{inviteCode && (
							<Box className="mb-4">
								<input
									id="inviteCode"
									name="inviteCode"
									type="text"
									placeholder="Invite Code"
									value={inviteCode}
									disabled
									className={`${inputClass} text-muted disabled:opacity-70`}
								/>
							</Box>
						)}

						{successMessage.length > 0 && (
							<Box className="mb-4 p-3 bg-green-900 bg-opacity-20 border border-green-800 rounded-lg">
								<p className="text-green-400 text-sm">{successMessage}</p>
							</Box>
						)}

						{errorMessage.length > 0 && (
							<Box className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-800 rounded-lg">
								<p className="text-red-400 text-sm">{errorMessage}</p>
							</Box>
						)}

						{/* Create Account Button */}
						<button
							type="submit"
							disabled={isLoading}
							className={`${primaryButtonClass} mb-6`}
						>
							{isLoading && <CircularProgress size={18} sx={{ color: 'inherit' }} />}
							Create Account
						</button>

						{/* Footer Text — the mirror of the link /login carries.
						    The "Forgot your password?" link that used to sit here
						    answered a question nobody asks while creating an
						    account; /forgot is still reachable from /reset. */}
						<Box className="text-center">
							<p className="text-sm text-muted mb-2">
								Already have an account?{' '}
								<a href="/login" className="underline hover:text-content">
									Sign in
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
				</Box>
				<div className="flex-[3]" aria-hidden />
			</Box>
		</Box>
	);
}

// Wrap with Suspense
export default function Signup() {
	return (
		<Suspense fallback={<LoadingSpinner />}>
			<SignupContent />
		</Suspense>
	);
}
