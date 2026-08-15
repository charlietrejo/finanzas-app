// scripts/verify-concurrency.mjs
// PRUEBA DE CONCURRENCIA contra la BD remota.
// Simula operaciones simultáneas y verifica que la RPC 012 (SELECT..FOR UPDATE
// + transacción SQL) serializa correctamente sin lost updates ni saldos imposibles.
// NO modifica código de la app; replica el patrón real (INSERT + apply RPC).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const PASS = process.env.PENTEST_PASSWORD;
const A = createClient(URL, ANON, { auth: { persistSession: false } });
const norm = (v) => Number(v ?? 0);

let passed = 0, failed = 0;
function assert(cond, msg) { if (!cond) { failed++; console.log("  FALLO: " + msg); throw new Error("Aserción fallida: " + msg); } passed++; console.log("  OK: " + msg); }

async function login() {
  const r = await A.auth.signInWithPassword({ email: "aislamiento.a.verificacion@gmail.com", password: PASS });
  if (r.error || !r.data.session) throw new Error("login: " + (r.error?.message || "sin sesión"));
  return r.data.session;
}
async function clean() {
  const { data: acc } = await A.from("accounts").select("id");
  for (const a of acc ?? []) await A.from("transactions").delete().eq("account_id", a.id);
  const { data: dts } = await A.from("debts").select("id");
  for (const d of dts ?? []) await A.from("transactions").delete().eq("debt_id", d.id);
  await A.from("accounts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await A.from("debts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
async function mkAccount(b, uid) { const { data, error } = await A.from("accounts").insert({ user_id: uid, name: "T", type: "BANK", initial_balance: b, current_balance: b }).select().single(); if (error) throw error; return data; }
async function mkDebt(cb, init, uid) { const { data, error } = await A.from("debts").insert({ user_id: uid, name: "D", type: "LOAN", initial_amount: init, current_balance: cb }).select().single(); if (error) throw error; return data; }
async function mkCardDebt(cb, init, uid) { const { data, error } = await A.from("debts").insert({ user_id: uid, name: "C", type: "CREDIT_CARD", initial_amount: init, current_balance: cb }).select().single(); if (error) throw error; return data; }
async function balAcc(id) { const { data } = await A.from("accounts").select("current_balance").eq("id", id).single(); return norm(data.current_balance); }
async function balDebt(id) { const { data } = await A.from("debts").select("current_balance").eq("id", id).single(); return norm(data.current_balance); }
async function txnsOf(id) { const { data } = await A.from("transactions").select("id,amount,type").eq("account_id", id); return data ?? []; }

// Replica createTransaction + apply (RPC 012) para una operación.
async function doTx(payload, uid) {
  const { data, error } = await A.from("transactions").insert({
    user_id: uid, account_id: payload.accountId, type: payload.type, amount: payload.amount,
    description: "t", transaction_date: new Date().toISOString().slice(0, 10),
    debt_id: payload.debtId ?? null, destination_account_id: payload.destinationAccountId ?? null,
  }).select().single();
  if (error) throw error;
  const { error: rpcError } = await A.rpc("apply_transaction_effect", {
    p_action: "apply", p_id: data.id, p_user_id: uid,
    p_account_id: payload.accountId, p_type: payload.type, p_amount: payload.amount,
    p_debt_id: payload.debtId ?? null, p_destination_account_id: payload.destinationAccountId ?? null,
  });
  if (rpcError) { await A.from("transactions").delete().eq("id", data.id); throw new Error(rpcError.message || "RPC falló"); }
  return data;
}

async function run() {
  await login();
  const uid = (await A.auth.getUser()).data.user.id;
  await clean();

  // === Caso A/B: pago 7k y pago 5k en PARALELO, saldo 10k, deuda 20k ===
  console.log("\n=== CONCURRENCIA: A pago 7000 / B pago 5000 / saldo 10000 ===");
  let acc = await mkAccount(10000, uid);
  let debt = await mkDebt(20000, 20000, uid);
  const [ra, rb] = await Promise.allSettled([
    doTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 7000, debtId: debt.id }, uid),
    doTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 5000, debtId: debt.id }, uid),
  ]);
  const aOk = ra.status === "fulfilled";
  const bOk = rb.status === "fulfilled";
  // Exactamente uno debe aplicarse (10k soporta 7k, pero no 7k+5k=12k).
  assert(aOk !== bOk, "exactamente una de las dos operaciones concurrentes se aplicó (la otra rechazada)");
  const cFinal = await balAcc(acc.id);
  const dFinal = await balDebt(debt.id);
  // Si aplicó 7k: cta=3000, deuda=13000. Si 5k: cta=5000, deuda=15000. Nunca <0 ni imposible.
  assert(cFinal === 3000 || cFinal === 5000, "saldo final de cuenta es 3000 o 5000 (nunca imposible): " + cFinal);
  assert(dFinal === 13000 || dFinal === 15000, "saldo final de deuda coherente: " + dFinal);
  const applied = (await txnsOf(acc.id)).length;
  assert(applied === 1, "exactamente 1 transacción aplicada (sin duplicado ni perdida): " + applied);
  // Consistencia: deuda inicial 20000 - pagado = final; cuenta 10000 - pagado = final.
  const paid = 20000 - dFinal;
  assert(cFinal === 10000 - paid, "cuenta y deuda coinciden con el monto pagado (" + paid + ")");
  await clean();

  // === TRANSFER simultánea: dos transferencias de 6k desde una cuenta de 10k hacia destino ===
  console.log("\n=== CONCURRENCIA: TRANSFER 6000 + TRANSFER 6000 desde 10000 ===");
  const orig = await mkAccount(10000, uid);
  const dest = await mkAccount(0, uid);
  const [ta, tb] = await Promise.allSettled([
    doTx({ accountId: orig.id, type: "TRANSFER", amount: 6000, destinationAccountId: dest.id }, uid),
    doTx({ accountId: orig.id, type: "TRANSFER", amount: 6000, destinationAccountId: dest.id }, uid),
  ]);
  const tApplied = [ta, tb].filter((x) => x.status === "fulfilled").length;
  assert(tApplied === 1, "solo 1 transferencia aplicada de 2 concurrentes (10k no soporta 12k): " + tApplied);
  const oFinal = await balAcc(orig.id);
  const dFinal2 = await balAcc(dest.id);
  assert(oFinal === 4000, "origen = 4000 (una sola transferencia de 6k aplicada): " + oFinal);
  assert(dFinal2 === 6000, "destino = 6000: " + dFinal2);
  await clean();

  // === DEBT_PAYMENT simultáneo desde cuentas distintas hacia la MISMA deuda ===
  console.log("\n=== CONCURRENCIA: 2 pagos simultáneos a MISMA deuda (5k y 3k), deuda 20k ===");
  const payer1 = await mkAccount(10000, uid);
  const payer2 = await mkAccount(10000, uid);
  const sameDebt = await mkDebt(20000, 20000, uid);
  const [pa, pb] = await Promise.allSettled([
    doTx({ accountId: payer1.id, type: "DEBT_PAYMENT", amount: 5000, debtId: sameDebt.id }, uid),
    doTx({ accountId: payer2.id, type: "DEBT_PAYMENT", amount: 3000, debtId: sameDebt.id }, uid),
  ]);
  assert(pa.status === "fulfilled" && pb.status === "fulfilled", "ambos pagos a la misma deuda aplicados (deuda soporta 8k)");
  const debtFinal = await balDebt(sameDebt.id);
  assert(debtFinal === 12000, "deuda = 12000 (20k - 5k - 3k atómicamente): " + debtFinal);
  assert((await balAcc(payer1.id)) === 5000, "payer1 = 5000");
  assert((await balAcc(payer2.id)) === 7000, "payer2 = 7000");
  await clean();

  // === EXPENSE de tarjeta simultáneo sobre la MISMA deuda de tarjeta ===
  console.log("\n=== CONCURRENCIA: 2 compras de tarjeta simultáneas, deuda 5000 ===");
  const card = await A.from("accounts").insert({ user_id: uid, name: "Card", type: "CREDIT_CARD", initial_balance: 0, current_balance: 0 }).select().single();
  const cardDebt = await mkCardDebt(0, 5000, uid);
  await A.from("accounts").update({ debt_id: cardDebt.id }).eq("id", card.data.id);
  const [ca, cb] = await Promise.allSettled([
    doTx({ accountId: card.data.id, type: "EXPENSE", amount: 2000, debtId: cardDebt.id }, uid),
    doTx({ accountId: card.data.id, type: "EXPENSE", amount: 1000, debtId: cardDebt.id }, uid),
  ]);
  assert(ca.status === "fulfilled" && cb.status === "fulfilled", "ambas compras aplicadas (límite 5000 soporta 3000)");
  assert((await balDebt(cardDebt.id)) === 3000, "deuda de tarjeta = 3000 (0+2000+1000): " + (await balDebt(cardDebt.id)));
  await A.from("accounts").delete().eq("id", card.data.id);
  await A.from("debts").delete().eq("id", cardDebt.id);

  console.log("\n=== RESULTADO CONCURRENCIA: " + passed + " OK, " + failed + " FALLOS ===");
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("\nERROR EN PRUEBA:", e.message); process.exit(1); });
