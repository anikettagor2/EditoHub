"use client";

import { useAuth } from "@/lib/context/auth-context";
import { Loader2 } from "lucide-react";
import { ClientDashboard } from "./components/client-dashboard";
import { EditorDashboard } from "./components/editor-dashboard";
import { AdminDashboard } from "./components/admin-dashboard";
import { SalesDashboard } from "./components/sales-dashboard";
import { ProjectManagerDashboard } from "./components/project-manager-dashboard";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
     return (
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
     );
  }

  if (!user) {
      return null;
  }

  return (
    <div>
        {user.role === 'client' && <ClientDashboard />}
        {user.role === 'editor' && <EditorDashboard />}
        {user.role === 'admin' && <AdminDashboard />}
        {user.role === 'sales_executive' && <SalesDashboard />}
        {user.role === 'project_manager' && <ProjectManagerDashboard />}
        
        {!['client', 'editor', 'admin', 'sales_executive', 'project_manager'].includes(user.role) && (
            <div className="text-center py-20 text-muted-foreground">
                Unknown role: {user.role}. Please contact support.
            </div>
        )}
    </div>
  );
}
