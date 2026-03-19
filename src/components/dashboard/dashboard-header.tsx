"use client";

import { useAuth } from "@/lib/context/auth-context";
import { Bell, Search, Command, Activity, Zap, Terminal, Menu, X, CheckCircle2, AlertCircle } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { getUnreadNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/app/actions/admin-actions";
import { db } from "@/lib/firebase/config";
import { collection, query, where, onSnapshot } from "firebase/firestore";

import Image from "next/image";
import { useBranding } from "@/lib/context/branding-context";

interface DashboardHeaderProps {
  onMenuClick?: () => void;
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const { user } = useAuth();
  const { logoUrl } = useBranding();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (user?.uid) {
      // Set up real-time listener for notifications
      try {
        const q = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("read", "==", false)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const newNotifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
          
          setNotifications(newNotifications);
        }, (error) => {
          console.error("Error listening to notifications:", error);
          // Fallback to polling if real-time fails
          fetchNotifications();
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error("Error setting up notification listener:", error);
        // Fallback to polling
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
      }
    }
  }, [user?.uid]);
  
  const fetchNotifications = async () => {
    if (!user?.uid) return;
    try {
      const result = await getUnreadNotifications(user.uid);
      if (result.success) {
        setNotifications(result.data || []);
      } else {
        console.error('Failed to fetch notifications:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };
  
  const handleNotificationClick = async (notification: any) => {
    await markNotificationAsRead(notification.id);
    setNotifications(notifications.filter(n => n.id !== notification.id));
    if (notification.link) {
      window.location.href = notification.link;
    }
  };
  
  const handleMarkAllAsRead = async () => {
    if (user?.uid) {
      await markAllNotificationsAsRead(user.uid);
      setNotifications([]);
    }
  };
  
  const hasRejections = notifications.some(n => n.type === 'project_rejected');
  
  return (
    <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-border bg-background/80 px-6 md:px-10 backdrop-blur-xl transition-all shrink-0">
       <div className="flex items-center gap-4 md:gap-6">
          {/* Mobile Menu Toggle */}
          <button 
            onClick={onMenuClick}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground md:hidden active:scale-95 transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo for mobile */}
          <div className="md:hidden relative h-8 w-24 rounded-xl overflow-hidden">
            {logoUrl ? (
              <Image 
                src={logoUrl} 
                alt="EditoHub Logo" 
                fill 
                className="object-contain object-left"
                priority
              />
            ) : (
                <div className="flex items-center gap-1.5 h-full">
                    <div className="w-5 h-5 rounded bg-primary flex items-center justify-center font-bold text-black italic text-[10px]">E</div>
                    <span className="text-xs font-heading font-black tracking-tighter">EDITO_HUB</span>
                </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted/50 border border-border group hover:border-primary/40 transition-all duration-300">
              <div className="relative">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-emerald-500 blur-[2px] animate-pulse" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Node Status: Active</span>
            </div>
            
            <div className="h-4 w-px bg-border" />
            
            <div className="flex items-center gap-3">
               <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-muted-foreground transition-all hover:bg-accent hover:text-foreground overflow-hidden">
                  {user?.photoURL ? (
                      <Image src={user.photoURL} alt="Profile" width={32} height={32} className="w-full h-full object-cover" />
                  ) : (
                      <Terminal className="h-3.5 w-3.5" />
                  )}
               </div>
               <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">Secure Protocol</span>
                  <span className="text-[10px] font-black text-foreground tracking-widest uppercase truncate max-w-[140px] leading-none">
                      {user?.role?.replace('_', ' ')}: {user?.displayName?.split(' ')[0]}
                  </span>
               </div>
            </div>
          </div>
       </div>

       <div className="flex items-center gap-6 ml-auto">
         {/* Search Interface */}
          <div className="relative hidden xl:block group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input 
              type="text" 
              placeholder="Search anything..." 
              className="h-10 w-80 rounded-lg border border-border bg-muted/30 pl-11 pr-4 text-sm font-medium text-foreground focus:bg-background focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all duration-300 placeholder:text-muted-foreground"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[10px] font-bold text-muted-foreground">
                <Command className="h-2.5 w-2.5" />
                <span>K</span>
            </div>
          </div>

         {/* Meta Actions */}
          <div className="flex items-center gap-3">
            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-lg border transition-all duration-300 active:scale-95 group",
                  hasRejections
                    ? "border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:border-red-500/60"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground hover:border-primary/40"
                )}
              >
                  <Bell className={cn(
                    "h-4 w-4 relative z-10 transition-transform group-hover:rotate-12",
                    hasRejections && "animate-bounce"
                  )} />
                  {notifications.length > 0 && (
                    <span className={cn(
                      "absolute top-2.5 right-2.5 h-2 w-2 rounded-full z-20 border-2 border-background",
                      hasRejections ? "bg-red-500 animate-pulse" : "bg-primary"
                    )} />
                  )}
                  {notifications.length > 0 && (
                    <span className={cn(
                      "absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold z-20 border-2 border-background",
                      hasRejections ? "bg-red-500 text-white" : "bg-primary text-primary-foreground"
                    )}>
                      {notifications.length}
                    </span>
                  )}
                  <div className={cn(
                    "absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                    hasRejections ? "bg-red-500/10" : "bg-primary/5"
                  )} />
              </button>
              
              {/* Notifications Dropdown */}
              {isNotificationOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 top-12 w-96 bg-card border border-border rounded-xl shadow-xl z-50"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">
                      Notifications {notifications.length > 0 && `(${notifications.length})`}
                    </h3>
                    <button
                      onClick={() => setIsNotificationOpen(false)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* Notifications List */}
                  <div className="max-h-96 overflow-y-auto">
                    {loading ? (
                      <div className="p-8 text-center text-muted-foreground">Loading...</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">All caught up!</p>
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <motion.button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            "w-full text-left p-4 border-b border-border/50 last:border-0 transition-all hover:bg-muted/50",
                            notification.type === 'project_rejected' && "hover:bg-red-500/10"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {notification.type === 'project_rejected' && (
                              <div className="mt-0.5 flex-shrink-0">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-medium",
                                notification.type === 'project_rejected' ? "text-red-500" : "text-foreground"
                              )}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                                {notification.message}
                              </p>
                              {notification.type === 'project_rejected' && notification.reason && (
                                <p className="text-xs text-red-600 mt-2 p-2 bg-red-500/10 rounded border border-red-500/20">
                                  <span className="font-semibold">Reason:</span> {notification.reason}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {new Date(notification.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      ))
                    )}
                  </div>
                  
                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="p-3 border-t border-border flex justify-end">
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Mark all as read
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            <div className="h-6 w-px bg-border mx-2" />
            
            <ModeToggle />
          </div>
       </div>
    </header>
  );
}
