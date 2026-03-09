"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useTheme } from "@/components/ThemeProvider"; // Update this path

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

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
  animateOnScroll?: boolean; // if true, trigger animation when scrolled into view
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
  animateOnScroll = false,
}: AnimatedTextProps) {
  const elRef = useRef<HTMLElement>(null);
  const { theme } = useTheme();

  useGSAP(() => {
    if (!elRef.current) return;
    const fromVars: any = { y: 30, opacity: 0 };
    const toVars: any = { y: 0, opacity: 1, duration: 0.8, delay: animationDelay, ease: "power3.out" };
    if (animateOnScroll) {
      toVars.scrollTrigger = {
        trigger: elRef.current,
        start: "top 85%",
        toggleActions: "play none none none",
      };
    }
    gsap.fromTo(elRef.current, fromVars, toVars);
  }, [animationDelay, animateOnScroll]);

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