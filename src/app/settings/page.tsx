'use client';

/** /settings has no content of its own — land on the first section. */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/app/components/loading-spinner';

export default function Settings() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings/websearch'); }, [router]);
  return <LoadingSpinner />;
}
