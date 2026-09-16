#!/usr/bin/env node
/**
 * Mide tiempos de carga de las rutas principales contra el sitio real
 * (Vercel), con 3 usuarios de prueba temporales de distinto volumen de
 * datos (vacío / moderado / cargado). Autosuficiente, igual que
 * verify-recurring-cron.mjs: crea sus propios usuarios directo en
 * auth.users, siembra datos vía el service role key (inserts directos,
 * no las RPC — no importa la consistencia contable de saldos para esto,
 * solo el volumen de filas que Dashboard/Reportes/Movimientos tienen que
 * leer y renderizar), mide, y borra todo al final.
 *
 * La sesión para cada usuario se obtiene con @supabase/ssr (la misma
 * librería que usa la app en server.ts/middleware.ts) llamando
 * signInWithPassword() desde este script — nunca tecleando nada en el
 * formulario de login del navegador — así se consigue exactamente la
 * cookie que la app espera, sin adivinar el formato a mano.
 *
 * Uso:
 *   npm run perf:test
 *   (requiere SUPABASE_SERVICE_ROLE_KEY en .env.local, igual que
 *   verify:recurring)
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY. Corre con `npm run perf:test` (carga .env.local)."
  );
  process.exit(1);
}

const PROD_URL = process.env.PERF_TARGET_URL || "https://mi-finc.vercel.app";
const ROUTES = ["/dashboard", "/accounts", "/transactions", "/budgets", "/debts", "/goals", "/reports"];
const ITERATIONS = 3;
const TEST_PASSWORD = "TestPass123!";

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function runSql(sql) {
  const tmpFile = path.join(tmpdir(), `perf-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
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
    gen_random_uuid(), 'authenticated', 'authenticated', '${email}',
    crypt('${TEST_PASSWORD}', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  )
  returning id
)
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), new_user.id,
  jsonb_build_object('sub', new_user.id::text, 'email', '${email}'),
  'email', new_user.id::text, now(), now(), now()
from new_user
returning user_id;
`.trim();
  const out = runSql(sql);
  const parsed = JSON.parse(out);
  return parsed.rows[0].user_id;
}

function deleteTestUser(email) {
  runSql(`delete from auth.users where email = '${email}' returning email;`);
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function getCategories(userId) {
  const { data, error } = await admin.from("categories").select("id, type").eq("user_id", userId);
  if (error) throw error;
  return {
    income: data.filter((c) => c.type === "income").map((c) => c.id),
    expense: data.filter((c) => c.type === "expense").map((c) => c.id),
  };
}

async function seedAccounts(userId, count) {
  const types = ["debit", "savings", "cash", "investment"];
  const rows = Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    name: `Cuenta prueba ${i + 1}`,
    type: types[i % types.length],
    initial_balance: 10000 + i * 1000,
    current_balance: 10000 + i * 1000,
  }));
  const { data, error } = await admin.from("accounts").insert(rows).select("id");
  if (error) throw error;
  return data.map((r) => r.id);
}

async function seedDebts(userId, count) {
  const types = ["credit_card", "loan", "personal"];
  const rows = Array.from({ length: count }, (_, i) => {
    const type = types[i % types.length];
    return {
      user_id: userId,
      name: `Deuda prueba ${i + 1}`,
      type,
      principal: 20000,
      interest_rate: 24,
      minimum_payment: 800,
      current_balance: 15000 + i * 500,
      ...(type === "credit_card"
        ? { credit_limit: 50000, bank_name: "Banco Prueba", cutoff_day: 5, payment_due_day: 20 }
        : { due_day: 10 }),
    };
  });
  const { error } = await admin.from("debts").insert(rows);
  if (error) throw error;
}

async function seedBudgets(userId, count, expenseCategoryIds) {
  const month = new Date().toISOString().slice(0, 7);
  const rows = expenseCategoryIds.slice(0, count).map((category_id) => ({
    user_id: userId,
    category_id,
    month: `${month}-01`,
    amount_limit: 5000,
    alert_threshold_pct: 80,
  }));
  if (rows.length === 0) return;
  const { error } = await admin.from("budgets").insert(rows);
  if (error) throw error;
}

async function seedGoals(userId, count, accountIds) {
  const rows = Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    name: `Meta prueba ${i + 1}`,
    target_amount: 50000,
    current_amount: 10000 + i * 2000,
    target_date: isoDaysAgo(-180),
    account_id: accountIds[i % accountIds.length] ?? null,
  }));
  const { error } = await admin.from("goals").insert(rows);
  if (error) throw error;
}

async function seedTransactions(userId, count, accountIds, categories) {
  const BATCH = 200;
  for (let start = 0; start < count; start += BATCH) {
    const batch = [];
    for (let i = start; i < Math.min(start + BATCH, count); i++) {
      const isExpense = i % 3 !== 0;
      const type = isExpense ? "expense" : "income";
      const categoryPool = isExpense ? categories.expense : categories.income;
      batch.push({
        user_id: userId,
        account_id: accountIds[i % accountIds.length],
        debt_id: null,
        type,
        amount: isExpense ? 50 + (i % 40) * 25 : 2000 + (i % 10) * 500,
        date: isoDaysAgo(i % 365),
        category_id: categoryPool.length > 0 ? categoryPool[i % categoryPool.length] : null,
        tags: [],
        is_recurring: false,
      });
    }
    const { error } = await admin.from("transactions").insert(batch);
    if (error) throw error;
  }
}

async function getSessionCookieHeader(email) {
  const jar = new Map();
  const client = createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => jar.set(name, value));
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw error;
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function measureRoute(cookieHeader, route) {
  const url = `${PROD_URL}${route}`;
  const timings = [];
  let lastStatus = null;
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    const res = await fetch(url, { headers: { Cookie: cookieHeader }, redirect: "manual" });
    const tHeaders = performance.now() - t0;
    await res.arrayBuffer();
    const tTotal = performance.now() - t0;
    lastStatus = res.status;
    timings.push({ tHeaders, tTotal });
  }
  return {
    status: lastStatus,
    minTotalMs: Math.min(...timings.map((t) => t.tTotal)),
    avgTotalMs: timings.reduce((s, t) => s + t.tTotal, 0) / timings.length,
    avgHeadersMs: timings.reduce((s, t) => s + t.tHeaders, 0) / timings.length,
  };
}

const PROFILES = [
  { key: "vacío", email: "carlostrejo771+perf-empty@gmail.com", seed: "empty" },
  { key: "moderado", email: "carlostrejo771+perf-moderate@gmail.com", seed: "moderate" },
  { key: "cargado", email: "carlostrejo771+perf-heavy@gmail.com", seed: "heavy" },
];

async function main() {
  console.log(`Objetivo: ${PROD_URL}\n`);
  const results = [];

  console.log("Preparando usuarios y datos de prueba...");
  for (const profile of PROFILES) {
    try {
      deleteTestUser(profile.email);
    } catch {
      // no había usuario previo
    }
  }

  for (const profile of PROFILES) {
    const userId = createTestUser(profile.email);
    profile.userId = userId;
    console.log(`  ${profile.key}: ${profile.email}`);

    if (profile.seed === "moderate") {
      const accountIds = await seedAccounts(userId, 3);
      const categories = await getCategories(userId);
      await seedDebts(userId, 2);
      await seedBudgets(userId, 3, categories.expense);
      await seedGoals(userId, 2, accountIds);
      await seedTransactions(userId, 60, accountIds, categories);
    } else if (profile.seed === "heavy") {
      const accountIds = await seedAccounts(userId, 5);
      const categories = await getCategories(userId);
      await seedDebts(userId, 4);
      await seedBudgets(userId, 6, categories.expense);
      await seedGoals(userId, 4, accountIds);
      await seedTransactions(userId, 600, accountIds, categories);
    }
  }
  console.log("Datos listos.\n");

  try {
    for (const profile of PROFILES) {
      console.log(`\n${"=".repeat(70)}\nUsuario ${profile.key}\n${"=".repeat(70)}`);
      const cookieHeader = await getSessionCookieHeader(profile.email);
      for (const route of ROUTES) {
        const r = await measureRoute(cookieHeader, route);
        results.push({ profile: profile.key, route, ...r });
        console.log(
          `  ${route.padEnd(15)} status=${r.status}  min=${r.minTotalMs.toFixed(0)}ms  avg=${r.avgTotalMs.toFixed(0)}ms  headers=${r.avgHeadersMs.toFixed(0)}ms  (${ITERATIONS} corridas)`
        );
      }
    }
  } finally {
    console.log("\nLimpiando usuarios y datos de prueba...");
    for (const profile of PROFILES) {
      try {
        deleteTestUser(profile.email);
      } catch (err) {
        console.error(`No se pudo borrar ${profile.email}:`, err.message);
      }
    }
  }

  console.log(`\n${"=".repeat(70)}\nResumen (avg de ${ITERATIONS} corridas, ms)\n${"=".repeat(70)}`);
  const header = `${"ruta".padEnd(15)}${PROFILES.map((p) => p.key.padEnd(12)).join("")}`;
  console.log(header);
  for (const route of ROUTES) {
    const row = PROFILES.map((p) => {
      const r = results.find((x) => x.profile === p.key && x.route === route);
      return (r ? r.avgTotalMs.toFixed(0) : "-").padEnd(12);
    }).join("");
    console.log(`${route.padEnd(15)}${row}`);
  }
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
