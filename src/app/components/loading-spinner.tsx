import { CircularProgress } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  showLogo?: boolean;
  size?: number;
}

export default function LoadingSpinner({ message, showLogo = false, size = 24 }: LoadingSpinnerProps) {
  if (showLogo) {
    return (
      <main className="min-h-screen w-full bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-end">
            <span className="text-4xl font-bold text-content tracking-tight">smartloop</span>
            <span className="text-4xl font-bold text-pink-500 leading-none">.</span>
          </div>
          <div className="flex flex-col items-center gap-10 text-content">
            <CircularProgress sx={{ color: '#ec4899' }} size={size} />
            {message && <p className="text-sm text-muted">{message}</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen">
      <CircularProgress size={size} />
    </div>
  );
}
