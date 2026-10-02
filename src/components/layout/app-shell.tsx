"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { AuthProvider } from "@/lib/auth/auth-context";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Close mobile sidebar automatically upon route changes
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  return (
    <AuthProvider>
      {isAuthPage ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      ) : (
        <div className="min-h-screen flex bg-slate-50/50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-100">
          {/* Desktop Sidebar (persistent) */}
          <div className="hidden lg:flex shrink-0">
            <Sidebar />
          </div>

          {/* Mobile Sidebar Overlay Drawer */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-950 z-10 shadow-2xl">
                <Sidebar onClose={() => setMobileMenuOpen(false)} isMobile />
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      )}
    </AuthProvider>
  );
}
