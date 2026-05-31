"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  UtensilsCrossed,
  Wine,
  Package,
  Warehouse,
  BedDouble,
  CalendarDays,
  Receipt,
  Wallet,
  Truck,
  BarChart3,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavItems } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ROLE_LABELS } from "@/lib/utils";
import { ConnectionStatusBadge } from "@/components/offline-banner";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  UtensilsCrossed,
  Wine,
  Package,
  Warehouse,
  BedDouble,
  CalendarDays,
  Receipt,
  Wallet,
  Truck,
  BarChart3,
  Settings,
  Users,
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = session?.user?.role || "CASHIER";
  const navItems = getNavItems(role);

  const NavContent = () => (
    <>
      <div className={cn("flex items-center gap-3 px-4 py-6 border-b border-emerald-800/30", collapsed && "justify-center px-2")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-emerald-950 font-serif font-bold text-lg shrink-0">
          R
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-serif text-lg font-bold text-gold leading-tight">RAGEN RESORT</h1>
            <p className="text-xs text-emerald-300/70">Point of Sale</p>
            <div className="mt-2"><ConnectionStatusBadge /></div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-gold/20 text-gold border border-gold/30"
                  : "text-emerald-100/80 hover:bg-emerald-800/50 hover:text-white",
                collapsed && "justify-center px-2"
              )}
            >
              {Icon && <Icon className="h-5 w-5 shrink-0" />}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-emerald-800/30 p-4">
        {!collapsed && session?.user && (
          <div className="mb-3 px-1">
            <p className="text-sm font-medium text-white truncate">{session.user.name}</p>
            <p className="text-xs text-emerald-300/60">{ROLE_LABELS[session.user.role] || session.user.role}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className={cn(
            "w-full text-emerald-200 hover:text-white hover:bg-red-900/40 border border-transparent hover:border-red-500/30",
            collapsed ? "w-11 h-11" : "h-12 touch-target"
          )}
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="ml-2 font-medium">Sign Out</span>}
        </Button>
      </div>
    </>
  );

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 lg:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-white"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-emerald-950 transition-all duration-300",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <NavContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-20 h-6 w-6 items-center justify-center rounded-full bg-gold text-emerald-950 shadow-md"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-64 transition-all duration-300">
        <div className="min-h-screen p-4 pt-24 lg:p-6 lg:pt-6">{children}</div>
      </main>
    </div>
  );
}
