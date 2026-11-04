'use client'

import './page.css';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT } from '@/app/constants';
import { useAuth } from '@/app/hooks/useAuth';

import { Box, CircularProgress } from '@mui/material';
import LoadingSpinner from '../components/loading-spinner';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import LockIcon from '@mui/icons-material/Lock';
import AuthHeader from '../components/auth-header';

// Content component that uses searchParams
function InviteVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Extract mode parameter for native app integration
  const mode = searchParams.get('mode');

  useEffect(() => {
    // Check if user is already accepted/premium/paid
    if (user && (user.is_accepted || user.is_premium || user.is_paid)) {
      // Redirect to appropriate page
      if (mode === 'native') {
        const token = userService.token();
        router.push(`/redirect?token=${token}&mode=native`);
      } else {
        router.push('/');
      }
    }
  }, [user, mode, router]);

  const requestInvite = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    const url = `${API_ENDPOINT}/invites/request`;

    try {
      const response = await userService.makeAuthenticatedRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: user.email })
      });

      setIsLoading(false);

      if (response && response.ok) {
        setSuccessMessage("Invite request submitted successfully! We'll review your request and get back to you soon.");
        setRequestSent(true);
      } else if (response) {
        const result = await response.json();
        let error = result.message || result.detail || "Failed to submit invite request. Please try again.";
        setErrorMessage(error);
      }
    } catch (error) {
      setIsLoading(false);
      setErrorMessage("An error occurred. Please try again later.");
    }
  }

  const handleLogout = () => {
    userService.logout();
    router.push('/login');
  }

  if (!user) {
    return <LoadingSpinner showLogo message="Loading..." size={48} />;
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
          <div className="flex items-center gap-3 mb-4">
            <LockIcon sx={{ fontSize: 40, color: '#ec4899' }} />
            <h1 className="text-3xl font-normal text-content">Invite Required</h1>
          </div>
          <p className="text-muted mb-8">
            You need an invite to access Smartloop. Request access below and we'll review your application. To get to the top of the wailist, please drop a line at <a href="mailto:support@smartloop.ai" target="_blank" rel="noopener noreferrer" className="text-pink-500 underline">support@smartloop.ai</a>.
          </p>

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

          {user && (
            <Box className="mb-6 p-4 bg-surface-2 bg-opacity-50 rounded-lg">
              <p className="text-muted text-sm">
                <span className="font-semibold">Account:</span> {user.email}
              </p>
            </Box>
          )}

          {!requestSent ? (
            <>
              {/* Request Button */}
              <button
                onClick={requestInvite}
                disabled={isLoading}
                className="w-full py-3 rounded-lg font-medium transition-all mb-4"
                style={{
                  background: 'linear-gradient(to right, #e9d5ff, #ddd6fe)',
                  color: '#1f2937',
                }}
              >
                {isLoading ? <CircularProgress size={20} sx={{ color: '#1f2937' }} /> : 'Request Invite'}
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full py-3 rounded-lg font-medium transition-all border border-border-2 text-muted hover:bg-surface-2"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-lg font-medium transition-all"
              style={{
                background: 'linear-gradient(to right, #e9d5ff, #ddd6fe)',
                color: '#1f2937',
              }}
            >
              Back to Login
            </button>
          )}
        </Box>
      </Box>
      { /*  extra spacing */ }
      <Box className="py-10 flex justify-center">
        {/*  placeholder for additional content */}
      </Box>
    </Box>
  );
}

// Wrap with Suspense
export default function InviteVerify() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <InviteVerifyContent />
    </Suspense>
  );
}
