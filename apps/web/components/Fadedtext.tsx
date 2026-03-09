"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useTheme } from "@/components/ThemeProvider"; // Update this path

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export interface FadedTheme {
  light: { text: string };
  dark: { text: string };
}

export interface FadedTextProps {
  text: string;
  themeColors?: FadedTheme;
  animationDelay?: number;
  className?: string;
  animateOnScroll?: boolean;
}

const defaultTheme: FadedTheme = {
  light: { text: "#8e857c" },
  dark: { text: "#ddd1c0" },
};

export default function FadedText({
  text,
  themeColors = defaultTheme,
  animationDelay = 0,
  className = "",
  animateOnScroll = false,
}: FadedTextProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useGSAP(() => {
    if (!elRef.current) return;
    const from: any = { y: 30, opacity: 0 };
    const to: any = { y: 0, opacity: 0.3, duration: 0.8, delay: animationDelay, ease: "power3.out" };
    if (animateOnScroll) {
      to.scrollTrigger = {
        trigger: elRef.current,
        start: "top 90%",
        toggleActions: "play none none none",
      };
    }
    gsap.fromTo(elRef.current, from, to);
  }, [animationDelay, animateOnScroll]);

  const currentTheme = theme === "dark" ? themeColors.dark : themeColors.light;

  return (
    <div
      ref={elRef}
      className={`font-bold select-none blur-[2px] transition-colors duration-500 pointer-events-none ${className}`}
      style={{ color: currentTheme.text }}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}