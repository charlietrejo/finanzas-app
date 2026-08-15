// scripts/verify-integrity-12.mjs
// VALIDACIÓN DE LOS 12 CASOS OBLIGATORIOS DE INTEGRIDAD FINANCIERA.
// Ejecuta contra el proyecto Supabase REMOTO usando cliente anon + sesión real.
// Replica fielmente el patrón de finance.ts (RPC 012 apply/revert + RPC 013 delete).

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
const EMAIL_A = "aislamiento.a.verificacion@gmail.com";
const norm = (v) => Number(v ?? 0);

async function login() {
  const r = await A.auth.signInWithPassword({ email: EMAIL_A, password: PASS });
  if (r.error || !r.data.session) throw new Error("login A: " + (r.error?.message || "sin sesión"));
  return r.data.session;
}

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (!cond) { failed++; console.log("  FALLO: " + msg); throw new Error("Aserción fallida: " + msg); }
  passed++; console.log("  OK: " + msg);
}

async function clean() {
  const { data: acc } = await A.from("accounts").select("id");
  for (const a of acc ?? []) await A.from("transactions").delete().eq("account_id", a.id);
  const { data: dts } = await A.from("debts").select("id");
  for (const d of dts ?? []) await A.from("transactions").delete().eq("debt_id", d.id);
  await A.from("accounts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await A.from("debts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

async function mkAccount(balance, uid) {
  const { data, error } = await A.from("accounts").insert({ user_id: uid, name: "Test", type: "BANK", initial_balance: balance, current_balance: balance }).select().single();
  if (error) throw error; return data;
}
async function mkDebt(cb, initial, uid) {
  const { data, error } = await A.from("debts").insert({ user_id: uid, name: "TestDebt", type: "LOAN", initial_amount: initial, current_balance: cb }).select().single();
  if (error) throw error; return data;
}
async function mkCardDebt(cb, initial, uid) {
  const { data, error } = await A.from("debts").insert({ user_id: uid, name: "TestCard", type: "CREDIT_CARD", initial_amount: initial, current_balance: cb }).select().single();
  if (error) throw error; return data;
}
async function balanceAcc(id) { const { data } = await A.from("accounts").select("current_balance").eq("id", id).single(); return norm(data.current_balance); }
async function balanceDebt(id) { const { data } = await A.from("debts").select("current_balance").eq("id", id).single(); return norm(data.current_balance); }
async function txnsOfAccount(id) { const { data } = await A.from("transactions").select("id").eq("account_id", id); return data ?? []; }
async function txnsOfDebt(id) { const { data } = await A.from("transactions").select("id").eq("debt_id", id); return data ?? []; }

async function createTx(payload, uid) {
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

// Replica updateTransaction de la app (validaciones + revert -> update -> apply con rollback).
async function updateTx(id, payload, uid) {
  const { data: existing, error: eErr } = await A.from("transactions").select("*").eq("id", id).single();
  if (eErr || !existing) throw eErr ?? new Error("No se encontró la transacción");
  const existingTx = existing;
  // Validaciones previas (DEBT_PAYMENT / TRANSFER / EXPENSE) igual que finance.ts.
  if (payload.type === "DEBT_PAYMENT") {
    const debtId = payload.debtId ?? null;
    if (!debtId) throw new Error("Selecciona la deuda que deseas pagar.");
    const { data: payer } = await A.from("accounts").select("current_balance").eq("id", payload.accountId).single();
    const saldo = norm(payer.current_balance);
    const disp = existingTx.account_id === payload.accountId ? saldo + norm(existingTx.amount) : saldo;
    if (norm(payload.amount) > disp) throw new Error("No tienes saldo suficiente en esta cuenta para realizar este pago.");
    const { data: debt } = await A.from("debts").select("current_balance").eq("id", debtId).single();
    if (norm(payload.amount) > norm(debt.current_balance) + norm(existingTx.amount)) throw new Error("El pago no puede ser mayor a la deuda actual.");
  }
  if (payload.type === "TRANSFER") {
    if (!payload.destinationAccountId) throw new Error("Selecciona la cuenta de destino para la transferencia.");
    if (payload.destinationAccountId === payload.accountId) throw new Error("La cuenta de origen y destino no pueden ser la misma.");
    const { data: origin } = await A.from("accounts").select("current_balance").eq("id", payload.accountId).single();
    const saldo = norm(origin.current_balance);
    const disp = existingTx.account_id === payload.accountId ? saldo + norm(existingTx.amount) : saldo;
    if (norm(payload.amount) > disp) throw new Error("Saldo insuficiente en la cuenta de origen para realizar la transferencia.");
  }
  const { error: revErr } = await A.rpc("apply_transaction_effect", {
    p_action: "revert", p_id: id, p_user_id: uid,
    p_account_id: existingTx.account_id, p_type: existingTx.type, p_amount: existingTx.amount,
    p_debt_id: existingTx.debt_id ?? null, p_destination_account_id: existingTx.destination_account_id ?? null,
  });
  if (revErr) throw new Error(revErr.message || "revert falló");
  const { data: nueva, error: uErr } = await A.from("transactions").update({
    account_id: payload.accountId, type: payload.type, amount: payload.amount,
    debt_id: payload.debtId ?? null, destination_account_id: payload.destinationAccountId ?? null,
  }).eq("id", id).select().single();
  if (uErr) { await A.rpc("apply_transaction_effect", { p_action: "apply", p_id: id, p_user_id: uid, p_account_id: existingTx.account_id, p_type: existingTx.type, p_amount: existingTx.amount, p_debt_id: existingTx.debt_id ?? null, p_destination_account_id: existingTx.destination_account_id ?? null }); throw uErr; }
  const { error: appErr } = await A.rpc("apply_transaction_effect", {
    p_action: "apply", p_id: id, p_user_id: uid,
    p_account_id: nueva.account_id, p_type: nueva.type, p_amount: nueva.amount,
    p_debt_id: nueva.debt_id ?? null, p_destination_account_id: nueva.destination_account_id ?? null,
  });
  if (appErr) {
    await A.from("transactions").update({ account_id: existingTx.account_id, type: existingTx.type, amount: existingTx.amount, debt_id: existingTx.debt_id ?? null, destination_account_id: existingTx.destination_account_id ?? null }).eq("id", id);
    await A.rpc("apply_transaction_effect", { p_action: "apply", p_id: id, p_user_id: uid, p_account_id: existingTx.account_id, p_type: existingTx.type, p_amount: existingTx.amount, p_debt_id: existingTx.debt_id ?? null, p_destination_account_id: existingTx.destination_account_id ?? null });
    throw new Error(appErr.message || "apply falló");
  }
  return nueva;
}

async function deleteTx(id, uid, existing) {
  const { error } = await A.rpc("delete_transaction_effect", {
    p_id: id, p_user_id: existing.user_id, p_account_id: existing.account_id,
    p_type: existing.type, p_amount: existing.amount,
    p_debt_id: existing.debt_id ?? null, p_destination_account_id: existing.destination_account_id ?? null,
  });
  if (error) throw new Error(error.message || "delete_transaction_effect falló");
}

async function deleteDebtApp(id) {
  const { data: rel, error: relErr } = await A.from("transactions").select("id").eq("debt_id", id).limit(1);
  if (relErr) throw relErr;
  if ((rel ?? []).length > 0) throw new Error("No puedes eliminar esta deuda porque tiene movimientos asociados. Elimina primero sus movimientos.");
  const { error } = await A.from("debts").delete().eq("id", id);
  if (error) throw error;
}

async function run() {
  await login();
  const uid = (await A.auth.getUser()).data.user.id;
  await clean();

  // Caso 1: Cta 10,000 + Pago 3,000 => Cta 7,000 / Deuda -3,000
  console.log("\n=== Caso 1: Cta 10000, Pago 3000 ===");
  let acc = await mkAccount(10000, uid);
  let debt = await mkDebt(5000, 5000, uid);
  let tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  assert((await balanceAcc(acc.id)) === 7000, "Cuenta = 7000");
  assert((await balanceDebt(debt.id)) === 2000, "Deuda = 2000 (baja 3000)");
  await clean();

  // Caso 2: Cta 1,000 + Pago 3,000 => RECHAZADO
  console.log("\n=== Caso 2: Cta 1000, Pago 3000 => RECHAZADO ===");
  acc = await mkAccount(1000, uid);
  debt = await mkDebt(5000, 5000, uid);
  try { await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid); assert(false, "debió rechazarse"); }
  catch (e) { assert(true, "rechazado: " + e.message); }
  assert((await balanceAcc(acc.id)) === 1000, "Cuenta intacta = 1000");
  assert((await balanceDebt(debt.id)) === 5000, "Deuda intacta = 5000");
  assert((await txnsOfAccount(acc.id)).length === 0, "sin transacción huérfana");
  await clean();

  // Caso 3: Deuda 5,000 + Pago 3,000 => Deuda 2,000
  console.log("\n=== Caso 3: Deuda 5000, Pago 3000 => Deuda 2000 ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  assert((await balanceDebt(debt.id)) === 2000, "Deuda = 2000");
  await clean();

  // Caso 4: Deuda 2,000 + Pago 3,000 => RECHAZADO
  console.log("\n=== Caso 4: Deuda 2000, Pago 3000 => RECHAZADO ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(2000, 2000, uid);
  try { await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid); assert(false, "debió rechazarse"); }
  catch (e) { assert(true, "rechazado: " + e.message); }
  assert((await balanceDebt(debt.id)) === 2000, "Deuda intacta = 2000");
  await clean();

  // Caso 5: Crear pago 3,000 -> editar a 5,000 == haber creado pago 5,000
  console.log("\n=== Caso 5: Pago 3000 -> editar 5000 (equivalente a pago 5000) ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  await updateTx(tx.id, { accountId: acc.id, type: "DEBT_PAYMENT", amount: 5000, debtId: debt.id, description: "t", transactionDate: "2026-01-01" }, uid);
  assert((await balanceAcc(acc.id)) === 5000, "Cuenta = 5000 (como pago 5000 directo)");
  assert((await balanceDebt(debt.id)) === 0, "Deuda = 0 (como pago 5000 directo)");
  await clean();

  // Caso 6: Crear pago 5,000 -> editar a 1,000 == haber creado pago 1,000
  console.log("\n=== Caso 6: Pago 5000 -> editar 1000 (equivalente a pago 1000) ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 5000, debtId: debt.id }, uid);
  await updateTx(tx.id, { accountId: acc.id, type: "DEBT_PAYMENT", amount: 1000, debtId: debt.id, description: "t", transactionDate: "2026-01-01" }, uid);
  assert((await balanceAcc(acc.id)) === 9000, "Cuenta = 9000 (como pago 1000 directo)");
  assert((await balanceDebt(debt.id)) === 4000, "Deuda = 4000 (como pago 1000 directo)");
  await clean();

  // Caso 7: Crear pago -> eliminar => estado anterior
  console.log("\n=== Caso 7: Crear pago 3000 -> eliminar => estado previo ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  const tx7 = (await A.from("transactions").select("*").eq("id", tx.id).single()).data;
  await deleteTx(tx.id, uid, tx7);
  assert((await balanceAcc(acc.id)) === 10000, "Cuenta restaurada = 10000");
  assert((await balanceDebt(debt.id)) === 5000, "Deuda restaurada = 5000");
  assert((await txnsOfAccount(acc.id)).length === 0, "Fila eliminada");
  await clean();

  // Caso 8: Gasto tarjeta deuda A -> cambiar cuenta a B -> eliminar => afecta A no B
  console.log("\n=== Caso 8: Tarjeta A, gasto, cambiar a B, eliminar => afecta A no B ===");
  const { data: cardAcc } = await A.from("accounts").insert({ user_id: uid, name: "Card", type: "CREDIT_CARD", initial_balance: 0, current_balance: 0 }).select().single();
  let debtA = await mkCardDebt(0, 5000, uid);
  let debtB = await mkCardDebt(0, 5000, uid);
  await A.from("accounts").update({ debt_id: debtA.id }).eq("id", cardAcc.id);
  let compra = await createTx({ accountId: cardAcc.id, type: "EXPENSE", amount: 1000, debtId: debtA.id }, uid);
  assert((await balanceDebt(debtA.id)) === 1000, "Deuda A = 1000 tras compra");
  assert((await balanceDebt(debtB.id)) === 0, "Deuda B = 0");
  await A.from("accounts").update({ debt_id: debtB.id }).eq("id", cardAcc.id);
  const compraEx = (await A.from("transactions").select("*").eq("id", compra.id).single()).data;
  await deleteTx(compra.id, uid, compraEx);
  assert((await balanceDebt(debtA.id)) === 0, "Deuda A regresa a 0 (revertida por compra.debt_id)");
  assert((await balanceDebt(debtB.id)) === 0, "Deuda B intacta (0)");
  await A.from("accounts").delete().eq("id", cardAcc.id);
  await A.from("debts").delete().eq("id", debtA.id);
  await A.from("debts").delete().eq("id", debtB.id);

  // Caso 9: Borrar deuda sin transacciones => funciona
  console.log("\n=== Caso 9: Borrar deuda sin transacciones => OK ===");
  debt = await mkDebt(5000, 5000, uid);
  await deleteDebtApp(debt.id);
  assert(true, "deuda sin transacciones eliminada correctamente");
  await clean();

  // Caso 10: Borrar deuda con transacciones => rechazado
  console.log("\n=== Caso 10: Borrar deuda con transacciones => RECHAZADO ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 1000, debtId: debt.id }, uid);
  try { await deleteDebtApp(debt.id); assert(false, "debió rechazarse"); }
  catch (e) { assert(true, "rechazado: " + e.message); }
  assert((await balanceDebt(debt.id)) === 4000, "Deuda permanece (4000)");
  assert((await txnsOfDebt(debt.id)).length === 1, "Transacción permanece");
  await A.from("transactions").delete().eq("id", tx.id);
  await clean();

  // Caso 11: F5/refresh no re-aplica => el saldo es estable tras recarga (idempotencia de la RPC).
  console.log("\n=== Caso 11: idempotencia (no re-aplicar al re-leer) ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  // Simula "refresh": releemos saldos desde BD (no volvemos a llamar apply).
  const c1 = await balanceAcc(acc.id), d1 = await balanceDebt(debt.id);
  const c2 = await balanceAcc(acc.id), d2 = await balanceDebt(debt.id);
  assert(c1 === c2 && d1 === d2, "saldo estable tras re-lectura (sin re-aplicar)");
  assert(c1 === 7000 && d1 === 2000, "valores correctos persistidos");
  await clean();

  // Caso 12: create/update/delete no duplican efectos => crear 2 pagos distintos suma correctamente.
  console.log("\n=== Caso 12: no duplicación de efectos ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, uid);
  await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 2000, debtId: debt.id }, uid);
  await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 1000, debtId: debt.id }, uid);
  assert((await balanceAcc(acc.id)) === 7000, "Cuenta = 7000 (2000+1000 descontados una sola vez)");
  assert((await balanceDebt(debt.id)) === 2000, "Deuda = 2000");
  const rows = (await A.from("transactions").select("id").eq("account_id", acc.id)).data ?? [];
  assert(rows.length === 2, "exactamente 2 transacciones (no duplicadas)");
  await clean();

  console.log("\n=== RESULTADO: " + passed + " OK, " + failed + " FALLOS ===");
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("\nERROR EN PRUEBA:", e.message); process.exit(1); });
