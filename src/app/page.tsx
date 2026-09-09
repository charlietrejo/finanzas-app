import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-cloud px-4 text-center">
      <div>
        <h1 className="text-4xl font-light tracking-tight text-ink md:text-5xl">
          Finanzas
        </h1>
        <p className="mt-3 text-slate">
          Tus finanzas personales en pesos mexicanos, sin costo.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/login">
          <Button variant="outline">Iniciar sesión</Button>
        </Link>
        <Link href="/register">
          <Button>Crear cuenta</Button>
        </Link>
      </div>
    </main>
  );
}
