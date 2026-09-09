import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { NavLinks } from "@/components/navigation/nav-links";
import { IosInstallHint } from "@/components/pwa/ios-install-hint";
import { LogOut } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-cloud md:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-pebble bg-snow p-6 md:flex print:hidden">
        <div>
          <p className="mb-8 text-xl font-light text-ink">Finanzas</p>
          <NavLinks orientation="vertical" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="truncate text-xs text-slate">{user.email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-badge px-4 py-2 text-sm text-slate hover:bg-pebble/40"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header
          className="flex items-center justify-between border-b border-pebble bg-snow px-4 py-4 md:hidden print:hidden"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <p className="text-lg font-light text-ink">Finanzas</p>
          <form action={signOut}>
            <button type="submit" aria-label="Cerrar sesión" className="text-slate">
              <LogOut size={20} />
            </button>
          </form>
        </header>

        <IosInstallHint />

        <main className="flex-1 px-4 py-6 md:px-10 md:py-10">{children}</main>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 border-t border-pebble bg-snow md:hidden print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <NavLinks orientation="horizontal" />
      </div>
    </div>
  );
}
