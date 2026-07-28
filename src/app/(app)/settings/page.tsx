"use client";

import { useRouter } from "next/navigation";
import { LogOut, Settings2 } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div>
        <p className="text-sm font-medium text-violet-600">Más</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Configuración y experiencia móvil</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Ajusta tu cuenta, prepara la app para PWA y finaliza la experiencia mobile-first con soporte iOS.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Preparación para PWA</CardTitle>
            <CardDescription>Manifest, metadata iOS, standalone mode y soporte para iPhone.</CardDescription>
          </div>
          <Settings2 className="h-6 w-6 text-violet-600" />
        </CardHeader>
        <CardContent className="grid gap-4 rounded-[28px] bg-violet-50/80 p-6 text-slate-700 dark:bg-violet-950/70 dark:text-slate-200">
          <div className="space-y-2">
            <p className="text-sm font-medium">Instalación nativa y navegación segura</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ya está configurado para que la app pueda instalarse en Safari y desplegarse con un look nativo en iOS.
            </p>
          </div>
          <div className="rounded-3xl border border-violet-200/70 bg-white/90 p-4 dark:border-violet-800 dark:bg-slate-900/80">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">Soporte iPhone</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Evitar zoom automático, viewport adaptado y manifest listo.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Cuenta</CardTitle>
            <CardDescription>Gestión de sesión y acceso seguro.</CardDescription>
          </div>
          <LogOut className="h-6 w-6 text-slate-500 dark:text-slate-300" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/80">
            <p className="text-sm text-slate-600 dark:text-slate-400">Usuario</p>
            <p className="text-base font-semibold text-slate-950 dark:text-white">{user?.email ?? "tu cuenta"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Volver al panel
            </Button>
            <Button variant="secondary" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
