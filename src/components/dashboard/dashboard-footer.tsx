
export function DashboardFooter() {
  return (
    <footer className="w-full py-6 px-6 md:px-8 bg-background border-t border-border mt-auto">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} EditoHub. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-primary transition-colors">Help Center</a>
        </div>
      </div>
    </footer>
  );
}
