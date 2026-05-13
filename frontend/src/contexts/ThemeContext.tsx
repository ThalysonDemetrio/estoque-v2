"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  const applyTheme = (nextTheme: Theme) => {
    const isDark = nextTheme === 'dark';
    const root = document.documentElement;
    const body = document.body;

    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', nextTheme);
    root.style.colorScheme = nextTheme;

    body.classList.toggle('dark', isDark);
    body.setAttribute('data-theme', nextTheme);
    body.style.colorScheme = nextTheme;
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme: Theme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : systemTheme;
    
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []); // Run only once on mount

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
