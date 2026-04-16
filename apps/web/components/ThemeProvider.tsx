'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

type Theme = 'dark' | 'light';

export interface ThemeToggleOptions {
    originX?: number;
    originY?: number;
    source?: 'pointer' | 'programmatic';
}

interface ThemeContextType {
    theme: Theme;
    toggleTheme: (options?: ThemeToggleOptions) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'dark',
    toggleTheme: () => { },
});

const DEFAULT_LIGHT_OVERLAY = '#f8fafc';
const DEFAULT_DARK_OVERLAY = '#111827';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Always start with 'dark' to match the SSR output and avoid hydration mismatches.
    // After hydration, a one-time effect reads the class that the inline <head> script
    // already applied correctly (from localStorage / prefers-color-scheme) and syncs
    // React state to it — so toggles and reloads always agree.
    const [theme, setTheme] = useState<Theme>('dark');
    const isTransitioningRef = useRef(false);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const timelineRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);

    useEffect(() => {
        // On first mount (after hydration), read the true resolved theme from the DOM.
        const resolved = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        setTheme(resolved);
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    const getCssVar = (name: string, fallback: string) => {
        if (typeof window === 'undefined') {
            return fallback;
        }

        const value = getComputedStyle(document.documentElement).getPropertyValue(name);
        return value.trim() || fallback;
    };

    const getOverlayColor = (nextTheme: Theme) => {
        return nextTheme === 'dark'
            ? getCssVar('--theme-overlay-dark', DEFAULT_DARK_OVERLAY)
            : getCssVar('--theme-overlay-light', DEFAULT_LIGHT_OVERLAY);
    };

    const cleanupActiveSweep = () => {
        timelineRef.current?.kill();
        timelineRef.current = null;
        if (overlayRef.current) {
            overlayRef.current.remove();
            overlayRef.current = null;
        }
        isTransitioningRef.current = false;
    };

    const createOverlay = (nextTheme: Theme, x: number, y: number) => {
        cleanupActiveSweep();

        const overlay = document.createElement('div');
        overlay.className = 'theme-sweep-overlay';
        overlay.style.setProperty('--theme-sweep-x', `${x}px`);
        overlay.style.setProperty('--theme-sweep-y', `${y}px`);
        overlay.style.setProperty('--theme-sweep-overlay-bg', getOverlayColor(nextTheme));
        overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
        overlay.style.opacity = '1';
        document.body.appendChild(overlay);
        overlayRef.current = overlay;
        return overlay;
    };

    const prefersReducedMotion = () => {
        return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    };

    const animateThemeSweep = (nextTheme: Theme, options?: ThemeToggleOptions) => {
        if (typeof window === 'undefined') {
            setTheme(nextTheme);
            return;
        }

        const originX = options?.originX ?? window.innerWidth / 2;
        const originY = options?.originY ?? window.innerHeight / 2;
        const overlay = createOverlay(nextTheme, originX, originY);
        const maxRadius = Math.hypot(
            Math.max(originX, window.innerWidth - originX),
            Math.max(originY, window.innerHeight - originY)
        );

        const timeline = gsap.timeline({
            defaults: { ease: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
            onComplete: () => {
                cleanupActiveSweep();
            },
        });

        timelineRef.current = timeline;

        timeline
            .to(overlay, {
                clipPath: `circle(${maxRadius}px at ${originX}px ${originY}px)`,
                duration: 0.35,
            })
            .call(() => setTheme(nextTheme))
            .to(overlay, {
                opacity: 0,
                duration: 0.12,
                ease: 'power1.in',
            });
    };

    const toggleTheme = (options?: ThemeToggleOptions) => {
        if (isTransitioningRef.current) {
            return;
        }

        const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

        if (typeof window !== 'undefined' && !prefersReducedMotion()) {
            isTransitioningRef.current = true;
            animateThemeSweep(nextTheme, options);
        } else {
            setTheme(nextTheme);
        }
    };

    useEffect(() => {
        return () => {
            cleanupActiveSweep();
        };
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
