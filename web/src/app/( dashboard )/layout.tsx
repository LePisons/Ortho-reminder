import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-100 p-6 border-r border-gray-200">
        <h2 className="text-xl font-bold mb-8">OrthoReminder</h2>
        <nav className="flex flex-col gap-4">
          <Link href="/" className="text-gray-700 hover:text-black">
            Dashboard
          </Link>
          <Link href="/history" className="text-gray-700 hover:text-black">
            Message History
          </Link>
          {/* We can add more links here later */}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 bg-gray-50">
        {children} {/* This is where the page content will be rendered */}
      </main>
    </div>
  );
}
