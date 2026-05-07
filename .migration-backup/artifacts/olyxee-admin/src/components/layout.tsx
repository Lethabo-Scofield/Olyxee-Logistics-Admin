import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Package, FileText,
  Menu, Moon, Sun, Settings, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";

function UserRow() {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user?.email ||
    "User";
  const email = user?.email ?? "";
  const initial = (fullName || "U").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <Avatar className="h-7 w-7 flex-shrink-0">
        <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{fullName}</p>
        {email ? (
          <p className="text-xs text-sidebar-foreground/50 truncate">{email}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          setLocation("/login");
        }}
        className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1"
        aria-label="Sign out"
        title="Sign out"
        data-testid="button-signout"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/audit-logs", label: "Audit Logs", icon: FileText },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isDark, setIsDark, logoUrl, businessName } = useTheme();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-sidebar-border flex-shrink-0">
        {logoUrl ? (
          <img src={logoUrl} alt={businessName} className="h-7 w-auto object-contain max-w-[120px]" />
        ) : (
          <>
            <div className="h-7 w-7 bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold leading-none">
                {businessName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="font-semibold text-sm tracking-tight truncate">{businessName}</span>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-3 mt-3 border-t border-sidebar-border">
          <Link
            href="/settings"
            className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
              location.startsWith("/settings")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            Settings
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-sidebar-border">
        {/* Dark mode toggle row */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-sidebar-border">
          <span className="text-xs text-sidebar-foreground/50">Appearance</span>
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {isDark ? "Light" : "Dark"}
          </button>
        </div>

        {/* User row */}
        <UserRow />

        {/* Olyxee branding */}
        <div className="px-5 py-2 border-t border-sidebar-border">
          <p className="text-[10px] text-sidebar-foreground/25 tracking-widest uppercase">Powered by Olyxee</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-56 border-r-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold text-sidebar-foreground">{businessName}</span>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden md:mt-0 mt-12">
        <div className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
