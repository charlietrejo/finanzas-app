import type { Metadata, Viewport } from "next";
import { Poppins, Manrope } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

// Fase 9: script inline bloqueante — el parser HTML lo ejecuta antes de
// pintar nada (por eso va directo en <head>, no como next/script), así que
// fija `data-theme` en <html> sin parpadeo en TODA carga, no solo la
// primera. A propósito NO se resuelve leyendo la cookie desde el Server
// Component de este layout: eso forzaría renderizado dinámico en todas las
// rutas (incluidas /login, /register, la home, etc., hoy estáticas) solo
// para evitar un parpadeo que el script ya evita igual de bien.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var match = document.cookie.match(/(?:^|; )theme=(light|dark)/);
    var theme = match ? match[1] : null;
    if (!theme) {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      document.cookie = "theme=" + theme + ";path=/;max-age=31536000;SameSite=Lax";
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Finanzas personales en MXN, mobile-first.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Northstar",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6161ff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${poppins.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-cloud text-ink font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
