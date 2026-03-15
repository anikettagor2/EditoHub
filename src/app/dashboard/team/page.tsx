"use client";

import { useAuth } from "@/lib/context/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Project, User } from "@/types/schema";
import { useEffect, useMemo, useState } from "react";
import { Users, Loader2, IndianRupee, FolderOpen, FileText } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function TeamManagementPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    const clientsQ = query(
      collection(db, "users"),
      where("role", "==", "client"),
      where("managedByPM", "==", user.uid)
    );

    const projectsQ = query(
      collection(db, "projects"),
      where("assignedPMId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubClients = onSnapshot(clientsQ, (snap) => {
      setClients(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User)));
      setLoading(false);
    });

    const unsubProjects = onSnapshot(projectsQ, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)));
    });

    return () => {
      unsubClients();
      unsubProjects();
    };
  }, [user?.uid]);

  const teamData = useMemo(() => {
    const byClient = new Map<string, {
      clientId: string;
      clientName: string;
      clientEmail: string;
      totalProjects: number;
      totalPendingDues: number;
      pendingProjects: { id: string; name: string; pending: number }[];
    }>();

    for (const c of clients) {
      byClient.set(c.uid, {
        clientId: c.uid,
        clientName: c.displayName || "Unknown Client",
        clientEmail: c.email || "N/A",
        totalProjects: 0,
        totalPendingDues: 0,
        pendingProjects: [],
      });
    }

    for (const p of projects) {
      const cid = p.clientId;
      if (!cid) continue;
      if (!byClient.has(cid)) {
        byClient.set(cid, {
          clientId: cid,
          clientName: p.clientName || "Unknown Client",
          clientEmail: "N/A",
          totalProjects: 0,
          totalPendingDues: 0,
          pendingProjects: [],
        });
      }

      const entry = byClient.get(cid)!;
      entry.totalProjects += 1;

      const pending = Math.max((p.totalCost || 0) - (p.amountPaid || 0), 0);
      if (pending > 0) {
        entry.totalPendingDues += pending;
        entry.pendingProjects.push({ id: p.id, name: p.name, pending });
      }
    }

    return Array.from(byClient.values()).sort((a, b) => b.totalPendingDues - a.totalPendingDues);
  }, [clients, projects]);

  const totals = useMemo(() => {
    return teamData.reduce(
      (acc, c) => {
        acc.clients += 1;
        acc.projects += c.totalProjects;
        acc.pending += c.totalPendingDues;
        return acc;
      },
      { clients: 0, projects: 0, pending: 0 }
    );
  }, [teamData]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "project_manager") {
    return <div className="p-8 text-sm text-muted-foreground">Access restricted to Project Managers.</div>;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Team Management</h1>
        <p className="text-muted-foreground mt-1">Assigned clients, their project volume, and pending dues breakdown.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Assigned Clients</div>
          <div className="text-3xl font-black text-foreground tabular-nums">{totals.clients}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Total Projects</div>
          <div className="text-3xl font-black text-foreground tabular-nums">{totals.projects}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Total Dues Left</div>
          <div className="text-3xl font-black text-amber-500 tabular-nums">₹{totals.pending.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 md:p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Assigned Clients Overview</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{teamData.length} clients</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Total Projects</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Total Dues Left</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pending Dues by Project</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teamData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-14 text-center text-sm text-muted-foreground">No assigned clients yet.</td>
                </tr>
              ) : (
                teamData.map((item) => (
                  <tr key={item.clientId} className="hover:bg-muted/20 transition-colors align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-foreground">{item.clientName}</div>
                      <div className="text-xs text-muted-foreground">{item.clientEmail}</div>
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-foreground tabular-nums">{item.totalProjects}</td>
                    <td className="px-4 py-4 text-sm font-bold tabular-nums text-amber-500">₹{item.totalPendingDues.toLocaleString()}</td>
                    <td className="px-4 py-4">
                      {item.pendingProjects.length === 0 ? (
                        <span className="text-xs text-emerald-500 font-semibold">No pending dues</span>
                      ) : (
                        <div className="space-y-2 max-w-[500px]">
                          {item.pendingProjects.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 border border-border">
                              <Link href={`/dashboard/projects/${p.id}`} className="text-xs font-semibold text-foreground hover:text-primary truncate">
                                {p.name}
                              </Link>
                              <span className="text-xs font-bold text-amber-500 tabular-nums whitespace-nowrap">₹{p.pending.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
