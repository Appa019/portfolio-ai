// Next.js App Router requires default export for layouts
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg-secondary)" }}
    >
      {children}
    </div>
  );
}
