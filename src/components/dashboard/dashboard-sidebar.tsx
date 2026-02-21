"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  Users,
  ShieldCheck,
  LogOut,
  PlusSquare,
  CreditCard,
  Film,
  Briefcase,
  UserPlus,
  FileText
} from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Project } from "@/types/schema";

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  
  const role = user?.role || 'client';

  // Define links per role
  const getLinks = () => {
      switch(role) {
          case 'admin':
              return [
                  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
                  { href: "/dashboard/projects", label: "All Projects", icon: FolderOpen },
                  { href: "/dashboard/users", label: "User Management", icon: Users },
                  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
                  { href: "/dashboard/settings", label: "System Settings", icon: Settings },
              ];
          case 'project_manager':
              return [
                  { href: "/dashboard", label: "Workflow", icon: LayoutDashboard },
                  { href: "/dashboard/team", label: "Team Status", icon: Users },
                  { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
                  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
                  { href: "/dashboard/settings", label: "Settings", icon: Settings },
              ];
          case 'sales_executive':
               return [
                  { href: "/dashboard", label: "Sales Portal", icon: Briefcase },
                  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
                  { href: "/dashboard/settings", label: "Settings", icon: Settings },
              ];
          case 'editor':
              return [
                  { href: "/dashboard", label: "My Tasks", icon: FolderOpen },
                  { href: "/dashboard/history", label: "Work History", icon: FileText },
                  { href: "/dashboard/settings", label: "Settings", icon: Settings },
              ];
          default: // Client
              return [
                  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                  { href: "/dashboard/new-project", label: "New Request", icon: PlusSquare },
                  { href: "/dashboard/projects", label: "My Projects", icon: FolderOpen },
                  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
                  { href: "/dashboard/settings", label: "Settings", icon: Settings },
              ];
      }
  };

  const links = getLinks();

  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-border bg-card text-foreground md:flex">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight">
           <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <Film className="h-5 w-5" />
           </div>
           <span>EditoHub</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
             Menu
        </div>
        <nav className="space-y-1 px-3">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            
            return (
              <Link
                key={link.label}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Support / Extra Section (Optional) */}
        <div className="mt-8 px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
             Support
        </div>
        <nav className="space-y-1 px-3">
             <Link href="#" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                <ShieldCheck className="h-4 w-4" /> Help Center
             </Link>
        </nav>
      </div>

      {/* User Footer */}
      <div className="border-t border-border p-4 bg-muted/10">
        <div className="flex items-center gap-3 mb-4">
           <div className="h-9 w-9 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-400 dark:from-zinc-700 dark:to-zinc-900 flex items-center justify-center text-foreground font-bold shadow-sm border border-border">
              {user?.displayName?.[0] || "U"}
           </div>
           <div className="overflow-hidden">
             <p className="truncate text-sm font-semibold text-foreground">
                {user?.displayName || "User"}
             </p>
             <p className="truncate text-xs text-muted-foreground capitalize">
               {role?.replace('_', ' ')}
             </p>
           </div>
        </div>

        <button
          onClick={() => logout()}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/10 dark:hover:border-red-900"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
