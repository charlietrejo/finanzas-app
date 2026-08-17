"use client";

import { useRouter } from "next/navigation";
import {  LogOut,  Wallet,  Tags,  PiggyBank,  Goal,  ChevronRight, CreditCard,} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/components/ui/card";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const modules = [
  {
    title: "Cuentas",
    description: "Administra tus cuentas",
    icon: Wallet,
    href: "/accounts",
  },
  {
    title: "Categorías",
    description: "Organiza tus movimientos",
    icon: Tags,
    href: "/categories",
  },
  {
    title: "Presupuestos",
    description: "Controla tus límites",
    icon: PiggyBank,
    href: "/budgets",
  },
  {
    title: "Metas",
    description: "Objetivos de ahorro",
    icon: Goal,
    href: "/goals",
  },
  {
  title: "Deudas",
  description: "Tarjetas y préstamos",
  icon: CreditCard,
  href: "/debts",
},
];

  const handleLogout = async () => {
    // Invalidación server-side de la sesión (borra cookies de forma fiable).
    window.location.href = "/auth/signout";
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div>
        <p className="text-sm font-medium text-violet-600">Más</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Configuración y experiencia móvil</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Ajusta tu cuenta, prepara la app para PWA y finaliza la experiencia mobile-first con soporte iOS.
        </p>
      </div>

      <Card>
  <CardHeader>
    <CardTitle>Administración</CardTitle>
    <CardDescription>
      Configura los módulos principales de la aplicación.
    </CardDescription>
  </CardHeader>

  <CardContent className="space-y-3">
    {modules.map((module) => {
      const Icon = module.icon;

      return (
        <button
          key={module.href}
          type="button"
          onClick={() => router.push(module.href)}
          className="flex w-full items-center justify-between rounded-3xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-violet-100 p-3">
              <Icon className="h-5 w-5 text-violet-600" />
            </div>

            <div className="text-left">
              <p className="font-semibold">{module.title}</p>
              <p className="text-sm text-slate-500">
                {module.description}
              </p>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-slate-400" />
        </button>
      );
    })}
  </CardContent>
</Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Cuenta</CardTitle>
            <CardDescription>Gestión de sesión y acceso seguro.</CardDescription>
          </div>
          <LogOut className="h-6 w-6 text-slate-500" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Usuario</p>
            <p className="text-base font-semibold text-slate-900">{user?.email ?? "tu cuenta"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


