"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { LayoutDashboard, CalendarDays, MessageSquare, ClipboardList, Settings, PanelLeftClose, PanelLeftOpen, Stethoscope } from "lucide-react";
import { PatientSearch } from "@/components/features/patients/patient-search";

const navItems = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { href: "/pipeline", label: "Pipeline", icon: <ClipboardList className="w-5 h-5" /> },
  { href: "/calendar", label: "Calendar", icon: <CalendarDays className="w-5 h-5" /> },
  { href: "/controles", label: "Controles", icon: <Stethoscope className="w-5 h-5" /> },
  { href: "/history", label: "Message History", icon: <MessageSquare className="w-5 h-5" /> },
  { href: "/settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
];

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-3 rounded-xl p-2.5 transition-all duration-200 bg-white/[0.06] hover:bg-white/10 group focus:outline-none ${collapsed ? "justify-center" : ""}`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#A066F8] to-[#6469FC] text-white text-sm font-bold shadow-sm">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 overflow-hidden text-left">
              <p className="truncate text-sm font-bold text-white">
                {user?.name || "User"}
              </p>
              <p className="truncate text-xs text-white/70">{user?.email}</p>
            </div>
            <svg
              className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div className={`absolute top-full ${collapsed ? "left-full ml-2" : "left-0 right-0"} mt-2 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50 min-w-[200px]`}>
          <div className="p-1.5">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Account Settings
            </Link>
            <div className="my-1 border-t border-gray-100" />
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#6469FC]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`relative z-10 flex flex-col bg-[#1B1B1B] text-white border-r border-black/40 shadow-2xl shrink-0 my-0 transition-all duration-300 ease-in-out overflow-hidden ${
          collapsed ? "w-[72px]" : "w-[264px]"
        }`}
      >
        {/* Logo + Collapse Toggle */}
        <div
          className={`flex pt-7 pb-6 transition-all duration-300 ${
            collapsed ? "px-2 flex-col items-center gap-4" : "px-6 items-center gap-3"
          }`}
        >
          <Link
            href="/"
            title="Go to Dashboard"
            className="flex items-center gap-3 min-w-0 transition-opacity hover:opacity-80"
          >
            {collapsed ? (
              <Image
                src="/alnix-mark-white.svg"
                alt="Alnix"
                width={32}
                height={32}
                priority
                className="h-8 w-auto shrink-0"
              />
            ) : (
              <div className="flex flex-col leading-none whitespace-nowrap">
                <Image
                  src="/alnix-logo-white.svg"
                  alt="Alnix"
                  width={120}
                  height={18}
                  priority
                  className="h-[22px] w-auto"
                />
                <span className="text-[10px] font-semibold tracking-[0.34em] text-white/45 mt-2">
                  ORTHOREMINDER
                </span>
              </div>
            )}
          </Link>

          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-all duration-200 hover:bg-white/10 hover:text-white focus:outline-none ${
              collapsed ? "" : "ml-auto"
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>

        {/* User Section */}
        {isAuthenticated && (
          <div className={`shrink-0 transition-all duration-300 ${collapsed ? "px-2 pb-4" : "px-4 pb-8"}`}>
            <UserMenu collapsed={collapsed} />
          </div>
        )}

        {/* Patient Search */}
        {isAuthenticated && (
          <div className={`shrink-0 transition-all duration-300 ${collapsed ? "px-2 pb-2" : "px-4 pb-4"}`}>
            <PatientSearch collapsed={collapsed} />
          </div>
        )}

        {/* Navigation */}
        <nav className={`flex flex-1 flex-col gap-2 pb-6 transition-all duration-300 ${collapsed ? "px-2" : "px-4"}`}>
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-4 py-3 text-sm transition-all duration-200 rounded-xl ${
                  collapsed ? "px-0 justify-center" : "px-3.5"
                } ${
                  isActive
                    ? "bg-gradient-to-br from-[#A066F8] to-[#6469FC] text-white font-bold shadow-[0_6px_18px_rgba(100,105,252,0.4)]"
                    : "text-[#b6b6bd] hover:bg-white/[0.06] hover:text-white font-semibold"
                }`}
              >
                <span className={`text-lg shrink-0 ${isActive ? 'opacity-100' : 'opacity-70'}`}>{item.icon}</span>
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 flex flex-col overflow-y-auto max-h-screen relative">{children}</main>
    </div>
  );
}
