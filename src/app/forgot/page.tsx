'use client'

import './page.css';

import { useState } from 'react';
import { useRouter } from 'next/navigation'
import { API_ENDPOINT } from '@/app/constants';
import { Box, CircularProgress, TextField } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { isValidEmail } from '@/app/shared/utils';
import AuthHeader from '@/app/components/auth-header';

export default function Forgot() {
	const router = useRouter();
	const [errrorMessage, setErrrorMessage] = useState("");
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

		setErrrorMessage("");
		setSuccessMessage("");
		setDirty(true);

		if (formData.email.length === 0) {
			return;
		}

		if (!isValidEmail(formData.email)) {
			setErrrorMessage("Email address is invalid");
			return;
		}

		const url = `${API_ENDPOINT}/auth/forgot-password`;

		const options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email: formData.email.trim()
			})
		}

		setIsLoading(true);
		const response = await fetch(url, options)
		setIsLoading(false);

		// Check if the response status is 202.
		if (response.status === 202) {
			setSuccessMessage(`Reset link sent to ${formData.email}`);
			return;
		}

		// Attempt to parse the JSON response if the status is not 202
		const result = await response.json();

		// Handle other success scenarios.
		if (result.success) {
			setSuccessMessage(`Reset link sent to ${formData.email}`);

			// TODO: forward to / after 5 seconds?
		} else {
			const error = result.message || result.detail;
			setErrrorMessage(error || "Reset failed");
		}
	}

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
					<h1 className="text-3xl font-normal text-content mb-8">Forgot Password?</h1>

					{successMessage.length > 0 && (
						<Box className="mb-4 p-3 bg-green-900 bg-opacity-20 border border-green-800 rounded-lg flex items-center">
							<CheckBoxIcon className="text-green-400 mr-2" />
							<p className="text-green-400 text-sm">{successMessage}</p>
						</Box>
					)}

					{errrorMessage.length > 0 && (
						<Box className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-800 rounded-lg">
							<p className="text-red-400 text-sm">{errrorMessage}</p>
						</Box>
					)}

					<Box className="mb-6">
						<p className="text-muted text-sm">
							Enter your email address and we'll send you a link to reset your password.
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

						{/* Send Reset Link Button */}
						<button
							type="submit"
							disabled={isLoading}
							className="w-full py-3 rounded-lg font-medium transition-all mb-6 bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-70"
						>
							{isLoading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Send Reset Link'}
						</button>

						{/* Back to Login Link */}
						<Box className="text-center">
							<a
								href="/login"
								className="text-sm text-muted hover:text-content underline"
							>
								Back to Login
							</a>
						</Box>
					</form>
				</Box>
				<div className="flex-[3]" aria-hidden />
			</Box>
		</Box>
	);
}
