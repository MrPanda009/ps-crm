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
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [userName, setUserName] = useState("")
  const profileRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

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
    branding: {
      ...defaultSidebarConfig.branding,
      title: "Authority",
      icon: (
        <div
          className="w-10 h-10 lg:w-[42px] lg:h-[42px] bg-[#C9A84C]"
          style={{
            WebkitMaskImage: 'url(/Emblem.svg)',
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskImage: 'url(/Emblem.svg)',
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
          }}
        />
      ),
    },
    navigation: [
      { id: "dashboard", name: "Dashboard", icon: <LayoutGrid size={20} strokeWidth={2} />, href: "/authority", isActive: pathname === "/authority" },
      { id: "track", name: "Track Complaints", icon: <ClipboardList size={20} strokeWidth={2} />, href: "/authority/track", isActive: pathname.startsWith("/authority/track") },
      { id: "workers", name: "Workers", icon: <Users size={20} strokeWidth={2} />, href: "/authority/workers", isActive: pathname.startsWith("/authority/workers") },
      { id: "reports", name: "Reports", icon: <BarChart2 size={20} strokeWidth={2} />, href: "/authority/reports", isActive: pathname.startsWith("/authority/reports") },
    ],
    bottomNavigation: defaultSidebarConfig.bottomNavigation,
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-[#161616]">

      <Sidebar
        {...sidebarConfig}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(c => !c)}
      />

      <div className="flex-1 flex flex-col min-h-0 min-w-0 max-w-full overflow-x-hidden">

<header className="sticky top-0 z-[2100] bg-white border-b border-gray-200 shadow-sm dark:border-gray-800 dark:bg-gray-950">
  <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 min-w-0 max-w-full">

    {/* Left side */}
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="lg:hidden p-2 bg-[#b4725a] text-white rounded-md hover:bg-[#9a5f4a] transition-colors flex-shrink-0"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
          {
            pathname === "/authority" ? "Authority" :
            pathname.startsWith("/authority/track") ? "Track Complaints" :
            pathname.startsWith("/authority/workers") ? "Workers" :
            pathname.startsWith("/authority/reports") ? "Reports" :
            pathname.split("/").filter(Boolean).slice(-1)[0]?.replace(/-/g, " ") || "Dashboard"
          }
        </h1>

        <p className="mt-0.5 text-xs sm:text-sm text-gray-400 dark:text-gray-500 line-clamp-1">
          {
            pathname === "/authority"
              ? "Overview of department complaints, performance metrics, and recent activity."
              : pathname.startsWith("/authority/track")
              ? "Monitor and manage complaints across the city through the live complaint map."
              : pathname.startsWith("/authority/workers")
              ? "View and manage department field workers and their availability status."
              : pathname.startsWith("/authority/reports")
              ? "Analyze complaint trends, resolution performance, and SLA compliance."
              : ""
          }
        </p>
      </div>
    </div>

    {/* Right side */}
    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
      <AuthorityNotificationBell />

      <div ref={profileRef} className="relative">
        <button
          type="button"
          onClick={() => setProfileOpen(o => !o)}
          className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white pl-1 pr-2 py-1 shadow-sm hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#b4725a] text-[11px] font-bold text-white">
            {initials}
          </div>
          <ChevronDown size={13} className="text-gray-500 dark:text-gray-400" />
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{userName}</p>
              <p className="text-[11px] text-gray-400">Authority Officer</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        )}
      </div>
    </div>

  </div>
</header>
        <main className="flex-1 min-h-0 min-w-0 max-w-full overflow-x-hidden px-4 sm:px-6 py-6">
          {children}
        </main>

      </div>
    </div>
  )
}
