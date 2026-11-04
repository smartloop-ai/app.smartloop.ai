'use client';

import CloudUsageSection from '@/app/cloud-models/usage-section';
import { useCloudUser } from '@/app/cloud-models/user-context';

export default function CloudModelUsage() {
  return <CloudUsageSection user={useCloudUser()} />;
}
