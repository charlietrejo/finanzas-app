import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_60%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Link href="/dashboard" className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200">
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-slate-200/70 bg-white/80 p-8 shadow-sm shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Seguridad con Supabase
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Tu cuenta financiera, protegida desde el inicio.
            </h1>
            <p className="mt-3 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-400">
              La arquitectura ya está preparada para autenticación segura, RLS y futuras integraciones móviles.
            </p>
          </div>
          <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-sm shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
