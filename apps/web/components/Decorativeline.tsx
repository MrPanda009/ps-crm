"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useTheme } from "@/components/ThemeProvider"; // Update this path

export interface DecorativeLineTheme {
  light: { bg: string };
  dark: { bg: string };
}

export interface DecorativeLineProps {
  themeColors?: DecorativeLineTheme;
  width?: string;
  height?: string;
  animationDelay?: number;
  className?: string;
}

const defaultTheme: DecorativeLineTheme = {
  light: { bg: "#4a3c31" },
  dark: { bg: "#e9ddce" },
};

export default function DecorativeLine({
  themeColors = defaultTheme,
  width = "w-12",
  height = "h-[2px]",
  animationDelay = 0.4,
  className = "",
}: DecorativeLineProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useGSAP(() => {
    gsap.fromTo(
      elRef.current,
      { scaleX: 0, transformOrigin: "left" },
      { scaleX: 1, duration: 0.8, delay: animationDelay, ease: "power3.out" }
    );
  }, [animationDelay]);

  const currentTheme = theme === "dark" ? themeColors.dark : themeColors.light;

  return (
    <div
      ref={elRef}
      className={`${width} ${height} transition-colors duration-500 ${className}`}
      style={{ backgroundColor: currentTheme.bg }}
    />
  );
}