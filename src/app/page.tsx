'use client';

import './page.css';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/hooks/useAuth';

export default function Home() {
  const [user] = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Since profile page is now the dashboard, redirect there
    // Note: The root "/" will be replaced with actual dashboard content
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  return null;
}
