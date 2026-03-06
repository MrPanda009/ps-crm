"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useTheme } from "@/components/ThemeProvider"; // Update this path

export interface AnimatedTextTheme {
  light: { text: string };
  dark: { text: string };
}

export interface AnimatedTextProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div";
  themeColors?: AnimatedTextTheme;
  animationDelay?: number;
  className?: string;
}

// A generic default fallback (you'll likely override this per instance)
const defaultTheme: AnimatedTextTheme = {
  light: { text: "#4a3c31" },
  dark: { text: "#e9ddce" },
};

export default function AnimatedText({
  text,
  as: Tag = "p", // Defaults to a paragraph tag if not specified
  themeColors = defaultTheme,
  animationDelay = 0.2,
  className = "",
}: AnimatedTextProps) {
  const elRef = useRef<HTMLElement>(null);
  const { theme } = useTheme();

  useGSAP(() => {
    gsap.fromTo(
      elRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, delay: animationDelay, ease: "power3.out" }
    );
  }, [animationDelay]);

  const currentTheme = theme === "dark" ? themeColors.dark : themeColors.light;

  return (
    <Tag
      ref={elRef as any}
      className={`transition-colors duration-500 ${className}`}
      style={{ color: currentTheme.text }}
    >
      {text}
    </Tag>
  );
}