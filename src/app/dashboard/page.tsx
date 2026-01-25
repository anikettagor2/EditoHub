"use client";

import { useAuth } from "@/lib/context/auth-context";
import { Loader2 } from "lucide-react";
import { ClientDashboard } from "./components/client-dashboard";
import { EditorDashboard } from "./components/editor-dashboard";
import { AdminDashboard } from "./components/admin-dashboard";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
     return (
        <div className="flex h-screen items-center justify-center bg-black text-white">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
     );
  }

  if (!user) {
      return null; // Middlewarer redirects usually, but fail-safe
  }

  return (
    <div>
        {user.role === 'client' && <ClientDashboard />}
        {user.role === 'editor' && <EditorDashboard />}
        {user.role === 'admin' && <AdminDashboard />}
        {/* Fallback or guest view if needed */}
        {!['client', 'editor', 'admin'].includes(user.role) && (
            <div className="text-center py-20 text-muted-foreground">
                Unknown role: {user.role}. Please contact support.
            </div>
        )}
    </div>
  );
}
