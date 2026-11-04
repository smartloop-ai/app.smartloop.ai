'use client';

/**
 * Layout primitives for Settings.
 *
 * Settings used to be cards nested inside cards, which put three borders
 * between the page and a text input. These render flat: a section is a title
 * plus rows, and rows are separated by hairlines rather than boxes. Each row
 * puts its label and description on the left and its control on the right,
 * stacking on narrow screens.
 */

import { Box } from '@mui/material';
import type { ReactNode } from 'react';

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Box component="section">
      <Box className="mb-1">
        <h2 className="text-base md:text-lg font-semibold text-content tracking-tight">{title}</h2>
      </Box>
      {description && (
        <p className="text-sm text-muted leading-relaxed mb-5 max-w-2xl">{description}</p>
      )}
      <Box className="divide-y divide-border">{children}</Box>
    </Box>
  );
}

export function Row({
  label,
  description,
  children,
  /** Stack the control under the label — for wide controls like a key field. */
  stacked = false,
}: {
  label?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <Box className="py-5 first:pt-0">
        {label && <div className="text-sm font-medium text-content mb-1">{label}</div>}
        {description && <div className="text-xs text-faint leading-relaxed mb-3">{description}</div>}
        {children}
      </Box>
    );
  }

  return (
    <Box className="py-5 first:pt-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
      <Box className="min-w-0 sm:flex-1">
        {label && <div className="text-sm font-medium text-content">{label}</div>}
        {description && <div className="text-xs text-faint leading-relaxed mt-1">{description}</div>}
      </Box>
      {children && <Box className="w-full sm:w-auto shrink-0">{children}</Box>}
    </Box>
  );
}

/** A copyable shell snippet — used to let people verify a key by hand. */
export function CodeBlock({ code, onCopy, copied }: { code: string; onCopy: () => void; copied: boolean }) {
  return (
    <Box className="relative rounded-lg border border-border bg-surface-2 overflow-hidden">
      <pre className="overflow-x-auto p-3 pr-20 text-xs leading-relaxed text-muted font-mono whitespace-pre">
        {code}
      </pre>
      <button
        onClick={onCopy}
        className="absolute top-2 right-2 px-2.5 py-1 rounded-md text-xs border border-border-2 bg-surface text-muted hover:text-content hover:bg-surface-2 transition-colors"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </Box>
  );
}
