'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'dark',
    toggleTheme: () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Always start with 'dark' to match the SSR output and avoid hydration mismatches.
    // After hydration, a one-time effect reads the class that the inline <head> script
    // already applied correctly (from localStorage / prefers-color-scheme) and syncs
    // React state to it — so toggles and reloads always agree.
    const [theme, setTheme] = useState<Theme>('dark');

    useEffect(() => {
        // On first mount (after hydration), read the true resolved theme from the DOM.
        const resolved = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        setTheme(resolved);
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => {
            return prev === 'dark' ? 'light' : 'dark';
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
