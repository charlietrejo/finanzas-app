"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";

type AuthFormMode = "login" | "register" | "forgot";

export function AuthForm({ mode }: { mode: AuthFormMode }) {
  const router = useRouter();
  const { signIn, signUp, resetPassword, resendConfirmation, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const response = await signIn(email, password);
        if (response.error) {
          setError(response.error.message);
          return;
        }
        // No navegamos de inmediato: esperamos a que AuthProvider confirme la
        // sesión (user) para evitar una carrera con AuthGuard en Safari/iOS.
        setPendingRedirect(true);
        return;
      }

      if (mode === "register") {
        const response = await signUp(email, password, fullName);
        if (response.error) {
          setError(response.error.message);
          return;
        }
        setSuccess(
          "Cuenta creada. Revisa tu correo para confirmar tu cuenta. Si no recibes el mensaje, revisa spam o solicita reenviar.",
        );
        return;
      }

      const response = await resetPassword(email);
      if (response.error) {
        setError(response.error.message);
        return;
      }
      setSuccess("Se ha enviado el enlace para restablecer tu contraseña.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setError("Escribe tu correo antes de reenviar el enlace.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await resendConfirmation(email);
      if (response.error) {
        setError(response.error.message);
        return;
      }
      setSuccess("Se ha reenviado un enlace seguro a tu correo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pendingRedirect && user) {
      router.replace("/dashboard");
    }
  }, [pendingRedirect, user, router]);

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {mode === "register" && (
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-700">
          <UserRound className="h-5 w-5" />
          <input
            autoComplete="name"
            className="w-full bg-transparent text-base placeholder:text-slate-400 outline-none"
            placeholder="Nombre completo"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
      )}

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-700">
        <Mail className="h-5 w-5" />
        <input
          type="email"
          autoComplete="email"
          className="w-full bg-transparent text-base placeholder:text-slate-400 outline-none"
          placeholder="Correo electrónico"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      {mode !== "forgot" && (
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-700">
          <Lock className="h-5 w-5" />
          <input
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className="w-full bg-transparent text-base placeholder:text-slate-400 outline-none"
            placeholder="Contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required={mode === "login" || mode === "register"}
            minLength={6}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-emerald-600">
          {success}
        </p>
      )}

      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Procesando..." : mode === "login" ? "Entrar" : mode === "register" ? "Crear cuenta" : "Enviar enlace"}
        <ArrowRight className="h-4 w-4" />
      </Button>

      {mode === "register" && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p>
            Si no recibes el correo de confirmación, pulsa el botón para reenviarlo. También revisa la carpeta de spam.
          </p>
          <Button type="button" variant="secondary" className="w-full" disabled={loading || !email.trim()} onClick={handleResendConfirmation}>
            Reenviar enlace de acceso
          </Button>
        </div>
      )}
    </form>
  );
}
