import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { blobatar } from "blobatar";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/navigation/nav-links";
import { MobileNavBar } from "@/components/navigation/mobile-nav-bar";
import { RouteFade } from "@/components/navigation/route-fade";
import { IosInstallHint } from "@/components/pwa/ios-install-hint";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";

  // user.id (no email): estable aunque el usuario cambie su correo desde
  // Seguridad (sección 3.7) — el email puede cambiar, el id de Supabase Auth no.
  const avatarDesktop = blobatar(user.id, { size: 36, background: "circle" });
  const avatarMobile = blobatar(user.id, { size: 32, background: "circle" });

  return (
    <div className="flex min-h-screen w-full flex-col bg-cloud md:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-pebble bg-snow p-6 md:flex print:hidden">
        <div>
          <div className="mb-8 flex items-center justify-between">
            <p className="text-xl font-light text-ink">Finanzas</p>
            {/* Sección 3.6.1/3.7 del doc: avatar (blobatar, determinístico
                por user id) en la esquina superior de todas las pantallas —
                abre Cuenta. */}
            <Link
              href="/profile"
              aria-label="Cuenta"
              className="shrink-0 overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
              dangerouslySetInnerHTML={{ __html: avatarDesktop }}
            />
          </div>
          <NavLinks />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-slate">{user.email}</p>
          <ThemeToggle initialTheme={initialTheme} />
        </div>
      </aside>

      <div className="flex flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <header
          className="flex items-center justify-between border-b border-pebble bg-snow px-4 py-4 md:hidden print:hidden"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <p className="text-lg font-light text-ink">Finanzas</p>
          <div className="flex items-center gap-1">
            <ThemeToggle initialTheme={initialTheme} />
            <Link
              href="/profile"
              aria-label="Cuenta"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
            >
              <span className="overflow-hidden rounded-full" dangerouslySetInnerHTML={{ __html: avatarMobile }} />
            </Link>
          </div>
        </header>

        <IosInstallHint />

        <main className="flex-1 px-4 py-6 md:px-10 md:py-10">
          <RouteFade>{children}</RouteFade>
        </main>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 border-t border-pebble bg-snow md:hidden print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <MobileNavBar />
      </div>
    </div>
  );
}
