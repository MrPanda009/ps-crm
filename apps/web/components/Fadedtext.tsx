"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useTheme } from "@/components/ThemeProvider"; // Update this path

export interface FadedTheme {
  light: { text: string };
  dark: { text: string };
}

export interface FadedTextProps {
  text: string;
  themeColors?: FadedTheme;
  animationDelay?: number;
  className?: string;
}

const defaultTheme: FadedTheme = {
  light: { text: "#b8ada1" },
  dark: { text: "#2a221c" },
};

export default function FadedText({
  text,
  themeColors = defaultTheme,
  animationDelay = 0,
  className = "",
}: FadedTextProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useGSAP(() => {
    gsap.fromTo(
      elRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 0.3, duration: 0.8, delay: animationDelay, ease: "power3.out" }
    );
  }, [animationDelay]);

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