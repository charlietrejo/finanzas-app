"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(register, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-xl font-medium text-ink">Crea tu cuenta</h2>

      <div>
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      {state?.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state?.success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{state.success}</p>}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Creando cuenta..." : "Crear cuenta"}
      </Button>

      <p className="mt-2 text-center text-sm text-slate">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-violet-text">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
