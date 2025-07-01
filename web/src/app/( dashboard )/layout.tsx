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
      <aside className="w-64 bg-gray-100 p-6 border-r border-gray-200">
        <h2 className="text-xl font-bold mb-8">OrthoReminder</h2>
        <nav className="flex flex-col gap-1">
          {/* 4. Update the Links with conditional styling */}
          <Link
            href="/"
            className={`p-2 rounded-md text-gray-700 hover:bg-gray-200 hover:text-black ${
              pathname === "/" ? "bg-blue-100 text-blue-700 font-semibold" : ""
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/history"
            className={`p-2 rounded-md text-gray-700 hover:bg-gray-200 hover:text-black ${
              pathname === "/history"
                ? "bg-blue-100 text-blue-700 font-semibold"
                : ""
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
