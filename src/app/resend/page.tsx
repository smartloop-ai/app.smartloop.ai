'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';
import { useAuth } from '@/app/hooks/useAuth';

import { Box, CircularProgress, TextField } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import MailIcon from '@mui/icons-material/Mail';
import AuthHeader from '@/app/components/auth-header';

import { isValidEmail } from '@/app/shared/utils';

export default function Resend() {
	const router = useRouter();
	const [user] = useAuth();
	const [errorMessage, setErrorMessage] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [formData, setFormData] = useState({
		email: ""
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
		setSuccessMessage("");
		setDirty(true);

		if (formData.email.length === 0) {
			return;
		}

		const email = formData.email.trim();

		if (!isValidEmail(email)) {
			setErrorMessage("Email address is invalid");
			return;
		}

		const url = `${API_ENDPOINT}/auth/request-verify-token`;

		setIsLoading(true);

		try {
			const response = await userService.makeAuthenticatedRequest(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email })
			});

			setIsLoading(false);

			if (response && response.status === 202) {
				setSuccessMessage("If the email exists, we've sent a new verification message.");

				setTimeout(() => {
					router.push('/');
				}, 3000);
			} else if (response) {
				const result = await response.json();
				let error = result.message || result.detail;
				setErrorMessage(error || "Failed to send verification, please try again later");
			}
		} catch (error) {
			setIsLoading(false);
			setErrorMessage("An error occurred. Please try again later.");
		}
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
					<h1 className="text-3xl font-normal text-content mb-4">Resend Verification</h1>

					{user && (
						<p className="text-muted text-sm mb-6">
							Hi <span className="text-content font-medium">{user.name}</span>
						</p>
					)}

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

					<Box className="mb-6">
						<p className="text-muted text-sm leading-relaxed">
							Please confirm the email address used to create your account. We'll send a new verification link.
						</p>
					</Box>

					<form onSubmit={submitForm}>
						{/* Email Input */}
						<Box className="mb-6">
							<TextField
								id="email"
								name="email"
								type="email"
								placeholder="Email*"
								value={formData.email}
								onChange={handleInput}
								fullWidth
								error={formData.email.length === 0 && dirty}
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
										'&::placeholder': {
											color: 'var(--muted)',
											opacity: 1,
										},
									},
								}}
							/>
						</Box>

						{/* Resend Button */}
						<button
							type="submit"
							disabled={isLoading}
							className="w-full py-3 rounded-lg font-medium transition-all mb-6 flex items-center justify-center gap-2"
							style={{
								background: 'linear-gradient(to right, #e9d5ff, #ddd6fe)',
								color: '#1f2937',
								opacity: isLoading ? 0.5 : 1,
								cursor: isLoading ? 'not-allowed' : 'pointer',
							}}
						>
							{isLoading ? <CircularProgress size={20} sx={{ color: '#1f2937' }} /> : <MailIcon sx={{ fontSize: 20 }} />}
							Resend Verification
						</button>

						{/* Back to Login */}
						<Box className="text-center">
							<p className="text-sm text-muted">
								Already verified?{' '}
								<a href="/login" className="text-muted hover:text-content underline">
									Back to Login
								</a>
							</p>
						</Box>
					</form>
				</Box>
			</Box>
		</Box>
	);
}
