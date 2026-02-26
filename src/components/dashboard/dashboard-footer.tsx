
export function DashboardFooter() {
  return (
    <footer className="w-full py-12 px-10 md:px-14 bg-muted/30 border-t border-border mt-auto relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
      <div className="flex flex-col md:flex-row justify-between items-center gap-10 relative z-10">
        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-3">
              <span className="h-1 w-8 bg-muted rounded-full" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em]">
                &copy; {new Date().getFullYear()} EDITOHUB // CORE_INFRA_STABLE
              </p>
           </div>
           <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-[0.3em] ml-11">
             Encrypted Handshake Protocol v2.4.0
           </p>
        </div>
        
        <div className="flex items-center gap-10">
          <a href="#" className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] hover:text-foreground transition-all duration-500">Privacy Protocol</a>
          <a href="#" className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] hover:text-foreground transition-all duration-500">Legal Matrix</a>
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-muted/50 border border-border">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,1)]" />
             <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Global Status: Nominal</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
