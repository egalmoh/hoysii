"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, CalendarDays, Users, LogOut, Menu, X } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { authClient } from "@/lib/auth-client";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (path) => pathname === path;

  const navItems = [
    { name: "Hotels", href: "/", icon: LayoutDashboard },
    { name: "Operations", href: "/operations", icon: CalendarDays },
    { name: "Bookings", href: "/bookings", icon: CalendarDays },
    { name: "Users", href: "/users", icon: Users },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    await authClient.signOut();
    router.push('/admin');
    setLoggingOut(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-brand-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="Hoysii admin home" className="flex shrink-0 items-center gap-3">
            <Image src="/brand/hoysii-logo.png" alt="Hoysii" width={1622} height={510} priority className="h-auto w-28 sm:w-36" />
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">Admin</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <ModeToggle />

          {/* Logout Button - Desktop */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {loggingOut ? 'Signing out...' : 'Logout'}
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all ${
                    isActive(item.href)
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}

            {/* Logout Button - Mobile */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-50"
            >
              <LogOut className="w-5 h-5" />
              {loggingOut ? 'Signing out...' : 'Logout'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
