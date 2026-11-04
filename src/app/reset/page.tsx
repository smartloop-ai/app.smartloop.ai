'use client'

import './page.css';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'
import { API_ENDPOINT } from '@/app/constants';
import { Box, CircularProgress, IconButton, InputAdornment, TextField } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AuthHeader from '@/app/components/auth-header';

export default function Reset({ params }: { params: { slug: string } }) {
	const router = useRouter();
	const [errorMessage, setErrorMessage] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const [resetToken, setResetToken] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [formData, setFormData] = useState({
		password: ""
	});

	useEffect(() => {
		// Fetch token from query parameters
		const urlParams = new URLSearchParams(window.location.search);
		const tokenParam = urlParams.get('token');
		if (tokenParam) {
			setResetToken(tokenParam);
		} else {
			setErrorMessage("Token is missing. Please try again.");
		}
	}, []);

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

		if (formData.password.length === 0) {
			return;
		}

		const url = `${API_ENDPOINT}/auth/reset-password`;
		const options = {
			// The method is POST because we are sending data.
			method: 'POST',
			// Tell the server we're sending JSON.
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				password: formData.password.trim(),
				token: resetToken
			})
		}

		setIsLoading(true);

		const response = await fetch(url, options)

		let result = null;
		try {
			result = await response.json();
		} catch (error) {
			console.error("Failed to parse response body as JSON:", error);
			result = null;
		}

		setIsLoading(false);

		if (response.status === 200) {
			setSuccessMessage("Password successfully reset. Forwarding you to the login page.")
			setTimeout(() => {
				router.push('/');
			}, 5000);

		} else if (response.status === 422) {
			// TODO: not sure how this code is generated? docs don't define it
			setErrorMessage(result?.message || result?.detail || "Unknown validation error");

		} else if (response.status === 400) {

			if (result?.detail === 'RESET_PASSWORD_BAD_TOKEN') {
				// When the token is expired, invalid, or missing
				setErrorMessage("Your reset link has expired. Forwarding you to the forgot password page.")
				setTimeout(() => {
					router.push('/forgot');
				}, 5000);

			} else if (result?.detail?.code === 'RESET_PASSWORD_INVALID_PASSWORD') {
				// When the password doesn't meet the requirements
				setErrorMessage(result.detail.reason || "Invalid password provided.");
			} else {
				// Generic error handling for other 400 cases
				let error = result?.message || result?.detail;
				if (error) {
					setErrorMessage(error);
				} else {
					setErrorMessage("Reset failed for an unknown reason");
				}
			}

		} else {
			setErrorMessage("Reset failed for an unknown reason");
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
					<h1 className="text-3xl font-normal text-content mb-8">Reset Password</h1>

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
						<p className="text-muted text-sm">
							Please enter your new password below.
						</p>
					</Box>

					<form onSubmit={submitForm}>
						{/* Password Input */}
						<Box className="mb-6">
							<TextField
								id="password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								placeholder="New Password*"
								value={formData.password}
								onChange={handleInput}
								fullWidth
								error={formData.password.length === 0 && dirty}
								InputProps={{
									endAdornment: (
										<InputAdornment position="end">
											<IconButton
												onClick={() => setShowPassword(!showPassword)}
												edge="end"
												sx={{ color: 'var(--muted)' }}
											>
												{showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
											</IconButton>
										</InputAdornment>
									),
								}}
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

						{/* Reset Password Button */}
						<button
							type="submit"
							disabled={isLoading}
							className="w-full py-3 rounded-lg font-medium transition-all mb-6"
							style={{
								background: 'linear-gradient(to right, #e9d5ff, #ddd6fe)',
								color: '#1f2937',
							}}
						>
							{isLoading ? <CircularProgress size={20} sx={{ color: '#1f2937' }} /> : 'Reset Password'}
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
			</Box>

      { /*  extra spacing */ }
      <Box className="py-10 flex justify-center">
        {/*  placeholder for additional content */}
      </Box>
		</Box>
	);
}
