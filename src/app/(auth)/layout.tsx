export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-cloud px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-3xl font-light tracking-tight text-ink">
          Finanzas
        </h1>
        <div className="rounded-card bg-snow p-8 shadow-[var(--shadow-card)]">{children}</div>
      </div>
    </div>
  );
}
