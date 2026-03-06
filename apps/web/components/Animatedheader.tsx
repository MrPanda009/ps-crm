"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
// lucide icons for social links and theme toggle
import { X, Linkedin, Github } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import ThemeToggle from "./Themetogglebutton";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

// 1. Exported interface containing all colors and configurable elements
export interface HeaderTheme {
  light: {
    bgInitial: string;
    bgScrolled: string;
    textInitial: string;
    textScrolled: string;
  };
  dark: {
    bgInitial: string;
    bgScrolled: string;
    textInitial: string;
    textScrolled: string;
  };
}

export interface HeaderProps {
  logoText?: string;
  avatarSrc?: string;
  navLinks?: { label: string; href: string }[];
  socialLinks?: { id: string; icon: React.ReactNode; href: string }[];
  themeColors?: HeaderTheme;
}

const defaultTheme: HeaderTheme = {
  light: {
    bgInitial: "#e9ddce", // Lighter beige from the design
    bgScrolled: "#4a3c31", // Darker brown
    textInitial: "#4a3c31",
    textScrolled: "#ffffff",
  },
  dark: {
    bgInitial: "#2a221c",
    bgScrolled: "#110e0c",
    textInitial: "#e9ddce",
    textScrolled: "#ffffff",
  },
};

export default function Header({
  logoText = "SHREY.",
  avatarSrc = "/avatar-placeholder.jpg", // Replace with your actual path
  navLinks = [
    { label: "HOME", href: "/" },
    { label: "EVENTS", href: "/events" },
    { label: "BLOGS", href: "/blogs" },
    { label: "ABOUT", href: "/about" },
  ],
  socialLinks = [
    {
      id: "github",
      href: "#",
      icon: <Github className="w-4 h-4" />,
    },
    {
      id: "x",
      href: "#",
      icon: <X className="w-4 h-4" />,
    },
    {
      id: "linkedin",
      href: "#",
      icon: <Linkedin className="w-4 h-4" />,
    },
  ],
  themeColors = defaultTheme,
}: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme } = useTheme();

  const isDarkMode = theme === "dark";
  const currentTheme = isDarkMode ? themeColors.dark : themeColors.light;

  // 2. GSAP Animation for scroll color change
  useGSAP(() => {
    if (!headerRef.current) return;

    // Set initial colors
    gsap.set(headerRef.current, {
      backgroundColor: currentTheme.bgInitial,
      color: currentTheme.textInitial,
    });

    // Create scroll trigger to animate to scrolled colors
    const st = ScrollTrigger.create({
      start: "top -50",
      end: 99999,
      onEnter: () => {
        gsap.to(headerRef.current, {
          backgroundColor: currentTheme.bgScrolled,
          color: currentTheme.textScrolled,
          duration: 0.4,
          ease: "power2.out",
        });
      },
      onLeaveBack: () => {
        gsap.to(headerRef.current, {
          backgroundColor: currentTheme.bgInitial,
          color: currentTheme.textInitial,
          duration: 0.4,
          ease: "power2.out",
        });
      },
    });

    return () => st.kill();
  }, [currentTheme]);

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 w-full z-50 transition-colors duration-300 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        
        {/* Left Side: Avatar, Logo & Socials */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc}
              alt="Avatar"
              className="w-10 h-10 rounded-full object-cover grayscale brightness-90"
            />
            <span className="font-bold text-lg tracking-wider hidden sm:block">
              {logoText}
            </span>
          </div>
          
          <div className="hidden sm:flex items-center gap-4 border-l border-current pl-6 opacity-80">
            {socialLinks.map((social) => (
              <Link
                key={social.id}
                href={social.href}
                className="hover:opacity-60 transition-opacity"
              >
                {social.icon}
              </Link>
            ))}
          </div>
        </div>

        {/* Right Side: Desktop Nav */}
        <nav className="hidden md:flex items-center gap-4 text-sm font-medium tracking-widest uppercase">
          {navLinks.map((link, idx) => (
            <Link
              key={idx}
              href={link.href}
              className="hover:opacity-60 transition-opacity relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-current transition-all duration-300 group-hover:w-full"></span>
            </Link>
          ))}
          {/* theme toggle button for desktop */}
          <div className="scale-75">
            <ThemeToggle />
          </div>
        </nav>

        {/* Mobile Menu Toggle and theme */}
        <div className="md:hidden flex items-center gap-2">
          <div className="scale-75 origin-right">
            <ThemeToggle />
          </div>
          <button
            className="flex flex-col gap-1.5 z-50 p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
          <span className={`block w-6 h-0.5 bg-current transition-transform ${isMobileMenuOpen ? "rotate-45 translate-y-2" : ""}`}></span>
          <span className={`block w-6 h-0.5 bg-current transition-opacity ${isMobileMenuOpen ? "opacity-0" : ""}`}></span>
          <span className={`block w-6 h-0.5 bg-current transition-transform ${isMobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`}></span>
        </button>
      </div>

      {/* Mobile Nav Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden absolute top-full left-0 w-full py-6 px-6 flex flex-col gap-4 shadow-lg border-t border-black/10"
          style={{ backgroundColor: currentTheme.bgScrolled, color: currentTheme.textScrolled }}
        >
          {navLinks.map((link, idx) => (
            <Link
              key={idx}
              href={link.href}
              className="text-sm font-medium tracking-widest uppercase"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-current/20">
             {socialLinks.map((social) => (
              <Link key={social.id} href={social.href}>
                {social.icon}
              </Link>
            ))}
          </div>
        </div>
      )}
      </div>
    </header>
  );
}