"use client";

import { useAuth } from "@/lib/context/auth-context";
import { Bell, Search } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export function DashboardHeader() {
  const { user } = useAuth();
  
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl transition-colors">
       <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
          {/* Breadcrumbs placeholder or page title */}
          <span className="font-medium text-foreground">Dashboard</span>
       </div>

       <div className="flex items-center gap-4 ml-auto">
         {/* Search Bar (Visual Only for now) */}
         <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search projects..." 
              className="h-9 w-64 rounded-lg border border-border bg-muted pl-9 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
         </div>

         {/* Notifications */}
         <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
         </button>

         {/* Theme Toggle */}
         <ModeToggle />
       </div>
    </header>
  );
}
