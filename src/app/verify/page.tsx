'use client'

import './page.css';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'
import { API_ENDPOINT } from '@/app/constants';
import { Box, CircularProgress, TextField } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import AuthHeader from '@/app/components/auth-header';

export default function Verify() {
	const router = useRouter();
	const [successMessage, setSuccessMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [verifyToken, setVerifyToken] = useState('');

	useEffect(() => {
		// Fetch token from query parameters
		const urlParams = new URLSearchParams(window.location.search);
		const tokenParam = urlParams.get('token');
		if (tokenParam) {
			setVerifyToken(tokenParam);
			// Automatically verify when token is present
			verifyAccount(tokenParam);
		} else {
			setErrorMessage("Check your email for a verification link to verify your account.");
		}
	}, []);

	const handleChange = (newValue: any) => {
		setVerifyToken(newValue);
	}

	const resendVerification = (e: any) => {
		e.preventDefault();
		router.push('/resend');
	}

	const verifyAccount = async (token: string) => {
		setSuccessMessage("");
		setErrorMessage("");
		setDirty(true);

		if (!token) {
			setErrorMessage("Token is missing. Please try again.");
			return;
		}

		const url = `${API_ENDPOINT}/auth/verify`;

		setIsLoading(true);

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token: token.trim()
				})
			});

			setIsLoading(false);

			if (response.ok) {
				const result = await response.json();

				if (result && result.is_verified) {
					setSuccessMessage("Account verified successfully! Redirecting to dashboard...");
					setTimeout(() => {
						router.push('/dashboard');
					}, 2000);
				} else {
					let error = result.message || result.detail
					if (error) {
						setErrorMessage(error);
					} else {
						setErrorMessage("Verification failed");
					}
				}
			} else {
				const result = await response.json();
				let error = result.message || result.detail
				if (error) {
					setErrorMessage(error);
				} else {
					setErrorMessage("Verification failed");
				}
			}
		} catch (error) {
			setIsLoading(false);
			setErrorMessage("An error occurred. Please try again later.");
		}
	}

	const submitForm = async (e: any) => {
		e.preventDefault();
		await verifyAccount(verifyToken);
	}

	return (
		<Box className="min-h-screen bg-bg flex flex-col">
			{/* Top Navigation */}
			<AuthHeader />

			{/* Main Content */}
			<Box className="flex-1 flex items-center justify-center px-6">
				<Box
					sx={{
						maxWidth: '460px',
						width: '100%',
						bgcolor: 'var(--surface)',
						border: '1px solid var(--border)',
						borderRadius: '16px',
						padding: '40px',
					}}
				>
					<h1 className="text-3xl font-normal text-content mb-8">Verify Account</h1>

					{successMessage.length > 0 && (
						<Box className="mb-4 p-3 bg-green-900 bg-opacity-20 border border-green-800 rounded-lg flex items-center">
							<CheckBoxIcon className="text-green-400 mr-2" />
							<p className="text-green-400 text-sm">{successMessage}</p>
						</Box>
					)}

					{errorMessage.length > 0 && (
						<Box className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-800 rounded-lg">
							<p className="text-red-400 text-sm">{errorMessage}</p>
						</Box>
					)}

					{isLoading && (
						<Box className="flex flex-col items-center justify-center py-8">
							<CircularProgress
								sx={{
									color: '#6366f1',
									mb: 2
								}}
								size={48}
							/>
							<p className="text-muted text-sm">Verifying your account...</p>
						</Box>
					)}

					{!isLoading && (
						<>
							<Box className="mb-6">
								<p className="text-muted text-sm">
									Enter your verification token below to verify your account.
								</p>
							</Box>

							<form onSubmit={submitForm}>
								{/* Token Input */}
								<Box className="mb-4">
									<TextField
										id="token"
										name="token"
										type="text"
										placeholder="Verification Token*"
										value={verifyToken}
										onChange={(e) => handleChange(e.target.value)}
										multiline
										rows={4}
										fullWidth
										error={verifyToken.length === 0 && dirty}
										sx={{
											'& .MuiOutlinedInput-root': {
												bgcolor: 'var(--surface)',
												color: 'var(--content)',
												borderRadius: '8px',
												'& fieldset': {
													borderColor: 'var(--border-2)',
												},
												'&:hover fieldset': {
													borderColor: 'var(--muted)',
												},
												'&.Mui-focused fieldset': {
													borderColor: 'var(--faint)',
												},
												'&.Mui-error fieldset': {
													borderColor: '#ef4444',
												},
											},
											'& .MuiInputBase-input': {
												color: 'var(--content)',
												fontFamily: 'monospace',
												'&::placeholder': {
													color: 'var(--muted)',
													opacity: 1,
												},
											},
										}}
									/>
								</Box>

								{/* Verify Button */}
								<button
									type="submit"
									disabled={isLoading}
									style={{
										width: '100%',
										padding: '12px',
										backgroundColor: '#6366f1',
										color: 'var(--content)',
										border: 'none',
										borderRadius: '8px',
										fontSize: '16px',
										fontWeight: '500',
										cursor: isLoading ? 'not-allowed' : 'pointer',
										opacity: isLoading ? 0.5 : 1,
										transition: 'all 0.2s',
									}}
									onMouseEnter={(e) => {
										if (!isLoading) {
											e.currentTarget.style.backgroundColor = '#4f46e5';
										}
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = '#6366f1';
									}}
								>
									{isLoading ? 'Verifying...' : 'Verify Account'}
								</button>

								{/* Resend Link */}
								<Box className="mt-4 text-center">
									<p className="text-muted text-sm">
										Don't have a verification code?{' '}
										<button
											type="button"
											onClick={resendVerification}
											className="text-indigo-400 hover:text-indigo-300 underline"
										>
											Resend
										</button>
									</p>
								</Box>
							</form>
						</>
					)}
				</Box>
			</Box>
		</Box>
	);
}
