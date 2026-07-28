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
        <p className="text-sm font-medium text-slate-500">Más</p>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Configuración y preparación móvil</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preparación para PWA</CardTitle>
          <CardDescription>Manifest, metadata iOS, standalone mode y soporte para iPhone.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
          <Settings2 className="h-6 w-6 text-slate-600" />
          <p className="text-sm text-slate-600 dark:text-slate-400">La configuración de instalación en Safari y la experiencia premium se está dejando lista para el siguiente paso.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>Gestión de sesión y acceso seguro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sesión activa para <span className="font-semibold text-slate-900 dark:text-slate-100">{user?.email ?? "tu cuenta"}</span>.
          </p>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
