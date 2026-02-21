
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Loader2, Film } from "lucide-react";
import Link from "next/link";
import { SnowBackground } from "@/components/snow-background";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { signInWithGoogle, loginWithEmail, loading } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Email/Pass State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await signInWithGoogle(); // No role arg = Login Mode
    } catch (error: any) {
      console.error("Login failed", error);
      setError(error.message || "Login failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
        setError("Please enter both email and password");
        return;
    }

    setIsLoggingIn(true);
    setError(null);
    try {
        await loginWithEmail(email, password);
    } catch (error: any) {
        console.error("Email login failed", error);
        setError("Invalid email or password");
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
            Welcome Back
          </h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to your account
          </p>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-xl shadow-2xl space-y-6"
        >
          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                  <Label className="text-zinc-300">Email Address</Label>
                  <Input 
                      type="email" 
                      placeholder="you@example.com"
                      className="bg-black/40 border-white/10 text-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                  />
              </div>
              <div className="space-y-2">
                  <div className="flex justify-between items-center">
                      <Label className="text-zinc-300">Password</Label>
                      <Link href="#" className="text-xs text-primary hover:text-primary/80">Forgot Password?</Link>
                  </div>
                  <Input 
                      type="password" 
                      placeholder="••••••••"
                      className="bg-black/40 border-white/10 text-white"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                  />
              </div>
              
              <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-xl"
              >
                  {isLoggingIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Sign In with Email"}
              </Button>
          </form>

          <div className="relative">
              <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-zinc-900 px-2 text-muted-foreground">Or continue with Google</span>
              </div>
          </div>

          <div className="space-y-4">
            <Button
                onClick={handleGoogleLogin}
                variant="outline"
                disabled={isLoggingIn}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl border-white/10 bg-white/5 px-4 py-6 text-white transition-all hover:bg-white/10"
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
                <span className="font-semibold">Sign in with Google</span>
            </Button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
            </div>
          )}
            
        </motion.div>
        
        <p className="px-8 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline underline-offset-4 hover:text-primary font-medium text-white">
              Create Account
            </Link>
        </p>
      </div>
      
      <div className="pb-8 text-center">
          <p className="text-xs text-zinc-500">
             &copy; {new Date().getFullYear()} EditoHub. All rights reserved.
          </p>
      </div>
    </main>
  );
}
