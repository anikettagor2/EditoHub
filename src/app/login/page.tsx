
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Loader2, Film, Check, User, PenTool, Shield } from "lucide-react";
import Link from "next/link";
import { SnowBackground } from "@/components/snow-background";
import { UserRole } from "@/types/schema";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { signInWithGoogle, loginAsAdmin, loading } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>("client");
  const [error, setError] = useState<string | null>(null);
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });

  const handleAdminLogin = async () => {
      
      if (adminCredentials.username !== 'admin' || adminCredentials.password !== '1234') {
          setError("Invalid username or password");
          return;
      }

      setIsLoggingIn(true);
      setError(null);
      try {
        await loginAsAdmin();
      } catch (error: any) {
        console.error("Admin login failed", error);
        setError("Failed to login as admin");
      } finally {
        setIsLoggingIn(false);
      }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await signInWithGoogle(selectedRole);
    } catch (error: any) {
      console.error("Login failed", error);
      setError(error.message || "Login failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const roles = [
    {
      id: "client",
      title: "Client",
      icon: User,
      description: "I need videos edited"
    },
    {
      id: "editor",
      title: "Video Editor",
      icon: PenTool,
      description: "I edit videos for clients"
    },
    {
      id: "admin",
      title: "Admin",
      icon: Shield,
      description: "Platform management"
    }
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black text-white selection:bg-primary/30">
        <div className="absolute inset-0 z-0 opacity-40">
            <SnowBackground />
        </div>
      
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="z-10 w-full max-w-md space-y-8 px-6 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 backdrop-blur-md border border-primary/20 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              EditoHub
            </span>
          </Link>
          
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Welcome to EditoHub
          </h1>
          <p className="mt-2 text-muted-foreground">
            Select your role to continue
          </p>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-xl shadow-2xl space-y-6"
        >
          <div className="grid grid-cols-1 gap-4">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id as UserRole)}
                className={cn(
                  "relative flex items-center gap-4 rounded-xl border p-4 transition-all text-left group hover:scale-[1.02]",
                  selectedRole === role.id 
                    ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                    : "bg-black/20 border-white/10 hover:bg-white/5 hover:border-white/20"
                )}
              >
                <div className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors",
                  selectedRole === role.id ? "bg-primary text-white" : "bg-zinc-800 text-muted-foreground group-hover:text-white"
                )}>
                  <role.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className={cn("font-semibold", selectedRole === role.id ? "text-primary" : "text-white")}>
                    {role.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {role.description}
                  </div>
                </div>
                {selectedRole === role.id && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="relative">
              <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-zinc-900 px-2 text-muted-foreground">Secure Login</span>
              </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
            </div>
          )}

          {selectedRole === 'admin' ? (
              <div className="space-y-4">
                  <div className="space-y-2">
                       <label className="text-sm font-medium text-gray-300">Username</label>
                       <input 
                          type="text" 
                          placeholder="admin"
                          className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          value={adminCredentials.username}
                          onChange={(e) => setAdminCredentials({...adminCredentials, username: e.target.value})}
                       />
                  </div>
                  <div className="space-y-2">
                       <label className="text-sm font-medium text-gray-300">Password</label>
                       <input 
                          type="password" 
                          placeholder="••••••"
                          className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          value={adminCredentials.password}
                          onChange={(e) => setAdminCredentials({...adminCredentials, password: e.target.value})}
                       />
                  </div>
                  <Button
                    onClick={handleAdminLogin}
                    disabled={isLoggingIn}
                    className="w-full rounded-xl bg-primary py-6 text-white hover:bg-primary/90"
                  >
                      {isLoggingIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Login as Admin"}
                  </Button>
              </div>
          ) : (
            <Button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-white px-4 py-6 text-black transition-all hover:bg-gray-100 disabled:opacity-70"
            >
                {isLoggingIn ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                        />
                        <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                        />
                        <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                        />
                        <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                        />
                    </svg>
                )}
                <span className="font-semibold">Continue with Google</span>
            </Button>
          )}
            
        </motion.div>
        
        <p className="px-8 text-center text-sm text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </Link>
            .
        </p>
      </div>
    </main>
  );
}
