'use client';

import { useState, type MouseEvent } from 'react';
import { useTheme } from './ThemeProvider';
import Link from 'next/link';


function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  );
}

export default function LandNavbar() {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const bg = isDark ? 'bg-gray-950/90 border-white/10' : 'bg-white/90 border-black/10';
  const text = isDark ? 'text-white' : 'text-gray-800';
  const sub = isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-emerald-600';
  const drawerBg = isDark ? 'bg-gray-900' : 'bg-white';
  const divider = isDark ? 'divide-white/10' : 'divide-black/10';
  const hoverRow = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50';

  const handleToggleTheme = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    toggleTheme({
      originX: rect.left + rect.width / 2,
      originY: rect.top + rect.height / 2,
      source: 'pointer',
    });
  };

  return (
    <>
      {/* ── Fixed top bar ── */}
      <header className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md ${bg}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <a href="#" className="text-lg sm:text-xl font-bold tracking-tight shrink-0">
            <span className={text}>Leaf</span>
            <span className="text-emerald-400">line</span>
          </a>


          {/* Desktop right actions — md and up */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme toggle */}
            <button onClick={handleToggleTheme} aria-label="Toggle theme"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium border transition-all ${isDark
                ? 'border-white/20 text-yellow-300 bg-white/5 hover:bg-white/10'
                : 'border-black/10 text-gray-600 bg-black/5 hover:bg-black/10'
                }`}>
              {isDark ? <><SunIcon /><span>Light</span></> : <><MoonIcon /><span>Dark</span></>}
            </button>

            <Link href="/login"
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors">
              Sign in
            </Link>
            <Link href="/map" className={`text-sm font-semibold transition-colors ${sub}`}>
              Log in →
            </Link>
          </div>

          {/* Mobile right — theme icon + hamburger */}
          <div className="flex items-center gap-1 md:hidden">
            <button onClick={handleToggleTheme} aria-label="Toggle theme"
              className={`rounded-full p-2 transition-colors ${isDark ? 'text-yellow-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'
                }`}>
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={() => setOpen(true)} aria-label="Open menu"
              className={`rounded-md p-2 transition-colors ${isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-black/5'
                }`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {open && (
        <div className="fixed inset-0 z-[9998] md:hidden">
          {/* Scrim */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Slide-in panel */}
          <div className={`absolute inset-y-0 right-0 w-4/5 max-w-xs shadow-xl flex flex-col ${drawerBg}`}>
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-inherit">
              <span className="text-lg font-bold tracking-tight">
                <span className={text}>Leaf</span>
                <span className="text-emerald-400">line</span>
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close menu"
                className={`rounded-md p-2 transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-black/5'
                  }`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Auth & theme */}
            <nav className={`flex-1 overflow-y-auto px-4 py-4`}>
              <div className="space-y-2">
                <Link href="/login"
                  className="block rounded-lg bg-emerald-500 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-400 transition-colors">
                  Sign in
                </Link>
                <Link href="/map"
                  className={`block rounded-lg px-3 py-2.5 text-sm font-semibold text-center transition-colors ${text} ${hoverRow}`}>
                  Log in
                </Link>
                <button onClick={handleToggleTheme}
                  className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium border transition-colors ${isDark
                    ? 'border-white/20 text-yellow-300 bg-white/5 hover:bg-white/10'
                    : 'border-black/10 text-gray-600 bg-black/5 hover:bg-black/10'
                    }`}>
                  {isDark ? <><SunIcon /><span>Switch to Light</span></> : <><MoonIcon /><span>Switch to Dark</span></>}
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
