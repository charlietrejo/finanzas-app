"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword } from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPassword, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-xl font-medium text-ink">Recuperar contraseña</h2>
      <p className="text-sm text-slate">
        Ingresa tu correo y te enviaremos un link para restablecer tu contraseña.
      </p>

      <div>
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      {state?.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{state.success}</p>}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Enviando..." : "Enviar link"}
      </Button>

      <p className="mt-2 text-center text-sm text-slate">
        <Link href="/login" className="font-medium text-violet-text">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
