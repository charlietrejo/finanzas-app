import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Registro</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Crea tu cuenta</h2>
      </div>

      <AuthForm mode="register" />

      <p className="text-sm text-slate-500">
        Ya tienes cuenta?{' '}
        <Link href="/login" className="font-semibold text-slate-800">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
