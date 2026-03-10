'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useTheme } from './ThemeProvider';

if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const timelineEntries = [
    {
        title: 'Assigned to Public Works',
        subtitle: 'for Investigation',
        time: '2 minutes ago',
        active: true,
    },
    {
        title: 'Near Public Works - Processing',
        subtitle: '',
        time: '5 minutes ago',
        active: false,
    },
    {
        title: 'Annex Public Works - Processing',
        subtitle: '',
        time: '10 minutes ago',
        active: false,
    },
    {
        title: 'Assigned for Maximization',
        subtitle: '',
        time: '3 minutes ago',
        active: false,
    },
];

export default function PhoneMockup() {
    const phoneRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    useGSAP(() => {
        if (!phoneRef.current) return;
        gsap.fromTo(
            phoneRef.current,
            { y: 60, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: phoneRef.current,
                    start: 'top 85%',
                    toggleActions: 'play none none none',
                },
            }
        );
    }, []);

    /* ── colour tokens ───────────────────────────────────────── */
    const c = isDark
        ? {
            // Phone frame
            frameBorder: '#3a3228',
            frameBg: '#1e1810',
            // Screen
            screenBg: '#170f0a',
            // Notch
            notchFill: '#1e1810',
            cameraBg: '#2a221c',
            cameraRing: '#3a3228',
            // Text
            labelText: '#9e8e7a',
            primaryText: '#e9ddce',
            subtitleText: '#7a6b5a',
            timeText: '#5a4e40',
            // Controls
            progressTrack: '#2a221c',
            chipBg: '#2a221c',
            chipText: '#c8b99e',
            divider: '#2a221c',
            // Timeline
            timelineLine: '#3a3228',
            dotInactiveBorder: '#5a4e40',
            dotInactiveBg: '#1e1810',
            // Button
            buttonBg: '#2a221c',
            buttonHoverBg: '#3a3228',
            buttonText: '#e9ddce',
            // Shadow
            frameShadow: 'shadow-2xl shadow-black/50',
        }
        : {
            // Phone frame
            frameBorder: '#c4b59e',
            frameBg: '#f5ede0',
            // Screen
            screenBg: '#efe6d6',
            // Notch
            notchFill: '#f5ede0',
            cameraBg: '#ddd1c0',
            cameraRing: '#c4b59e',
            // Text
            labelText: '#7a6b5a',
            primaryText: '#4a3c31',
            subtitleText: '#8a7b68',
            timeText: '#a09280',
            // Controls
            progressTrack: '#ddd1c0',
            chipBg: '#ddd1c0',
            chipText: '#5a4e40',
            divider: '#d0c4b0',
            // Timeline
            timelineLine: '#c4b59e',
            dotInactiveBorder: '#a09280',
            dotInactiveBg: '#f5ede0',
            // Button
            buttonBg: '#ddd1c0',
            buttonHoverBg: '#d0c4b0',
            buttonText: '#4a3c31',
            // Shadow
            frameShadow: 'shadow-2xl shadow-black/15',
        };

    return (
        <div ref={phoneRef} className="relative mx-auto w-[280px] sm:w-[300px]">
            {/* Phone frame */}
            <div
                className={`rounded-[2.5rem] border p-3 transition-colors duration-500 ${c.frameShadow}`}
                style={{ borderColor: c.frameBorder, backgroundColor: c.frameBg }}
            >
                {/* Screen */}
                <div
                    className="relative overflow-hidden rounded-[2rem] px-4 py-5 transition-colors duration-500"
                    style={{ backgroundColor: c.screenBg }}
                >
                    {/* iPhone X Notch */}
                    <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2">
                        <div className="relative h-[22px] w-[120px]">
                            <svg viewBox="0 0 120 22" className="h-full w-full" fill={c.notchFill}>
                                <path d="M0,0 H120 V0 H120 C120,0 112,0 108,4 C104,8 102,14 96,18 C90,22 84,22 60,22 C36,22 30,22 24,18 C18,14 16,8 12,4 C8,0 0,0 0,0 Z" />
                            </svg>
                            {/* Camera dot */}
                            <div
                                className="absolute top-[6px] left-1/2 h-[6px] w-[6px] -translate-x-1/2 rounded-full ring-1 transition-colors duration-500"
                                style={{ backgroundColor: c.cameraBg, '--tw-ring-color': c.cameraRing } as React.CSSProperties}
                            />
                        </div>
                    </div>
                    {/* Complaint header */}
                    <div className="mb-4">
                        <p
                            className="text-[10px] tracking-wider uppercase transition-colors duration-500"
                            style={{ color: c.labelText }}
                        >
                            Complaint No: PS-12345
                        </p>

                        {/* Progress bar */}
                        <div className="mt-2.5">
                            <p className="mb-1 text-[10px] transition-colors duration-500" style={{ color: c.labelText }}>
                                Progress
                            </p>
                            <div
                                className="h-1.5 w-full overflow-hidden rounded-full transition-colors duration-500"
                                style={{ backgroundColor: c.progressTrack }}
                            >
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
                                    style={{ width: '65%' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Chips row */}
                    <div className="mb-4 flex gap-2">
                        <span
                            className="rounded-full px-3 py-0.5 text-[9px] transition-colors duration-500"
                            style={{ backgroundColor: c.chipBg, color: c.chipText }}
                        >
                            Open
                        </span>
                        <span
                            className="rounded-full px-3 py-0.5 text-[9px] transition-colors duration-500"
                            style={{ backgroundColor: c.chipBg, color: c.chipText }}
                        >
                            Routing
                        </span>
                    </div>

                    {/* Status */}
                    <div className="mb-5">
                        <p className="text-[10px] transition-colors duration-500" style={{ color: c.labelText }}>
                            Status
                        </p>
                        <p className="mt-0.5 text-[11px] transition-colors duration-500" style={{ color: c.primaryText }}>
                            Assigned to Public Works – Processing
                        </p>
                    </div>

                    {/* Divider */}
                    <div
                        className="mb-4 h-px transition-colors duration-500"
                        style={{ backgroundColor: c.divider }}
                    />

                    {/* Timeline */}
                    <div>
                        <p className="mb-3 text-xs font-medium transition-colors duration-500" style={{ color: c.primaryText }}>
                            Timeline
                        </p>

                        <div className="relative space-y-4 pl-5">
                            {/* Vertical line */}
                            <div
                                className="absolute top-1 bottom-1 left-[5px] w-px transition-colors duration-500"
                                style={{ backgroundColor: c.timelineLine }}
                            />

                            {timelineEntries.map((entry, i) => (
                                <div key={i} className="relative">
                                    {/* Dot */}
                                    <div
                                        className={`absolute -left-5 top-[3px] h-2.5 w-2.5 rounded-full border-2 transition-colors duration-500 ${entry.active ? 'border-amber-500 bg-amber-500' : ''
                                            }`}
                                        style={
                                            !entry.active
                                                ? { borderColor: c.dotInactiveBorder, backgroundColor: c.dotInactiveBg }
                                                : undefined
                                        }
                                    />
                                    <p className="text-[11px] leading-tight transition-colors duration-500" style={{ color: c.primaryText }}>
                                        {entry.title}
                                    </p>
                                    {entry.subtitle && (
                                        <p className="text-[10px] transition-colors duration-500" style={{ color: c.subtitleText }}>
                                            {entry.subtitle}
                                        </p>
                                    )}
                                    <p className="mt-0.5 text-[9px] transition-colors duration-500" style={{ color: c.timeText }}>
                                        {entry.time}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* View Details button */}
                    <button
                        className="mt-5 w-full rounded-xl py-2.5 text-xs font-medium transition-colors duration-300"
                        style={{ backgroundColor: c.buttonBg, color: c.buttonText }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.buttonHoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.buttonBg)}
                    >
                        View Details
                    </button>
                </div>
            </div>
        </div>
    );
}
