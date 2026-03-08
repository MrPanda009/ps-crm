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

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar 
        {...sidebarConfig} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />


      {/* Keep content adjacent to fixed sidebar on desktop */}
      <main className={`flex-1 w-full p-4 transition-[margin] duration-300 ${isCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden p-2 bg-purple-600 text-white rounded-md mb-4"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        {children}
      </main>
    </div>
  );
}