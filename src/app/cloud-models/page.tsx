'use client';

/**
 * /cloud-models has no content of its own, so it goes to Usage. The layout is
 * already showing the frame, so there is nothing to render meanwhile.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CloudModels() {
  const router = useRouter();
  useEffect(() => { router.replace('/cloud-models/usage'); }, [router]);
  return null;
}
