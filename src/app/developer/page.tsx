'use client';

/**
 * Developer tokens moved under Settings. This redirect keeps older bookmarks
 * and docs links working.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/app/components/loading-spinner';

export default function DeveloperRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings/tokens'); }, [router]);
  return <LoadingSpinner />;
}
