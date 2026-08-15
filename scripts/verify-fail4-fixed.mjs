// scripts/verify-fail4-fixed.mjs
// FASE 1 (corregido): valida el trigger 016 tras aplicar la migración.
// Mide por ERROR del trigger (no por el reflejo del SDK).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const env = {};
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) { let k = l.slice(0, i).trim(), v = l.slice(i + 1).trim(); if ((v[0] == '"' && v[v.length - 1] == '"')) v = v.slice(1, -1); env[k] = v; } }
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

  // 1. B crea deuda con account_id de A -> DEBE FALLAR (trigger).
  const t1 = await B.from("debts").insert({ user_id: uidB, name: "B_LINK", type: "LOAN", initial_amount: 0, current_balance: 0, account_id: accA.id }).select().single();
  rec("1. B insert account_id de A", t1.error != null, t1.error ? "rechazado: " + t1.error.message : "ACEPTADO (FAIL)");

  // 2. B modifica deuda B apuntando a account_id de A -> DEBE FALLAR.
  const t2 = await B.from("debts").update({ account_id: accA.id }).eq("id", debtB.id).select().single();
  rec("2. B update debtB -> account_id de A", t2.error != null, t2.error ? "rechazado: " + t2.error.message : "ACEPTADO (FAIL)");

  // 3. A crea deuda con account_id de A -> DEBE FUNCIONAR.
  const t3 = await A.from("debts").insert({ user_id: uidA, name: "A_OWN", type: "LOAN", initial_amount: 0, current_balance: 0, account_id: accA.id }).select().single();
  rec("3. A crea deuda con su cuenta", t3.error == null, t3.error ? "error: " + t3.error.message : "OK id=" + t3.data.id);

  // 4. B crea deuda con account_id de B -> DEBE FUNCIONAR.
  const t4 = await B.from("debts").insert({ user_id: uidB, name: "B_OWN", type: "LOAN", initial_amount: 0, current_balance: 0, account_id: accB.id }).select().single();
  rec("4. B crea deuda con su cuenta", t4.error == null, t4.error ? "error: " + t4.error.message : "OK id=" + t4.data.id);

  // 5. Deuda con account_id NULL -> DEBE FUNCIONAR.
  const t5 = await B.from("debts").insert({ user_id: uidB, name: "B_NULL", type: "LOAN", initial_amount: 0, current_balance: 0 }).select().single();
  rec("5. deuda sin account_id (NULL)", t5.error == null, t5.error ? "error: " + t5.error.message : "OK id=" + t5.data.id);

  // 6. Manipulación de UUID directa: B lee deuda de A -> RLS bloquea.
  const t6 = await B.from("debts").select("*").eq("id", debtA.id);
  rec("6. B lee deuda de A (UUID)", (t6.error != null) || (t6.data && t6.data.length === 0), "bloqueado RLS (" + (t6.error ? t6.error.message : "0 filas") + ")");

  // RLS intacta.
  const rls = await B.from("debts").select("*").eq("user_id", uidA);
  rec("RLS: B no ve deudas de A", (rls.data && rls.data.length === 0), "0 filas");

  // Limpieza
  await A.from("accounts").delete().eq("id", accA.id);
  await B.from("accounts").delete().eq("id", accB.id);
  await A.from("debts").delete().eq("id", debtA.id);
  await B.from("debts").delete().eq("id", debtB.id);
  if (t3.data) await A.from("debts").delete().eq("id", t3.data.id);
  if (t4.data) await B.from("debts").delete().eq("id", t4.data.id);
  if (t5.data) await B.from("debts").delete().eq("id", t5.data.id);
  await A.auth.signOut(); await B.auth.signOut();
  console.log(`\n=== FASE 1 RESULTADO: ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch((e) => { console.error("ERROR:", e.message); process.exit(2); });
