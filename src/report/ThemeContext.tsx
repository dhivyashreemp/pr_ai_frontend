import { createContext, useContext, useState, ReactNode } from 'react';

export type ThemeName = 'default' | 'slate' | 'warm';

export interface Theme {
  name: ThemeName;
  label: string;
  primary: string;
  accent: string;
  statusColors: {
    added: string;
    deleted: string;
    modified: string;
    repositioned: string;
  };
}

const themes: Record<ThemeName, Theme> = {
  default: {
    name: 'default',
    label: 'Default',
    primary: '#D71500',
    accent: '#a61000',
    statusColors: { added: '#15803d', deleted: '#de2626', modified: '#2563eb', repositioned: '#f5a30a' },
  },
  slate: {
    name: 'slate',
    label: 'Slate',
    primary: '#334155',
    accent: '#3b82f6',
    statusColors: { added: '#16a34a', deleted: '#dc2626', modified: '#2563eb', repositioned: '#f59e0b' },
  },
  warm: {
    name: 'warm',
    label: 'Warm',
    primary: '#78350f',
    accent: '#f97316',
    statusColors: { added: '#15803d', deleted: '#b91c1c', modified: '#9a3412', repositioned: '#ea580c' },
  },
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('default');
  return (
    <ThemeContext.Provider value={{ theme: themes[currentTheme], setTheme: setCurrentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
