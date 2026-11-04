'use client'

import './page.css';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';
import { useAuth } from '@/app/hooks/useAuth';

import { MuiOtpInput } from 'mui-one-time-password-input';

import Header from '@/app/components/header';
import { Box, Card, CardContent } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

import { isValidEmail } from '@/app/shared/utils';

export default function Invite() {
	const router = useRouter();
	const [user, setUser] = useAuth();
	const [errorMessage, setErrorMessage] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [createNew, setCreateNew] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
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

		const email = formData.email.trim()

		if (!isValidEmail(email)) {
			setErrorMessage("Email address is invalid");
			return;
		}

		const url = `${API_ENDPOINT}/invites`;

		setIsLoading(true);

		try {
			const response = await userService.makeAuthenticatedRequest(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					email: email
				})
			});

			setIsLoading(false);

			if (response && response.ok) {
				const result = await response.json();
				// Assuming a successful response contains an ID
				if (result.id) {
					setSuccessMessage(`Invite sent successfully to ${formData.email}`);
				} else {
					setErrorMessage("Unexpected response, please try again later.");
				}
			} else if (response) {
				const result = await response.json();
				// Handle different error cases
				let error = result.message || result.detail || "Failed to send invitation, please try again later";
				setErrorMessage(error);
			}
		} catch (error) {
			setIsLoading(false);
			setErrorMessage("An error occurred. Please try again later.");
		}
	}

	return (
		<>
			<Header isLogin={false} user={user} main={true} />
			<main className="page">
				<section className="page__projects welcome-page ">
					<div className="welcome-page__container">
						<div className="welcome-page__body max-w-[350px] flex flex-col items-center">
							{user &&
								<h2 className="welcome-page__title title">Hola! <span>{user.name}</span></h2>
							}
							{
								successMessage.length > 0
								&&
								<div className="text-green-500 items-center justify-center" role="alert">
									<CheckBoxIcon className="pr-2" /> <span>{successMessage}</span>
								</div>
							}
							{
								errorMessage.length > 0
								&&
								<div className="text-red-500 items-center justify-center flex w-full" role="alert">
									<p>{errorMessage}</p>
								</div>
							}
							<div className="welcome-page__text text py-5 w-full">
								<p>Please enter the email of the person , you would like to invite to the platform, they will receive an email with the code to verify the account</p>
							</div>
							<form className="flex flex-col gap-10" onSubmit={submitForm}>
								<div className="w-full">
									<input autoComplete="off" type="text" id="name" name="email" data-error="Error" placeholder="Email" value={formData.email} className={`popup__name-input input ${formData.email.length === 0 && dirty ? "_form-error" : ""}`} onChange={handleInput} />
								</div>
								<button className="welcome-page__button">Invite</button>
								{
									isLoading &&
									<div
										className="mx-2 h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
										role="status">
										<span
											className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
										>Loading...</span
										>
									</div>
								}
							</form>
						</div>
					</div>
				</section>
			</main>
		</>
	);
}
