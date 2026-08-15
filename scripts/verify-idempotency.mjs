// scripts/verify-idempotency.mjs
// FASE 9: valida idempotency_key en transactions (migración 017).
// Cada sub-prueba de saldo usa su PROPIA cuenta fresca para asserts deterministas.
// La columna es uuid => usamos crypto.randomUUID() (igual que la app).
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const env = {};
for (const l of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) { let k = l.slice(0, i).trim(), v = l.slice(i + 1).trim(); if ((v[0] == '"' && v[v.length - 1] == '"')) v = v.slice(1, -1); env[k] = v; } }
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, PASS = process.env.PENTEST_PASSWORD;
const A = createClient(URL, ANON, { auth: { persistSession: false } });
const B = createClient(URL, ANON, { auth: { persistSession: false } });
const norm = (v) => Number(v ?? 0);
let passed = 0, failed = 0;
function rec(m, ok, ev) { if (ok) passed++; else failed++; console.log(`  [${ok ? "PASS" : "FAIL"}] ${m}: ${ev}`); }

async function createWithKey(client, uid, payload, key) {
  const { data, error } = await client.from("transactions").insert({
    user_id: uid, account_id: payload.accountId, type: payload.type, amount: payload.amount,
    description: "IDE", transaction_date: "2026-01-01",
    debt_id: payload.debtId ?? null, destination_account_id: payload.destinationAccountId ?? null,
    idempotency_key: key,
  }).select().single();
  if (error) {
    if (error.code === "23505" && key) {
      const { data: ex } = await client.from("transactions").select("*").eq("user_id", uid).eq("idempotency_key", key).single();
      return { data: ex, idempotent: true };
    }
    return { error };
  }
  await client.rpc("apply_transaction_effect", { p_action: "apply", p_id: data.id, p_user_id: uid, p_account_id: payload.accountId, p_type: payload.type, p_amount: payload.amount, p_debt_id: payload.debtId ?? null, p_destination_account_id: payload.destinationAccountId ?? null });
  return { data };
}
async function bal(client, id, kind) { const t = kind === "acc" ? "accounts" : "debts"; const { data } = await client.from(t).select("current_balance").eq("id", id).single(); return norm(data.current_balance); }
async function acc(uid, client, bal0) { return (await client.from("accounts").insert({ user_id: uid, name: "IDE_" + randomUUID().slice(0, 8), type: "BANK", initial_balance: bal0, current_balance: bal0 }).select().single()).data; }
async function loan(uid, client, bal0) { return (await client.from("debts").insert({ user_id: uid, name: "IDE_" + randomUUID().slice(0, 8), type: "LOAN", initial_amount: bal0, current_balance: bal0 }).select().single()).data; }
async function card(uid, client) { const d = (await client.from("debts").insert({ user_id: uid, name: "IDE_" + randomUUID().slice(0, 8), type: "CREDIT_CARD", initial_amount: 5000, current_balance: 0 }).select().single()).data; const a = (await client.from("accounts").insert({ user_id: uid, name: "IDE_" + randomUUID().slice(0, 8), type: "CREDIT_CARD", initial_balance: 0, current_balance: 0, debt_id: d.id }).select().single()).data; return { d, a }; }

async function cleanupAll() {
  for (const c of [A, B]) {
    const tx = (await c.from("transactions").select("id").like("description", "IDE%")).data || [];
    if (tx.length) await c.from("transactions").delete().in("id", tx.map((x) => x.id));
    const ac = (await c.from("accounts").select("id").like("name", "IDE%")).data || [];
    if (ac.length) await c.from("accounts").delete().in("id", ac.map((x) => x.id));
    const de = (await c.from("debts").select("id").like("name", "IDE%")).data || [];
    if (de.length) await c.from("debts").delete().in("id", de.map((x) => x.id));
  }
}

