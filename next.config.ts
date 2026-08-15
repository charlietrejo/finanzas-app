import type { NextConfig } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isProd = process.env.NODE_ENV === "production";

// Extrae el host (sin protocolo) para usar en connect-src / img-src.
// Ej: https://xxxx.supabase.co -> xxxx.supabase.co
const SUPABASE_HOST = SUPABASE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async headers() {
    // Política de seguridad de contenido.
    // - script-src: Solo bundles propios ('self'). Next 16 + React 19 + Supabase
    //   JS no requieren 'unsafe-eval'. En DESARROLLO, Next/Turbopack inyecta un
    //   script inline para el HMR/React Refresh, por lo que se permite
    //   'unsafe-inline' solo en dev (en producción basta 'self').
    // - style-src: 'unsafe-inline' es necesario para Tailwind v4 (inyecta estilos)
    //   y Material Icons; NO se usa 'unsafe-inline' en script-src en producción.
    // - connect-src: permite la API REST/Auth de Supabase y su canal Realtime
    //   (wss). En desarrollo también se permite localhost para el HMR de Next.
    const connectSources = ["'self'", `https://${SUPABASE_HOST}`, `wss://${SUPABASE_HOST}`];
    if (!isProd) {
      connectSources.push("http://localhost:*", "ws://localhost:*");
    }

    // En DESARROLLO, React 19 requiere 'unsafe-eval' para sus utilidades de
    // debugging (reconstrucción de callstacks de errores). En PRODUCCIÓN React
    // nunca usa eval(), por lo que el CSP queda estricto solo con 'self'
    // (cumple el requisito de seguridad sin relajar producción).
    const scriptSources = isProd ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];

    const csp = [
      "default-src 'self'",
      `connect-src ${connectSources.join(" ")}`,
      `script-src ${scriptSources.join(" ")}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `img-src 'self' data: https://fonts.gstatic.com https://${SUPABASE_HOST}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    // Headers base de seguridad (se aplican en dev y prod).
    const securityHeaders: Record<string, string> = {
      "Content-Security-Policy": csp,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      "Cross-Origin-Opener-Policy": "same-origin",
    };

    // HSTS solo en producción/HTTPS para no bloquear localhost en desarrollo.
    if (isProd) {
      securityHeaders["Strict-Transport-Security"] =
        "max-age=63072000; includeSubDomains; preload";
    }

    return [
      {
        source: "/:path*",
        headers: Object.entries(securityHeaders).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
};

export default nextConfig;
