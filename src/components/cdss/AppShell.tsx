import { Link, useLocation } from "@tanstack/react-router";
import { Heart, LayoutDashboard, Bell, FileText, Users, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";

interface PatientLite {
  patient_id: string;
  name: string;
  clinic_location: string;
}

const NAV = [
  { to: "/", label: "Patient Dashboard", icon: LayoutDashboard },
  { to: "/alerts", label: "Alerts / Review", icon: Bell },
  { to: "/summary", label: "Action Summary", icon: ClipboardList },
  { to: "/audit", label: "Audit Log", icon: FileText },
] as const;

export function AppShell({
  patients,
  selectedId,
  children,
}: {
  patients: PatientLite[];
  selectedId: string;
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
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  search={{ p: selectedId }}
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
          {/* Top patient picker */}
          <header className="border-b border-border bg-card">
            <div className="flex items-center gap-2 px-4 py-2">
              <Users className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Patients:
              </span>
              <div className="flex flex-1 gap-1 overflow-x-auto">
                {patients.map((p) => (
                  <Link
                    key={p.patient_id}
                    to={location.pathname as "/"}
                    search={{ p: p.patient_id }}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      selectedId === p.patient_id
                        ? "bg-foreground text-background"
                        : "bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {p.patient_id} · {p.name.split(" ")[0]}
                    <span className="ml-1 text-[10px] opacity-70">
                      ({p.clinic_location.replace(" Clinic", "")})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </div>
  );
}

