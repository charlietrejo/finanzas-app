#!/usr/bin/env node
/**
 * Orquesta los scripts de verificación de integración (scripts/verify-*.mjs,
 * excepto este mismo) en un solo comando: crea dos usuarios de prueba
 * temporales directo por SQL (mismo mecanismo usado desde Fase 3 para
 * evitar el rate-limit de envío de correo de Supabase), corre cada script
 * como subproceso, imprime un resumen final, y borra ambos usuarios al
 * terminar (incluso si algo falla a medio camino).
 *
 * Requiere: la CLI de Supabase ya vinculada (`supabase link`, ya hecho en
 * este proyecto) y disponible en el PATH.
 *
 * Uso:
 *   npm run verify:all
 *   (o) node --env-file=.env.local scripts/verify-all.mjs
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Corre con `npm run verify:all` (carga .env.local) o expórtalas a mano."
  );
  process.exit(1);
}

const TEST_PASSWORD = "TestPass123!";
const EMAIL_A = "carlostrejo771+verifyall-a@gmail.com";
const EMAIL_B = "carlostrejo771+verifyall-b@gmail.com";

function runSql(sql) {
  // Se escribe a un archivo temporal y se usa --file en vez de pasar el SQL
  // como argumento: en Windows, invocar la CLI (un shim .cmd) requiere
  // shell:true, y un SQL largo con comillas anidadas no sobrevive intacto
  // el re-parseo de cmd.exe como argumento de línea de comandos.
  const tmpFile = path.join(tmpdir(), `verify-all-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(tmpFile, sql, "utf-8");
  try {
    return execFileSync("supabase", ["db", "query", "--linked", "--file", tmpFile], {
      encoding: "utf-8",
      shell: true,
    });
  } finally {
    unlinkSync(tmpFile);
  }
}

function deleteTestUsers() {
  runSql(
    `delete from auth.users where email in ('${EMAIL_A}', '${EMAIL_B}') returning email;`
  );
}

function createTestUser(email) {
  const sql = `
with new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    '${email}',
    crypt('${TEST_PASSWORD}', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(), now(), '', '', '', ''
  )
  returning id, email
)
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), new_user.id,
  jsonb_build_object('sub', new_user.id::text, 'email', new_user.email),
  'email', new_user.id::text, now(), now(), now()
from new_user
returning user_id;
`.trim();
  runSql(sql);
}

const SUITES = [
  { name: "verify-transaction-rpc.mjs", env: () => ({ TEST_USER_EMAIL: EMAIL_A, TEST_USER_PASSWORD: TEST_PASSWORD }) },
  { name: "verify-budgets.mjs", env: () => ({ TEST_USER_EMAIL: EMAIL_A, TEST_USER_PASSWORD: TEST_PASSWORD }) },
  { name: "verify-debt-payment-rpc.mjs", env: () => ({ TEST_USER_EMAIL: EMAIL_A, TEST_USER_PASSWORD: TEST_PASSWORD }) },
  { name: "verify-goal-contribution-rpc.mjs", env: () => ({ TEST_USER_EMAIL: EMAIL_A, TEST_USER_PASSWORD: TEST_PASSWORD }) },
  { name: "verify-reports-data.mjs", env: () => ({ TEST_USER_EMAIL: EMAIL_A, TEST_USER_PASSWORD: TEST_PASSWORD }) },
  { name: "verify-loans-given.mjs", env: () => ({ TEST_USER_EMAIL: EMAIL_A, TEST_USER_PASSWORD: TEST_PASSWORD }) },
  {
    name: "verify-account-balance-adjustment.mjs",
    env: () => ({ TEST_USER_EMAIL: EMAIL_A, TEST_USER_PASSWORD: TEST_PASSWORD }),
  },
  {
    name: "verify-confirm-recurring-occurrence.mjs",
    env: () => ({ TEST_USER_EMAIL: EMAIL_A, TEST_USER_PASSWORD: TEST_PASSWORD }),
  },
  {
    name: "verify-cross-user-isolation.mjs",
    env: () => ({
      USER_A_EMAIL: EMAIL_A,
      USER_A_PASSWORD: TEST_PASSWORD,
      USER_B_EMAIL: EMAIL_B,
      USER_B_PASSWORD: TEST_PASSWORD,
    }),
  },
  // Autosuficiente (crea y borra su propio usuario de prueba) — no usa
  // EMAIL_A/EMAIL_B. Requiere SUPABASE_SERVICE_ROLE_KEY (Fase 8: la RPC que
  // prueba es security definer, solo invocable con ese rol).
  { name: "verify-recurring-cron.mjs", env: () => ({}) },
  // Autosuficiente por el mismo motivo: necesita el service role key para
  // simular al cron (generate_recurring_occurrence) además de un cliente
  // autenticado normal.
  { name: "verify-stop-recurring-template.mjs", env: () => ({}) },
  // Autosuficiente (crea y borra su propio usuario) — no necesita service
  // role: confirm_recurring_occurrence/delete_transaction son security invoker.
  { name: "verify-delete-single-occurrence.mjs", env: () => ({}) },
];

async function main() {
  console.log("Preparando usuarios de prueba temporales...");
  try {
    deleteTestUsers();
  } catch {
    // no había usuarios previos, no pasa nada
  }
  createTestUser(EMAIL_A);
  createTestUser(EMAIL_B);
  console.log(`Usuarios listos: ${EMAIL_A}, ${EMAIL_B}\n`);

  const results = [];

  try {
    for (const suite of SUITES) {
      console.log(`\n${"=".repeat(60)}\n${suite.name}\n${"=".repeat(60)}`);
      const scriptPath = path.join(__dirname, suite.name);
      try {
        execFileSync(process.execPath, [scriptPath], {
          env: { ...process.env, ...suite.env() },
          stdio: "inherit",
        });
        results.push({ name: suite.name, ok: true });
      } catch {
        results.push({ name: suite.name, ok: false });
      }
    }
  } finally {
    console.log("\nLimpiando usuarios de prueba temporales...");
    try {
      deleteTestUsers();
    } catch (err) {
      console.error("No se pudieron borrar los usuarios de prueba:", err.message);
    }
  }

  console.log(`\n${"=".repeat(60)}\nResumen\n${"=".repeat(60)}`);
  for (const r of results) {
    console.log(`${r.ok ? "  OK  " : "FALLO "} ${r.name}`);
  }
  const failedCount = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failedCount}/${results.length} scripts pasaron.`);
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
