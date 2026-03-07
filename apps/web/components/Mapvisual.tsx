"use client";

import React, { useRef, useState, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export interface MapVisualTheme {
  light: { panelBg: string; dotColor: string };
  dark: { panelBg: string; dotColor: string };
}

export interface MapVisualProps {
  imageSrc: string;
  themeColors?: MapVisualTheme;
  animationDelay?: number;
  className?: string;
}

const defaultTheme: MapVisualTheme = {
  light: { panelBg: "#3b2b24", dotColor: "#aae5df" },
  dark: { panelBg: "#1a1411", dotColor: "#aae5df" },
};

export default function MapVisual({
  imageSrc,
  themeColors = defaultTheme,
  animationDelay = 0.4,
  className = "",
}: MapVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const htmlEl = document.documentElement;
    setIsDark(htmlEl.classList.contains("dark"));
    const observer = new MutationObserver(() => setIsDark(htmlEl.classList.contains("dark")));
    observer.observe(htmlEl, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useGSAP(() => {
    // Entrance Animation
    gsap.fromTo(
      containerRef.current,
      { x: 50, opacity: 0 },
      { x: 0, opacity: 1, duration: 1, delay: animationDelay, ease: "power3.out" }
    );

    // Continuous Orb Animation
    if (dotsRef.current) {
      const dots = dotsRef.current.children;
      Array.from(dots).forEach((dot) => {
        gsap.to(dot, {
          y: "random(-20, 20)",
          x: "random(-20, 20)",
          opacity: "random(0.4, 1)",
          scale: "random(0.8, 1.2)",
          duration: "random(2, 4)",
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    }
  }, [animationDelay]);

  const currentTheme = isDark ? themeColors.dark : themeColors.light;

  const nodePositions = [
    { top: "20%", left: "30%" },
    { top: "40%", left: "60%" },
    { top: "60%", left: "40%" },
    { top: "70%", left: "80%" },
    { top: "30%", left: "85%" },
    { top: "80%", left: "20%" },
    { top: "50%", left: "10%" },
    { top: "10%", left: "-5%", size: "w-3 h-3 blur-md" },
    { top: "80%", left: "-10%", size: "w-4 h-4 blur-sm" },
    { top: "90%", left: "50%", size: "w-2 h-2 blur-sm" },
  ];

  return (
    <div
      ref={containerRef}
      // make the map container fluid on small screens and only constrain it on
      // larger viewports. the previous `max-w-lg` caused the graphic to hang
      // at a fixed size on mobile, breaking the layout. `w-full` ensures it
      // always fills its parent and `max-w-full` removes any hard cap. the
      // `lg:max-w-lg` restores the original desktop constraint.
      className={`relative w-full max-w-full lg:max-w-lg aspect-square lg:aspect-[4/3] rounded-xl shadow-2xl overflow-visible transition-colors duration-500 ${className}`}
      style={{ backgroundColor: currentTheme.panelBg }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt="Map Data Visualization"
        className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-80 mix-blend-luminosity pointer-events-none"
      />

      <div className="absolute inset-0 rounded-xl border border-white/10 pointer-events-none"></div>

      <div ref={dotsRef} className="absolute inset-0 pointer-events-none">
        {nodePositions.map((pos, i) => (
          <div
            key={i}
            className={`absolute rounded-full shadow-[0_0_15px_currentColor] ${
              pos.size || "w-2 h-2 blur-[1px]"
            }`}
            style={{
              top: pos.top,
              left: pos.left,
              backgroundColor: currentTheme.dotColor,
              color: currentTheme.dotColor, 
            }}
          />
        ))}
      </div>
    </div>
  );
}