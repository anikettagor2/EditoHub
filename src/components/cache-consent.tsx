"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, Check, Zap } from "lucide-react";

export function CacheConsentPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted or dismissed
    const hasConsented = localStorage.getItem("editohub_cache_consent");
    if (!hasConsented) {
      // Small delay so it doesn't pop up immediately on page load
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("editohub_cache_consent", "accepted");
    setIsVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("editohub_cache_consent", "dismissed");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-6 left-6 z-[9999] max-w-sm w-full bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl p-5 overflow-hidden backdrop-blur-xl"
        >
          {/* Futuristic ambient glow */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-blue-500/10 via-transparent to-purple-500/10 pointer-events-none" />
          
          <button 
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4 relative z-10">
            <div className="bg-blue-500/20 p-2.5 rounded-xl border border-blue-500/30">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            
            <div className="flex-1 pr-4">
              <h3 className="text-white font-semibold text-sm mb-1">
                Enable Google-Level Performance
              </h3>
              <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                We store encrypted video chunks in your device cache to provide instant, buffer-free playback and save your bandwidth. Allow caching cookies for the best experience.
              </p>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAccept}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-blue-500/25 active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  Enable Fast Streaming
                </button>
                <button
                  onClick={handleDismiss}
                  className="text-slate-400 hover:text-slate-200 text-xs font-medium px-2 transition-colors"
                >
                  No thanks
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
