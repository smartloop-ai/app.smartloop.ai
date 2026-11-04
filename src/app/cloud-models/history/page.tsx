'use client';

import CloudHistorySection from '@/app/cloud-models/history-section';
import { useCloudUser } from '@/app/cloud-models/user-context';

export default function CloudModelHistory() {
  return <CloudHistorySection user={useCloudUser()} />;
}
