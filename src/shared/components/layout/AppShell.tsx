import { Link, useLocation } from "@tanstack/react-router";
import {
  Heart,
  LayoutDashboard,
  Bell,
  FileText,
  Users,
  ClipboardList,
  Calendar,
  BarChart3,
  Menu,
  X,
  User,
  ArrowRightLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const NAV = [
  { to: "/patients", label: "Patients", icon: Users, requiresPatient: false },
  { to: "/analytics", label: "Cohort Analytics", icon: BarChart3, requiresPatient: false },
  { to: "/", label: "Patient Dashboard", icon: LayoutDashboard, requiresPatient: true },
  { to: "/alerts", label: "Alerts / Review", icon: Bell, requiresPatient: true },
  { to: "/timeline", label: "Research Timeline", icon: Calendar, requiresPatient: true },
  { to: "/summary", label: "Action Summary", icon: ClipboardList, requiresPatient: true },
  { to: "/audit", label: "Audit Log", icon: FileText, requiresPatient: false },
] as const;

// Bottom bar navigation items for mobile devices (essential touch routes)
const MOBILE_BOTTOM_NAV = [
  { to: "/patients", label: "Patients", icon: Users, requiresPatient: false },
  { to: "/", label: "Dashboard", icon: LayoutDashboard, requiresPatient: true },
  { to: "/alerts", label: "Alerts", icon: Bell, requiresPatient: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, requiresPatient: false },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Open Navigation Menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20">
              <Heart className="size-4 fill-rose-500/20" />
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">My HEART:AFCArE</p>
              <p className="text-[9px] text-muted-foreground font-mono">v2026.08.26</p>
            </div>
          </div>
        </div>

        {selectedId ? (
          <Link
            to="/patients"
            className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary"
          >
            <User className="size-3" />
            <span className="max-w-[100px] truncate">{selectedName || selectedId}</span>
            <ArrowRightLeft className="size-2.5 opacity-60" />
          </Link>
        ) : (
          <Link
            to="/patients"
            className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground shadow-xs"
          >
            Select Patient
          </Link>
        )}
      </header>

      {/* Mobile Slide-Out Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative flex w-4/5 max-w-xs flex-1 flex-col bg-card border-r border-border p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20">
                  <Heart className="size-4 fill-rose-500/20" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">My HEART:AFCArE</h2>
                  <p className="text-[10px] text-muted-foreground">Clinical Decision Support</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Active Patient summary if selected */}
            {selectedId && (
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                <div className="flex items-center justify-between text-[10px] font-semibold text-primary uppercase tracking-wider">
                  <span>Current Patient</span>
                  <span className="font-mono">{selectedId}</span>
                </div>
                <p className="mt-0.5 text-xs font-bold text-foreground truncate">{selectedName}</p>
                <Link
                  to="/patients"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-2 flex items-center justify-center gap-1 rounded bg-card py-1 text-[11px] font-medium text-muted-foreground border border-border hover:text-foreground"
                >
                  <ArrowRightLeft className="size-3" /> Change Patient
                </Link>
              </div>
            )}

            {/* Navigation items */}
            <nav className="mt-4 flex-1 space-y-1 overflow-y-auto">
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
                      className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground/40"
                    >
                      <Icon className="size-4 opacity-40" />
                      {item.label}
                    </span>
                  );
                }

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    search={search}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition ${
                      active
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="size-4" />
                      {item.label}
                    </div>
                    <ChevronRight className="size-3.5 opacity-40" />
                  </Link>
                );
              })}
            </nav>

            {/* System Status in Drawer Footer */}
            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse-dot" />
                <span>CDSS Rule Engine Online</span>
              </div>
              <p className="mt-1 text-[9px] leading-tight text-muted-foreground">
                Clinical assistance system · Does not replace clinical judgement.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex flex-1 min-h-screen">
        {/* Desktop / Tablet Sidebar */}
        <aside className="hidden md:flex w-60 lg:w-64 shrink-0 flex-col border-r border-border bg-card/90 backdrop-blur-md">
          {/* Brand Header */}
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-red-500/10 text-rose-600 border border-rose-500/20 shadow-xs">
              <Heart className="size-5 fill-rose-500/20" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight tracking-tight">My HEART:AFCArE</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                <span className="text-[10px] font-mono text-muted-foreground">
                  CDSS AF (2026.08.26)
                </span>
              </div>
            </div>
          </div>

          {/* Active Patient Card in Sidebar */}
          {selectedId ? (
            <div className="m-2.5 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02] p-3 shadow-xs">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-primary">
                <span className="flex items-center gap-1">
                  <User className="size-3" /> Active Case
                </span>
                <span className="font-mono">{selectedId}</span>
              </div>
              <p className="mt-1 text-xs font-bold text-foreground truncate" title={selectedName}>
                {selectedName}
              </p>
              <Link
                to="/patients"
                className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-1 text-[11px] font-medium text-muted-foreground shadow-2xs hover:bg-muted hover:text-foreground transition"
              >
                <ArrowRightLeft className="size-3" /> Switch Patient
              </Link>
            </div>
          ) : (
            <div className="m-2.5 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">No patient selected</p>
              <Link
                to="/patients"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                Open Patient Directory →
              </Link>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 p-2.5 overflow-y-auto">
            {NAV.map((item) => {
              const active =
                item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
              const Icon = item.icon;
              const search = item.requiresPatient && selectedId ? { p: selectedId } : {};
              const disabled = item.requiresPatient && !selectedId;

              if (disabled) {
                return (
                  <span
                    key={item.to}
                    title="Select a patient first"
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground/35"
                  >
                    <Icon className="size-4 opacity-40" />
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  search={search}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-foreground/75 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`size-4 transition-transform ${active ? "scale-110" : "group-hover:scale-105"}`}
                    />
                    {item.label}
                  </div>
                  {active && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Sidebar Footer */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary shrink-0" />
              <p className="leading-snug">
                Clinical decision support assists workflow and does not replace medical judgement.
              </p>
            </div>
          </div>
        </aside>

        {/* Workspace Body */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Bar for Desktop & Tablet */}
          <header className="hidden md:flex h-12 items-center justify-between border-b border-border bg-card/80 px-5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/patients" className="hover:text-foreground font-medium transition">
                Patients Directory
              </Link>
              {selectedId && (
                <>
                  <span className="text-border">/</span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="font-mono text-primary font-bold">{selectedId}</span>
                    <span>·</span>
                    <span>{selectedName}</span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {selectedId && (
                <Link
                  to="/patients"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-2xs hover:bg-muted hover:text-foreground transition"
                >
                  <ArrowRightLeft className="size-3" /> Change patient
                </Link>
              )}
            </div>
          </header>

          {/* Content Container (padded for mobile bottom nav) */}
          <main className="flex-1 overflow-x-hidden pb-16 md:pb-6">{children}</main>
        </div>
      </div>

      {/* Mobile Bottom Floating Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-card/95 px-2 py-1.5 backdrop-blur-lg md:hidden">
        {MOBILE_BOTTOM_NAV.map((item) => {
          const active =
            item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          const search = item.requiresPatient && selectedId ? { p: selectedId } : {};
          const disabled = item.requiresPatient && !selectedId;

          if (disabled) {
            return (
              <span
                key={item.to}
                className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium text-muted-foreground/30"
              >
                <Icon className="size-4 opacity-30" />
                <span>{item.label}</span>
              </span>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              search={search}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium transition ${
                active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`size-4 ${active ? "stroke-[2.5]" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