async function run() {
  await A.auth.signInWithPassword({ email: "aislamiento.a.verificacion@gmail.com", password: PASS });
  await B.auth.signInWithPassword({ email: "aislamiento.b.verificacion@gmail.com", password: PASS });
  await cleanupAll();
  const uidA = (await A.auth.getUser()).data.user.id, uidB = (await B.auth.getUser()).data.user.id;

  // 1. Crear normal
  const a1 = await acc(uidA, A, 10000);
  const k1 = randomUUID();
  const r1 = await createWithKey(A, uidA, { accountId: a1.id, type: "INCOME", amount: 100 }, k1);
  rec("1. crear normal", r1.data && !r1.idempotent, "fila creada id=" + r1.data?.id);

  // 2. Misma key => no duplica
  const r2 = await createWithKey(A, uidA, { accountId: a1.id, type: "INCOME", amount: 100 }, k1);
  rec("2. misma key no duplica", r2.idempotent === true, "recuperada sin apply (idempotent=" + r2.idempotent + ")");
  const cnt = (await A.from("transactions").select("*").eq("idempotency_key", k1)).data.length;
  rec("2b. 1 sola fila", cnt === 1, "filas con key=" + cnt);
  rec("2c. saldo no duplicado", (await bal(A, a1.id, "acc")) === 10100, "saldo=" + (await bal(A, a1.id, "acc")) + " (esperado 10100)");

  // 3. Dos requests concurrentes misma key
  const a3 = await acc(uidA, A, 10000);
  const k3 = randomUUID();
  const [c1, c2] = await Promise.all([
    createWithKey(A, uidA, { accountId: a3.id, type: "INCOME", amount: 100 }, k3),
    createWithKey(A, uidA, { accountId: a3.id, type: "INCOME", amount: 100 }, k3),
  ]);
  const applied3 = [c1, c2].filter((x) => x.data && !x.idempotent).length;
  rec("3. concurrencia misma key", applied3 === 1, "aplicadas=" + applied3 + " (1 sola)");
  rec("3b. saldo concurrente", (await bal(A, a3.id, "acc")) === 10100, "saldo=" + (await bal(A, a3.id, "acc")));

  // 4. Diferente key => nueva
  const k4 = randomUUID();
  const r4 = await createWithKey(A, uidA, { accountId: a1.id, type: "INCOME", amount: 50 }, k4);
  rec("4. key distinta crea nueva", r4.data && !r4.idempotent, "nueva fila id=" + r4.data?.id);
  rec("4b. saldo suma", (await bal(A, a1.id, "acc")) === 10150, "saldo=" + (await bal(A, a1.id, "acc")));

  // 5. A y B misma key => independientes
  const a5a = await acc(uidA, A, 10000);
  const a5b = await acc(uidB, B, 10000);
  const k5 = randomUUID();
  const a5 = await createWithKey(A, uidA, { accountId: a5a.id, type: "INCOME", amount: 100 }, k5);
  const b5 = await createWithKey(B, uidB, { accountId: a5b.id, type: "INCOME", amount: 100 }, k5);
  rec("5. A y B misma key independientes", a5.data && b5.data && !a5.idempotent && !b5.idempotent, "A=" + (a5.data?.id ? "ok" : "fail") + " B=" + (b5.data?.id ? "ok" : "fail"));
  rec("5b. B no recupera fila de A", (await bal(A, a5a.id, "acc")) === 10100 && (await bal(B, a5b.id, "acc")) === 10100, "A=" + (await bal(A, a5a.id, "acc")) + " B=" + (await bal(B, a5b.id, "acc")));

  // 6. DEBT_PAYMENT duplicado
  const dAcc6 = await acc(uidA, A, 10000);
  const dDebt6 = await loan(uidA, A, 20000);
  const k6 = randomUUID();
  const dp1 = await createWithKey(A, uidA, { accountId: dAcc6.id, type: "DEBT_PAYMENT", amount: 3000, debtId: dDebt6.id }, k6);
  const dp2 = await createWithKey(A, uidA, { accountId: dAcc6.id, type: "DEBT_PAYMENT", amount: 3000, debtId: dDebt6.id }, k6);
  rec("6. DEBT_PAYMENT duplicado", dp1.data && dp2.idempotent, "dp2 idempotent=" + dp2.idempotent);
  rec("6b. saldos DP", (await bal(A, dAcc6.id, "acc")) === 7000 && (await bal(A, dDebt6.id, "debt")) === 17000, "cuenta=" + (await bal(A, dAcc6.id, "acc")) + " deuda=" + (await bal(A, dDebt6.id, "debt")) + " (7000/17000)");

  // 7. EXPENSE duplicado (tarjeta)
  const c7 = await card(uidA, A);
  const k7 = randomUUID();
  const e1 = await createWithKey(A, uidA, { accountId: c7.a.id, type: "EXPENSE", amount: 1000, debtId: c7.d.id }, k7);
  const e2 = await createWithKey(A, uidA, { accountId: c7.a.id, type: "EXPENSE", amount: 1000, debtId: c7.d.id }, k7);
  rec("7. EXPENSE duplicado", e1.data && e2.idempotent, "e2 idempotent=" + e2.idempotent);
  rec("7b. saldo tarjeta", (await bal(A, c7.d.id, "debt")) === 1000, "deuda tarjeta=" + (await bal(A, c7.d.id, "debt")) + " (1000)");

  // 8. INCOME duplicado
  const a8 = await acc(uidA, A, 10000);
  const k8 = randomUUID();
  const i1 = await createWithKey(A, uidA, { accountId: a8.id, type: "INCOME", amount: 500 }, k8);
  const i2 = await createWithKey(A, uidA, { accountId: a8.id, type: "INCOME", amount: 500 }, k8);
  rec("8. INCOME duplicado", i1.data && i2.idempotent, "i2 idempotent=" + i2.idempotent);
  rec("8b. saldo INCOME", (await bal(A, a8.id, "acc")) === 10500, "saldo=" + (await bal(A, a8.id, "acc")) + " (10500)");

  // 9. TRANSFER duplicado
  const src9 = await acc(uidA, A, 10000);
  const dst9 = await acc(uidA, A, 2000);
  const k9 = randomUUID();
  const t1 = await createWithKey(A, uidA, { accountId: src9.id, type: "TRANSFER", amount: 1000, destinationAccountId: dst9.id }, k9);
  const t2 = await createWithKey(A, uidA, { accountId: src9.id, type: "TRANSFER", amount: 1000, destinationAccountId: dst9.id }, k9);
  rec("9. TRANSFER duplicado", t1.data && t2.idempotent, "t2 idempotent=" + t2.idempotent);
  rec("9b. saldos transfer", (await bal(A, src9.id, "acc")) === 9000 && (await bal(A, dst9.id, "acc")) === 3000, "origen=" + (await bal(A, src9.id, "acc")) + " destino=" + (await bal(A, dst9.id, "acc")) + " (9000/3000)");

  // 10. UPDATE tras crear (revert -> update -> apply)
  const u10 = await acc(uidA, A, 10000);
  const uTx = (await createWithKey(A, uidA, { accountId: u10.id, type: "INCOME", amount: 100 }, randomUUID())).data;
  await A.rpc("revert_transaction_effect", { p_action: "revert", p_id: uTx.id, p_user_id: uidA, p_account_id: u10.id, p_type: "INCOME", p_amount: 100, p_debt_id: null, p_destination_account_id: null });
  await A.from("transactions").update({ amount: 200 }).eq("id", uTx.id);
  await A.rpc("apply_transaction_effect", { p_action: "apply", p_id: uTx.id, p_user_id: uidA, p_account_id: u10.id, p_type: "INCOME", p_amount: 200, p_debt_id: null, p_destination_account_id: null });
  rec("10. UPDATE tras crear", (await bal(A, u10.id, "acc")) === 10200, "saldo=" + (await bal(A, u10.id, "acc")) + " (10200)");

  // 11. DELETE tras crear (revert -> delete)
  const u11 = await acc(uidA, A, 10000);
  const dTx = (await createWithKey(A, uidA, { accountId: u11.id, type: "INCOME", amount: 100 }, randomUUID())).data;
  await A.rpc("delete_transaction_effect", { p_id: dTx.id, p_user_id: uidA, p_account_id: u11.id, p_type: "INCOME", p_amount: 100, p_debt_id: null, p_destination_account_id: null });
  rec("11. DELETE tras crear", (await bal(A, u11.id, "acc")) === 10000, "saldo=" + (await bal(A, u11.id, "acc")) + " (10000)");

  // 12. RLS: B no ve transacciones de A
  const bRead = await B.from("transactions").select("*").eq("user_id", uidA);
  rec("12. RLS: B no ve transacciones de A", (bRead.data && bRead.data.length === 0), "0 filas");

  await cleanupAll();
  await A.auth.signOut(); await B.auth.signOut();
  console.log(`\n=== IDEMPOTENCIA RESULTADO: ${passed} PASS, ${failed} FAIL ===`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch((e) => { console.error("ERROR:", e.message); process.exit(2); });
