"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { resetPassword } from "../actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPassword, null);
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "invalid");
    });
  }, []);

  if (status === "checking") {
    return <p className="text-sm text-slate">Verificando tu link...</p>;
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h2 className="text-xl font-medium text-ink">Link inválido o expirado</h2>
        <p className="text-sm text-slate">
          Solicita un nuevo link para restablecer tu contraseña.
        </p>
        <Link href="/forgot-password" className="font-medium text-violet-text">
          Solicitar nuevo link
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-xl font-medium text-ink">Elige una nueva contraseña</h2>

      <div>
        <Label htmlFor="password">Nueva contraseña</Label>
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

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Guardando..." : "Guardar contraseña"}
      </Button>
    </form>
  );
}
