
"use client";

import { useAuth } from "@/lib/context/auth-context";
import { ClientDashboard } from "@/app/dashboard/components/client-dashboard";
import { EditorDashboard } from "@/app/dashboard/components/editor-dashboard";
import { AdminDashboard } from "@/app/dashboard/components/admin-dashboard";
import { Loader2 } from "lucide-react";

export default function ProjectsPage() {
  const { user, loading } = useAuth();

  if (loading) {
     return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
     );
  }

  if (!user) return null;

  return (
    <div>
        {user.role === 'client' && <ClientDashboard />}
        {user.role === 'editor' && <EditorDashboard />}
        {user.role === 'admin' && <AdminDashboard />}
    </div>
  );
}
