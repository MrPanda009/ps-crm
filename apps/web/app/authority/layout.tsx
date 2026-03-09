'use client'

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart2, Bell, ClipboardList,
  LayoutGrid, LogOut, Menu, ChevronDown, Users,
} from "lucide-react"
import Sidebar, { defaultSidebarConfig } from "@/components/Sidebar"
import { supabase } from "@/src/lib/supabase"
import AuthorityNotificationBell from "@/app/authority/_components/AuthorityNotificationBell"

export default function AuthorityLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCollapsed,   setIsCollapsed]   = useState(false)
  const [profileOpen,   setProfileOpen]   = useState(false)
  const [userName,      setUserName]      = useState("")
  const profileRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router   = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name = data?.user?.user_metadata?.full_name
        ?? data?.user?.email?.split("@")[0]
        ?? "Officer"
      setUserName(name)
    })
  }, [])

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const initials = userName
    .split(" ")
    .map(p => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AU"

  const sidebarConfig = {
    ...defaultSidebarConfig,
    branding: { ...defaultSidebarConfig.branding, title: "Authority" },
    navigation: [
      { id: "dashboard", name: "Dashboard",        icon: <LayoutGrid    size={20} strokeWidth={2} />, href: "/authority",         isActive: pathname === "/authority" },
      { id: "track",     name: "Track Complaints", icon: <ClipboardList size={20} strokeWidth={2} />, href: "/authority/track",   isActive: pathname.startsWith("/authority/track") },
      { id: "workers",   name: "Workers",          icon: <Users         size={20} strokeWidth={2} />, href: "/authority/workers", isActive: pathname.startsWith("/authority/workers") },
      { id: "reports",   name: "Reports",          icon: <BarChart2     size={20} strokeWidth={2} />, href: "/authority/reports", isActive: pathname.startsWith("/authority/reports") },
    ],
    bottomNavigation: defaultSidebarConfig.bottomNavigation,
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">

      <Sidebar
        {...sidebarConfig}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(c => !c)}
      />

      <div className="flex flex-1 min-w-0 flex-col">

        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between
                           border-b border-gray-200 bg-white px-5
                           dark:border-gray-800 dark:bg-gray-950">
          {/* Mobile hamburger */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg
                       bg-[#b4725a] text-white lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb label */}
          <p className="hidden lg:block text-sm font-semibold capitalize text-gray-600 dark:text-gray-400">
            {pathname.split("/").filter(Boolean).slice(-1)[0]?.replace(/-/g, " ") || "Dashboard"}
          </p>

          {/* Right side: Bell + Profile Avatar */}
          <div className="flex items-center gap-2">
            <AuthorityNotificationBell />

            {/* Profile Avatar Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(o => !o)}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white pl-1 pr-2 py-1 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                aria-label="Profile menu"
              >
                {/* Avatar circle */}
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#b4725a] text-[11px] font-bold text-white">
                  {initials}
                </div>
                <ChevronDown size={13} className="text-gray-500 dark:text-gray-400" />
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                  {/* User info */}
                  <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{userName}</p>
                    <p className="text-[11px] text-gray-400">Authority Officer</p>
                  </div>
                  {/* Logout */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          {children}
        </main>

      </div>
    </div>
  )
}
