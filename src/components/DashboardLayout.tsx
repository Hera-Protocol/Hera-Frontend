import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderOpen, FileText, KeyRound, Settings, ScrollText, Plus, ChevronDown, User } from "lucide-react";
import { Logo } from "@/components/Logo";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Cases", path: "/dashboard/cases", icon: FolderOpen },
  { label: "Reports", path: "/dashboard/reports", icon: FileText },
  { label: "Keys", path: "/dashboard/keys", icon: KeyRound },
  { label: "Settings", path: "/dashboard/settings", icon: Settings },
  { label: "Audit Log", path: "/dashboard/audit", icon: ScrollText },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border bg-card flex flex-col shrink-0">
        <Link to="/" className="p-5 block">
          <Logo size={24} />
        </Link>
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === "/dashboard" && location.pathname === "/dashboard");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "text-primary border-l-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <span className="font-mono">Workspace</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/new-case"
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.08em] font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3 h-3" />
              New Case
            </Link>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
