'use client';

import { Box } from '@mui/material';
import { useRouter } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const router = useRouter();

  return (
    <Box className="flex items-center gap-2 text-sm text-muted py-4 border-b border-border">
      {items.map((item, index) => (
        <Box key={index} className="flex items-center gap-2">
          {item.path ? (
            <button
              onClick={() => router.push(item.path!)}
              className="hover:text-content transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className={index === items.length - 1 ? 'text-content' : ''}>
              {item.label}
            </span>
          )}
          {index < items.length - 1 && (
            <span className="text-faint">/</span>
          )}
        </Box>
      ))}
    </Box>
  );
}

