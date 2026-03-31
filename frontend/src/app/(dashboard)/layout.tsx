import { Sidebar } from "@/components/sidebar";

// Next.js App Router requires default export for layouts
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-8 py-10 lg:px-16 max-w-[1400px]">
        {children}
      </main>
    </div>
  );
}
