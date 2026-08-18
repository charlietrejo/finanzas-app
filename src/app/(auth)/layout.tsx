import Icon from "@/components/ui/icon-material";
import { connection } from "next/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Fuerza dynamic rendering en la rama /(auth). El nonce de CSP se inyecta
  // durante el render SSR (no en build-time), por lo que estas páginas no
  // pueden ser estáticas: de lo contrario los scripts inline de Next no
  // reciben el nonce y la CSP los bloquea (hidratación rota).
  await connection();

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.10),_transparent_60%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden rounded-[32px] border border-slate-200/70 bg-white/85 p-8 shadow-xl shadow-slate-200/40 backdrop-blur lg:block">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30">
              <Icon name="account_balance_wallet" className="h-7 w-7" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">
              Northstar Finance
            </h1>
            <p className="mt-3 max-w-lg text-base leading-7 text-slate-600">
              Controla tus cuentas, deudas y metas en un solo lugar, con un
              diseño claro y pensado para tu teléfono.
            </p>
          </div>
          <div className="rounded-[32px] border border-slate-200/70 bg-white/85 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
