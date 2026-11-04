'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const applyThemeClass = (mode: ThemeMode) => {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
};

const systemTheme = (): ThemeMode =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to dark; the inline script in layout has already applied the resolved
  // theme to <html> before hydration to avoid a flash.
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as ThemeMode | null;
    const hasOverride = stored === 'light' || stored === 'dark';
    const initial: ThemeMode = hasOverride ? stored : systemTheme();
    setThemeState(initial);
    applyThemeClass(initial);

    // Follow OS changes while the user hasn't set an explicit preference.
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('theme')) return; // explicit choice wins
      const next: ThemeMode = e.matches ? 'light' : 'dark';
      setThemeState(next);
      applyThemeClass(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('theme', mode);
    applyThemeClass(mode);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const muiTheme = useMemo(
    () => createTheme({ palette: { mode: theme } }),
    [theme],
  );

  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
