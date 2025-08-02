import { create } from 'zustand';

type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

// Check for system preference
const getSystemPreference = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Get the initial theme from localStorage or use system preference
const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
  return savedTheme || 'system';
};

export const useSettings = create<SettingsState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
}));

// Apply theme to document
export const applyTheme = (theme: ThemeMode): void => {
  const root = document.documentElement;
  const effectiveTheme = theme === 'system' ? getSystemPreference() : theme;
  
  if (effectiveTheme === 'dark') {
    root.classList.add('dark-mode');
  } else {
    root.classList.remove('dark-mode');
  }
};