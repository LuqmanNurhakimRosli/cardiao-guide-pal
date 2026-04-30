import { Link, useLocation } from "@tanstack/react-router";
import { Heart, LayoutDashboard, Bell, FileText, Users, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/patients", label: "Patients", icon: Users, requiresPatient: false },
  { to: "/", label: "Patient Dashboard", icon: LayoutDashboard, requiresPatient: true },
  { to: "/alerts", label: "Alerts / Review", icon: Bell, requiresPatient: true },
  { to: "/summary", label: "Action Summary", icon: ClipboardList, requiresPatient: true },
  { to: "/audit", label: "Audit Log", icon: FileText, requiresPatient: false },
] as const;

export function AppShell({
  selectedId,
  selectedName,
  children,
}: {
  selectedId?: string;
  selectedName?: string;
  children: ReactNode;
}) {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Heart className="size-5 text-[var(--clinical-alert)]" />
            <div>
              <p className="text-sm font-bold leading-tight">My HEART:AFCArE</p>
              <p className="text-[10px] text-muted-foreground">CDSS · AF</p>
            </div>
          </div>
          <nav className="flex-1 p-2">
            {NAV.map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
              const Icon = item.icon;
              const search = item.requiresPatient && selectedId ? { p: selectedId } : {};
              const disabled = item.requiresPatient && !selectedId;
              if (disabled) {
                return (
                  <span
                    key={item.to}
                    title="Select a patient first"
                    className="flex cursor-not-allowed items-center gap-2 rounded px-3 py-2 text-sm font-medium text-foreground/30"
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </span>
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  search={search}
                  className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-foreground text-background"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border p-3 text-[10px] leading-snug text-muted-foreground">
            This system <span className="font-semibold">supports</span> but does
            not replace clinical judgement.
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
            <div className="flex items-center gap-2 text-xs">
              <Link to="/patients" className="text-muted-foreground hover:text-foreground">
                Patients
              </Link>
              {selectedId && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="font-medium">
                    {selectedId} · {selectedName}
                  </span>
                </>
              )}
            </div>
            {selectedId && (
              <Link
                to="/patients"
                className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ← Change patient
              </Link>
            )}
          </header>
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </div>
  );
}
