'use client';

import { useState } from "react";
import {
  ClipboardList,
  FileBarChart2,
  FolderTree,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import Sidebar, { defaultSidebarConfig, SidebarNavigationItem } from "@/components/Sidebar";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const adminNavigation: SidebarNavigationItem[] = [
    { id: "dashboard", name: "Dashboard", icon: <LayoutGrid size={20} strokeWidth={2.5} />, href: "/admin", isActive: pathname === "/admin" },
    { id: "complaints", name: "Complaints", icon: <ClipboardList size={20} strokeWidth={2} />, href: "/admin/complaints", isActive: pathname === "/admin/complaints" },
    { id: "authorities", name: "Authorities", icon: <Shield size={20} strokeWidth={2} />, href: "/admin/authorities", isActive: pathname === "/admin/authorities" },
    { id: "workers", name: "Workers", icon: <Users size={20} strokeWidth={2} />, href: "/admin/workers", isActive: pathname === "/admin/workers" },
    { id: "categories", name: "Categories", icon: <FolderTree size={20} strokeWidth={2} />, href: "/admin/categories", isActive: pathname === "/admin/categories" },
    { id: "reports", name: "Reports", icon: <FileBarChart2 size={20} strokeWidth={2} />, href: "/admin/reports", isActive: pathname === "/admin/reports" },
    { id: "settings", name: "Settings", icon: <Settings size={20} strokeWidth={2} />, href: "/admin/settings", isActive: pathname === "/admin/settings" },
  ];

  const sidebarConfig = {
    ...defaultSidebarConfig,
    branding: {
      ...defaultSidebarConfig.branding,
      title: "Admin",
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
    colors: {
      ...defaultSidebarConfig.colors,
      textMain: "text-white dark:text-white",
    },
    navigation: adminNavigation,
    bottomNavigation: [
      {
        id: "support",
        name: "Support",
        icon: <MessageSquare size={20} strokeWidth={2} />,
        href: "#",
      },
      {
        id: "logout",
        name: "Logout",
        icon: <LogOut size={20} strokeWidth={2} />,
        onClick: handleLogout,
      },
    ],
  };

  // Resolve page title & subtitle based on current route
  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    "/admin": { title: "Admin Dashboard", subtitle: "Operational overview of all complaints and authorities." },
    "/admin/complaints": { title: "Complaints", subtitle: "View and manage all citizen complaints." },
    "/admin/authorities": { title: "Authorities", subtitle: "Manage registered authority accounts." },
    "/admin/workers": { title: "Workers", subtitle: "Manage field workers and assignments." },
    "/admin/categories": { title: "Categories", subtitle: "Configure complaint categories." },
    "/admin/reports": { title: "Reports", subtitle: "View analytics and generated reports." },
    "/admin/settings": { title: "Settings", subtitle: "System preferences and configuration." },
  };
  const currentPage = pageTitles[pathname] ?? { title: "Admin", subtitle: "" };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-[#161616]">
      <Sidebar
        {...sidebarConfig}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main content area — flex-1 fills remaining space naturally */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 max-w-full overflow-x-hidden">
        {/* Fixed Header — edge to edge */}
        <header className="sticky top-0 z-[2100] bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-[#2a2a2a] shadow-sm">
          <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 min-w-0 max-w-full">
            {/* Left side — Hamburger and Title */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 bg-[#C9A84C] text-white rounded-md hover:bg-[#B39340] transition-colors flex-shrink-0"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {currentPage.title}
                </h1>
                {currentPage.subtitle && (
                  <p className="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-1">
                    {currentPage.subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content — edge to edge, no padding */}
        <main className="flex-1 min-h-0 min-w-0 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
