import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Recuperación</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Recupera tu acceso</h2>
      </div>

      <p className="text-sm leading-6 text-slate-600">
        Te enviaremos un enlace seguro para restablecer tu contraseña.
      </p>

      <AuthForm mode="forgot" />

      <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-slate-950">
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
