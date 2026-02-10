
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
  DollarSign
} from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Project } from "@/types/schema";

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [totalEarnings, setTotalEarnings] = useState(0);
  
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || isAdmin;
  const isEditor = user?.role === 'editor';

  // Fetch earnings for editor
  useEffect(() => {
    if (!isEditor || !user) return;

    const q = query(
        collection(db, "projects"),
        where("members", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        let total = 0;
        snapshot.docs.forEach(doc => {
            const data = doc.data() as Project;
            // Assuming 'amountPaid' is the field for editor earnings
            total += (data.amountPaid || 0);
        });
        setTotalEarnings(total);
    });

    return () => unsubscribe();
  }, [isEditor, user]);

  let baseLinks = [];

  if (isEditor) {
      baseLinks = [
          {
              href: "/dashboard",
              label: "Projects",
              icon: FolderOpen,
          },
          {
              href: "/dashboard", // Or a specific earnings detail page if available
              label: `Earnings: $${totalEarnings.toLocaleString()}`,
              icon: DollarSign,
          },
          {
              href: "/dashboard/settings",
              label: "Settings",
              icon: Settings,
          }
      ];
  } else {
      baseLinks = [
          {
              href: "/dashboard",
              label: "Dashboard",
              icon: LayoutDashboard,
          },
          {
              href: "/dashboard/projects",
              label: "My Projects",
              icon: FolderOpen,
          },
          {
              href: "/dashboard/projects/new",
              label: "New Project",
              icon: PlusSquare
          },
          {
              href: "/dashboard/payments",
              label: "Payments",
              icon: CreditCard
          },
          {
              href: "/dashboard/settings",
              label: "Settings",
              icon: Settings,
          }
      ];
  }

  // Append Admin links if applicable
  const links = [
      ...baseLinks,
      ...(isAdmin && !isEditor ? [{ // Ensure admin doesn't see this if toggled as editor (rare case)
          href: "/dashboard/admin",
          label: "Admin Control",
          icon: ShieldCheck,
      }] : [])
  ];

  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-border bg-card text-foreground md:flex">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
           <Film className="h-6 w-6 text-primary" />
           <span>EditoHub</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-1 px-3">
          {links.map((link) => {
            const Icon = link.icon;
            // Strict check for root dashboard, loose check for sub-sections
            const isActive = link.href === "/dashboard" 
                ? pathname === "/dashboard"
                : pathname.startsWith(link.href);
            
            return (
              <Link
                key={link.label} // Use label as key since href might duplicate
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-muted/50 p-3">
           <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.displayName?.[0] || user?.email?.[0] || "U"}
           </div>
           <div className="overflow-hidden">
             <p className="truncate text-sm font-medium text-foreground">
                {user?.displayName || "User"}
             </p>
             <p className="truncate text-xs text-muted-foreground">
               {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Loading...'}
             </p>
           </div>
        </div>

        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
