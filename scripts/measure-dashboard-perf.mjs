// Mide el rendimiento real del Dashboard ya autenticado en producción.
//
// Uso (PowerShell), sin escribir credenciales en ningún archivo:
//   $env:TEST_EMAIL = "tu-email-de-prueba@ejemplo.com"
//   $env:TEST_PASSWORD = "tu-password"
//   node scripts/measure-dashboard-perf.mjs
//   Remove-Item Env:\TEST_EMAIL, Env:\TEST_PASSWORD
//
// Uso (bash):
//   TEST_EMAIL=... TEST_PASSWORD=... node scripts/measure-dashboard-perf.mjs
//
// Las credenciales solo viven en memoria del proceso (process.env) para
// tipearlas en el formulario de login. Nunca se hacen console.log, nunca se
// escriben a disco. El reporte de Lighthouse se guarda fuera del repo, en el
// directorio temporal del sistema.

import puppeteer from "puppeteer";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const BASE_URL = "https://mi-finc.vercel.app";
const LOGIN_URL = `${BASE_URL}/login`;

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

if (!email || !password) {
  console.error(
    "Faltan TEST_EMAIL y/o TEST_PASSWORD en el entorno. Definelas como variables de entorno " +
      "antes de correr este script (no las pases como argumento ni las guardes en un archivo)."
  );
  process.exit(1);
}

async function login(page) {
  await page.goto(LOGIN_URL, { waitUntil: "networkidle0" });

  await page.waitForSelector("#email", { visible: true });
  await page.type("#email", email);
  await page.type("#password", password);

  await page.click('button[type="submit"]');

  // El login usa un Server Action de Next.js: la redirección a /dashboard
  // llega como una transición del router de la app (History API), no como
  // una navegación de documento completo, así que no hay evento de
  // navegación que esperar — se hace polling de la URL en su lugar.
  try {
    await page.waitForFunction(() => !location.pathname.startsWith("/login"), {
      timeout: 30000,
    });
  } catch {
    const formError = await page
      .$eval('[role="alert"]', (el) => el.textContent?.trim())
      .catch(() => null);
    throw new Error(
      formError
        ? `El login no salió de /login. Mensaje del formulario: "${formError}"`
        : "El login no salió de /login después de 30s y el formulario no mostró ningún mensaje de error " +
            "(puede ser un problema de red/selector, no de credenciales)."
    );
  }

  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
}

async function waitForDashboard(page) {
  if (!page.url().startsWith(`${BASE_URL}/dashboard`)) {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle0" });
  }

  await page.waitForFunction(
    () => {
      const h1 = document.querySelector("h1");
      return !!h1 && h1.textContent?.trim() === "Dashboard";
    },
    { timeout: 30000 }
  );

  // deja asentar animaciones/hydration antes de medir
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function runLighthouse(port, url) {
  const { default: lighthouseFn } = await import("lighthouse");
  const result = await lighthouseFn(url, {
    port,
    output: "json",
    onlyCategories: ["performance"],
    logLevel: "error",
  }, {
    extends: "lighthouse:default",
    settings: {
      // clave: no borra cookies/localStorage/cache antes de auditar,
      // para reutilizar la sesión ya autenticada.
      disableStorageReset: true,
      onlyCategories: ["performance"],
      formFactor: "desktop",
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
        disabled: false,
      },
      throttling: {
        rttMs: 40,
        throughputKbps: 10 * 1024,
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0,
      },
    },
  });

  return result;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--remote-debugging-port=9222", "--window-size=1350,940"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1350, height: 940 });

    console.log("Iniciando sesión...");
    await login(page);

    console.log("Esperando a que el Dashboard cargue por completo...");
    await waitForDashboard(page);

    const dashboardUrl = page.url();
    const port = new URL(browser.wsEndpoint()).port;

    console.log(`Corriendo Lighthouse sobre ${dashboardUrl} (sesión autenticada reutilizada)...`);
    const { lhr, report } = await runLighthouse(Number(port), dashboardUrl);

    const perfScore = Math.round((lhr.categories.performance.score ?? 0) * 100);
    const lcp = lhr.audits["largest-contentful-paint"];
    const ttfb = lhr.audits["server-response-time"];
    const tbt = lhr.audits["total-blocking-time"];

    console.log("\n=== Resultado Lighthouse — Dashboard autenticado ===");
    console.log(`Performance Score: ${perfScore}/100`);
    console.log(`LCP:  ${lcp.displayValue} (${Math.round(lcp.numericValue)} ms)`);
    console.log(`TTFB: ${ttfb ? ttfb.displayValue : "N/D"} (${ttfb ? Math.round(ttfb.numericValue) : "N/D"} ms)`);
    console.log(`TBT:  ${tbt.displayValue} (${Math.round(tbt.numericValue)} ms)`);

    const outDir = path.join(os.tmpdir(), "mi-finc-lighthouse");
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, `dashboard-report-${Date.now()}.json`);
    await fs.writeFile(outPath, Array.isArray(report) ? report[0] : report, "utf-8");
    console.log(`\nReporte completo (fuera del repo): ${outPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
