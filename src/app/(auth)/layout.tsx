import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_60%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Link href="/dashboard" className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[36px] border border-slate-200/70 bg-white/80 p-8 shadow-xl shadow-slate-200/40 backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800">
              <ShieldCheck className="h-4 w-4" />
              Seguridad reforzada
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
              Tu cuenta financiera, protegida desde el primer paso.
            </h1>
            <p className="mt-3 max-w-lg text-base leading-7 text-slate-600">
              Autenticación segura con Supabase, confirmación de correo y diseño pensado para móviles.
            </p>
          </div>
          <div className="rounded-[36px] border border-slate-200/70 bg-white/95 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
