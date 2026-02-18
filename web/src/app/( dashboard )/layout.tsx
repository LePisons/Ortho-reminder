"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white p-6 border-r border-gray-100">
        <h2 className="text-xl font-bold mb-8 tracking-tight text-gray-900">OrthoReminder</h2>
        <nav className="flex flex-col gap-1">
          {/* 4. Update the Links with conditional styling */}
          <Link
            href="/"
            className={`p-2 rounded-md text-sm font-medium transition-colors ${
              pathname === "/" 
                ? "bg-slate-50 text-slate-900 border-l-4 border-[#254F22]" 
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/history"
            className={`p-2 rounded-md text-sm font-medium transition-colors ${
              pathname === "/history"
                ? "bg-slate-50 text-slate-900 border-l-4 border-[#254F22]"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            Message History
          </Link>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 bg-gray-50">{children}</main>
    </div>
  );
}
