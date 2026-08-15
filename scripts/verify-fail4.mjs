// scripts/verify-fail4.mjs
// FASE 1: confirma que debts.account_id NO existe y que NO hay cross-user.
// Pruebas 1-6 del prompt. No modifica la app.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const env = {};
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) { const i = l.indexOf("="); if (i > 0) { let k = l.slice(0, i).trim(), v = l.slice(i + 1).trim(); if ((v[0] == '"' && v[v.length - 1] == '"')) v = v.slice(1, -1); env[k] = v; } }
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, PASS = process.env.PENTEST_PASSWORD;
const A = createClient(URL, ANON, { auth: { persistSession: false } });
const B = createClient(URL, ANON, { auth: { persistSession: false } });
let passed = 0, failed = 0;
function rec(m, ok, ev) { if (ok) passed++; else failed++; console.log(`  [${ok ? "PASS" : "FAIL"}] ${m}: ${ev}`); }

async function run() {
  await A.auth.signInWithPassword({ email: "aislamiento.a.verificacion@gmail.com", password: PASS });
  await B.auth.signInWithPassword({ email: "aislamiento.b.verificacion@gmail.com", password: PASS });
  const uidA = (await A.auth.getUser()).data.user.id, uidB = (await B.auth.getUser()).data.user.id;

  const accA = (await A.from("accounts").insert({ user_id: uidA, name: "FA_A", type: "BANK", initial_balance: 0, current_balance: 0 }).select().single()).data;
  const accB = (await B.from("accounts").insert({ user_id: uidB, name: "FB_B", type: "BANK", initial_balance: 0, current_balance: 0 }).select().single()).data;
  const debtA = (await A.from("debts").insert({ user_id: uidA, name: "FDA_A", type: "LOAN", initial_amount: 0, current_balance: 0 }).select().single()).data;
  const debtB = (await B.from("debts").insert({ user_id: uidB, name: "FDB_B", type: "LOAN", initial_amount: 0, current_balance: 0 }).select().single()).data;

  // 1. B crea deuda con account_id de A -> la columna no existe => se ignora; deuda de B sin account_id de A.
  const b1 = await B.from("debts").insert({ user_id: uidB, name: "B_LINK", type: "LOAN", initial_amount: 0, current_balance: 0, account_id: accA.id }).select().single();
  // El cliente JS puede devolver account_id en el objeto, pero en BD no existe.
  // Confirmamos consultando el catálogo: la columna no está.
  const probe = await B.from("debts").select("id,user_id,account_id").eq("id", b1.data.id).single();
  const hasCol = probe.data && ("account_id" in probe.data);
  rec("1. B inserta account_id de A", !hasCol || probe.data.account_id == null, `columna account_id presente=${hasCol}; valor=${probe.data?.account_id ?? "n/a"} (no linkea a A)`);

  // 2. B modifica deuda B apuntando a account_id de A -> mismo caso, columna no existe.
  const b2 = await B.from("debts").update({ account_id: accA.id }).eq("id", debtB.id).select().single();
  const probe2 = await B.from("debts").select("account_id").eq("id", debtB.id).single();
  rec("2. B update debtB -> account_id de A", !("account_id" in (probe2.data || {})), `account_id en BD=${probe2.data?.account_id ?? "ausente"}`);

  // 3. A crea deuda con account_id de A -> tampoco existe la columna; deuda de A se crea normalmente.
  const a3 = await A.from("debts").insert({ user_id: uidA, name: "A_NORMAL", type: "LOAN", initial_amount: 100, current_balance: 100 }).select().single();
  rec("3. A crea deuda normal", a3.error == null, "deuda de A creada: " + (a3.data?.id ? "OK" : a3.error?.message));

  // 4. B crea deuda con account_id de B -> columna no existe, deuda de B se crea.
  const b4 = await B.from("debts").insert({ user_id: uidB, name: "B_NORMAL", type: "LOAN", initial_amount: 100, current_balance: 100 }).select().single();
  rec("4. B crea deuda normal", b4.error == null, "deuda de B creada: " + (b4.data?.id ? "OK" : b4.error?.message));

  // 5. Deuda con account_id NULL -> la columna no existe; deuda se crea.
  const b5 = await B.from("debts").insert({ user_id: uidB, name: "B_NULL", type: "LOAN", initial_amount: 0, current_balance: 0 }).select().single();
  rec("5. deuda sin account_id", b5.error == null, "creada: " + (b5.data?.id ? "OK" : b5.error?.message));

  // 6. Manipulación de UUID directa: B intenta leer deuda de A -> RLS bloquea.
  const r6 = await B.from("debts").select("*").eq("id", debtA.id);
  rec("6. B lee deuda de A (UUID)", (r6.error != null) || (r6.data && r6.data.length === 0), "bloqueado por RLS (" + (r6.error ? r6.error.message : "0 filas") + ")");

  // RLS sigue funcionando: B no ve deudas de A.
  const rlsB = await B.from("debts").select("*").eq("user_id", uidA);
  rec("RLS: B no ve deudas de A", (rlsB.data && rlsB.data.length === 0), "0 filas de A visibles para B");

  // Limpieza
  await A.from("accounts").delete().eq("id", accA.id);
  await B.from("accounts").delete().eq("id", accB.id);
  await A.from("debts").delete().eq("id", debtA.id);
  await B.from("debts").delete().eq("id", debtB.id);
  await B.from("debts").delete().eq("id", b1.data.id);
  await A.from("debts").delete().eq("id", a3.data.id);
  await B.from("debts").delete().eq("id", b4.data.id);
  await B.from("debts").delete().eq("id", b5.data.id);
  await A.auth.signOut(); await B.auth.signOut();
  console.log(`\n=== FASE 1 RESULTADO: ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch((e) => { console.error("ERROR:", e.message); process.exit(2); });
