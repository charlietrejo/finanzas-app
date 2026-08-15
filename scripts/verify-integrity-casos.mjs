// scripts/verify-integrity-casos.mjs
// VALIDACIÓN DE LOS CASOS A-F (+G de consistencia) DEL PROMPT DE INTEGRIDAD.
// Ejecuta contra el proyecto Supabase REMOTO usando el cliente anon + sesión real.
// Replica fielmente el patrón de finance.ts (CREATE/UPDATE/DELETE con RPC 012).

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

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.log("  FALLO: " + msg);
    throw new Error("Aserción fallida: " + msg);
  }
  passed++;
  console.log("  OK: " + msg);
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
  const { data, error } = await A.from("accounts")
    .insert({ user_id: uid, name: "Test", type: "BANK", initial_balance: balance, current_balance: balance })
    .select().single();
  if (error) throw error;
  return data;
}
async function mkDebt(balance, initial, initial_amount, uid) {
  const { data, error } = await A.from("debts")
    .insert({ user_id: uid, name: "TestDebt", type: "LOAN", initial_amount, current_balance: balance })
    .select().single();
  if (error) throw error;
  return data;
}
async function mkCardDebt(balance, initial, uid) {
  const { data, error } = await A.from("debts")
    .insert({ user_id: uid, name: "TestCard", type: "CREDIT_CARD", initial_amount: initial, current_balance: balance })
    .select().single();
  if (error) throw error;
  return data;
}
async function balanceAcc(id) {
  const { data } = await A.from("accounts").select("current_balance").eq("id", id).single();
  return norm(data.current_balance);
}
async function balanceDebt(id) {
  const { data } = await A.from("debts").select("current_balance").eq("id", id).single();
  return norm(data.current_balance);
}
async function txnsOfAccount(id) {
  const { data } = await A.from("transactions").select("id").eq("account_id", id);
  return data ?? [];
}
async function txnsOfDebt(id) {
  const { data } = await A.from("transactions").select("id").eq("debt_id", id);
  return data ?? [];
}

async function createTx(payload, uid) {
  const { data, error } = await A.from("transactions").insert({
    user_id: uid,
    account_id: payload.accountId,
    type: payload.type,
    amount: payload.amount,
    description: "t",
    transaction_date: new Date().toISOString().slice(0, 10),
    debt_id: payload.debtId ?? null,
    destination_account_id: payload.destinationAccountId ?? null,
  }).select().single();
  if (error) throw error;
  const { error: rpcError } = await A.rpc("apply_transaction_effect", {
    p_action: "apply", p_id: data.id, p_user_id: uid,
    p_account_id: payload.accountId, p_type: payload.type, p_amount: payload.amount,
    p_debt_id: payload.debtId ?? null, p_destination_account_id: payload.destinationAccountId ?? null,
  });
  if (rpcError) {
    await A.from("transactions").delete().eq("id", data.id);
    throw new Error(rpcError.message || "RPC falló");
  }
  return data;
}

// Replica updateTransaction de la app INCLUYENDO validaciones previas al revert.
async function updateTx(id, payload, uid) {
  const { data: existing, error: eErr } = await A.from("transactions").select("*").eq("id", id).single();
  if (eErr || !existing) throw eErr ?? new Error("No se encontró la transacción");
  const existingTx = existing;

  // Validaciones previas (igual que finance.ts updateTransaction).
  if (payload.type === "DEBT_PAYMENT") {
    const debtId = payload.debtId ?? null;
    if (!debtId) throw new Error("Selecciona la deuda que deseas pagar.");
    const { data: payerAccount, error: pErr } = await A.from("accounts").select("current_balance").eq("id", payload.accountId).single();
    if (pErr || !payerAccount) throw pErr ?? new Error("No se encontró la cuenta");
    const saldoActual = norm(payerAccount.current_balance);
    const mismaCuenta = existingTx.account_id === payload.accountId;
    const disponible = mismaCuenta ? saldoActual + norm(existingTx.amount) : saldoActual;
    if (norm(payload.amount) > disponible) throw new Error("No tienes saldo suficiente en esta cuenta para realizar este pago.");
    const { data: debt, error: dErr } = await A.from("debts").select("current_balance").eq("id", debtId).single();
    if (dErr || !debt) throw dErr ?? new Error("No se encontró la deuda que deseas pagar.");
    if (norm(payload.amount) > norm(debt.current_balance) + norm(existingTx.amount))
      throw new Error("El pago no puede ser mayor a la deuda actual.");
  }
  if (payload.type === "TRANSFER") {
    if (!payload.destinationAccountId) throw new Error("Selecciona la cuenta de destino para la transferencia.");
    if (payload.destinationAccountId === payload.accountId) throw new Error("La cuenta de origen y destino no pueden ser la misma.");
    const { data: origin, error: oErr } = await A.from("accounts").select("current_balance").eq("id", payload.accountId).single();
    if (oErr || !origin) throw oErr ?? new Error("No se encontró la cuenta de origen.");
    const saldoActual = norm(origin.current_balance);
    const mismaCuenta = existingTx.account_id === payload.accountId;
    const disponible = mismaCuenta ? saldoActual + norm(existingTx.amount) : saldoActual;
    if (norm(payload.amount) > disponible) throw new Error("Saldo insuficiente en la cuenta de origen para realizar la transferencia.");
  }

  // revert -> update -> apply (con rollback del riesgo #1 corregido en finance.ts).
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
  if (uErr) {
    await A.rpc("apply_transaction_effect", {
      p_action: "apply", p_id: id, p_user_id: uid,
      p_account_id: existingTx.account_id, p_type: existingTx.type, p_amount: existingTx.amount,
      p_debt_id: existingTx.debt_id ?? null, p_destination_account_id: existingTx.destination_account_id ?? null,
    });
    throw uErr;
  }
  const { error: appErr } = await A.rpc("apply_transaction_effect", {
    p_action: "apply", p_id: id, p_user_id: uid,
    p_account_id: nueva.account_id, p_type: nueva.type, p_amount: nueva.amount,
    p_debt_id: nueva.debt_id ?? null, p_destination_account_id: nueva.destination_account_id ?? null,
  });
  if (appErr) {
    // Rollback: restaurar fila y reaplicar efecto previo.
    await A.from("transactions").update({
      account_id: existingTx.account_id, type: existingTx.type, amount: existingTx.amount,
      debt_id: existingTx.debt_id ?? null, destination_account_id: existingTx.destination_account_id ?? null,
    }).eq("id", id);
    await A.rpc("apply_transaction_effect", {
      p_action: "apply", p_id: id, p_user_id: uid,
      p_account_id: existingTx.account_id, p_type: existingTx.type, p_amount: existingTx.amount,
      p_debt_id: existingTx.debt_id ?? null, p_destination_account_id: existingTx.destination_account_id ?? null,
    });
    throw new Error(appErr.message || "apply falló");
  }
  return nueva;
}

// updateTx sin validaciones previas: fuerza el fallo del apply tras el revert
// para verificar el rollback automático de finance.ts (riesgo #1).
async function updateTxForceApplyFail(id, payload, uid) {
  const { data: existing, error: eErr } = await A.from("transactions").select("*").eq("id", id).single();
  if (eErr || !existing) throw eErr ?? new Error("No se encontró la transacción");
  const existingTx = existing;
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
  if (uErr) {
    await A.rpc("apply_transaction_effect", {
      p_action: "apply", p_id: id, p_user_id: uid,
      p_account_id: existingTx.account_id, p_type: existingTx.type, p_amount: existingTx.amount,
      p_debt_id: existingTx.debt_id ?? null, p_destination_account_id: existingTx.destination_account_id ?? null,
    });
    throw uErr;
  }
  const { error: appErr } = await A.rpc("apply_transaction_effect", {
    p_action: "apply", p_id: id, p_user_id: uid,
    p_account_id: nueva.account_id, p_type: nueva.type, p_amount: nueva.amount,
    p_debt_id: nueva.debt_id ?? null, p_destination_account_id: nueva.destination_account_id ?? null,
  });
  if (appErr) {
    await A.from("transactions").update({
      account_id: existingTx.account_id, type: existingTx.type, amount: existingTx.amount,
      debt_id: existingTx.debt_id ?? null, destination_account_id: existingTx.destination_account_id ?? null,
    }).eq("id", id);
    await A.rpc("apply_transaction_effect", {
      p_action: "apply", p_id: id, p_user_id: uid,
      p_account_id: existingTx.account_id, p_type: existingTx.type, p_amount: existingTx.amount,
      p_debt_id: existingTx.debt_id ?? null, p_destination_account_id: existingTx.destination_account_id ?? null,
    });
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

async function run() {
  await login();
  const uid = (await A.auth.getUser()).data.user.id;
  await clean();

  // ---- Caso A ----
  console.log("\n=== Caso A: Cuenta 10000, Deuda 5000, Pago 3000 ===");
  let acc = await mkAccount(10000, uid);
  let debt = await mkDebt(5000, 5000, 5000, uid);
  let tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  assert((await balanceAcc(acc.id)) === 7000, "Cuenta = 7000");
  assert((await balanceDebt(debt.id)) === 2000, "Deuda = 2000");

  // ---- Caso B ----
  console.log("\n=== Caso B: Cuenta 1000, Deuda 5000, Pago 3000 => RECHAZADO ===");
  acc = await mkAccount(1000, uid);
  debt = await mkDebt(5000, 5000, 5000, uid);
  try {
    await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
    assert(false, "debió rechazarse");
  } catch (e) {
    assert(true, "rechazado: " + e.message);
  }
  assert((await balanceAcc(acc.id)) === 1000, "Cuenta intacta = 1000");
  assert((await balanceDebt(debt.id)) === 5000, "Deuda intacta = 5000");
  assert((await txnsOfAccount(acc.id)).length === 0, "no quedó transacción huérfana");
  await clean();

  // ---- Caso C ----
  console.log("\n=== Caso C: Pago 3000 -> editar a 4000 ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  await updateTx(tx.id, { accountId: acc.id, type: "DEBT_PAYMENT", amount: 4000, debtId: debt.id, description: "t", transactionDate: "2026-01-01" }, uid);
  assert((await balanceAcc(acc.id)) === 6000, "Cuenta = 6000");
  assert((await balanceDebt(debt.id)) === 1000, "Deuda = 1000");
  await clean();

  // ---- Caso D ----
  console.log("\n=== Caso D: Pago 3000 -> editar a 8000 => RECHAZADO (validación previa) ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  try {
    await updateTx(tx.id, { accountId: acc.id, type: "DEBT_PAYMENT", amount: 8000, debtId: debt.id, description: "t", transactionDate: "2026-01-01" }, uid);
    assert(false, "debió rechazarse");
  } catch (e) {
    assert(true, "rechazado: " + e.message);
  }
  assert((await balanceAcc(acc.id)) === 7000, "Cuenta coherente = 7000 (pago de 3000 aplicado)");
  assert((await balanceDebt(debt.id)) === 2000, "Deuda coherente = 2000");
  await clean();

  // ---- Caso E ----
  console.log("\n=== Caso E: Eliminar deuda con DEBT_PAYMENT asociado => RECHAZADO ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 1000, debtId: debt.id }, uid);
  const { data: rel, error: relErr } = await A.from("transactions").select("id").eq("debt_id", debt.id).limit(1);
  let deleteErrMsg = null;
  if (relErr) deleteErrMsg = relErr.message;
  else if ((rel ?? []).length > 0) deleteErrMsg = "No puedes eliminar esta deuda porque tiene movimientos asociados. Elimina primero sus movimientos.";
  else { const { error: delErr } = await A.from("debts").delete().eq("id", debt.id); if (delErr) deleteErrMsg = delErr.message; }
  assert(deleteErrMsg !== null, "deleteDebt rechazado: " + deleteErrMsg);
  assert((await balanceDebt(debt.id)) === 4000, "Deuda permanece (4000)");
  assert((await txnsOfDebt(debt.id)).length === 1, "Transacción permanece");
  await A.from("transactions").delete().eq("id", tx.id);
  await clean();

  // ---- Caso F ----
  console.log("\n=== Caso F: Deuda A, gasto tarjeta, cambiar cuenta a B, revertir => afecta A no B ===");
  const { data: cardAccRow } = await A.from("accounts").insert({ user_id: uid, name: "Card", type: "CREDIT_CARD", initial_balance: 0, current_balance: 0 }).select().single();
  let cardAcc = cardAccRow;
  let debtA = await mkCardDebt(0, 5000, uid);
  let debtB = await mkCardDebt(0, 5000, uid);
  await A.from("accounts").update({ debt_id: debtA.id }).eq("id", cardAcc.id);
  let compra = await createTx({ accountId: cardAcc.id, type: "EXPENSE", amount: 1000, debtId: debtA.id }, uid);
  assert((await balanceDebt(debtA.id)) === 1000, "Deuda A = 1000 tras compra");
  assert((await balanceDebt(debtB.id)) === 0, "Deuda B = 0 tras compra");
  await A.from("accounts").update({ debt_id: debtB.id }).eq("id", cardAcc.id);
  const compraExisting = (await A.from("transactions").select("*").eq("id", compra.id).single()).data;
  await deleteTx(compra.id, uid, compraExisting);
  assert((await balanceDebt(debtA.id)) === 0, "Deuda A regresa a 0 (revertida por compra.debt_id)");
  assert((await balanceDebt(debtB.id)) === 0, "Deuda B intacta (0)");
  await A.from("accounts").delete().eq("id", cardAcc.id);
  await A.from("debts").delete().eq("id", debtA.id);
  await A.from("debts").delete().eq("id", debtB.id);

  // ---- Caso G: riesgo #1 corregido (rollback tras apply fallido) ----
  console.log("\n=== Caso G: UPDATE con apply que falla => rollback deja estado previo intacto ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  // Forzamos un apply que falle: editar el pago a 8000 SIN validación previa
  // (simula condición de carrera). La app debe rechazar y dejar saldos en 7000/2000.
  try {
    await updateTxForceApplyFail(tx.id, { accountId: acc.id, type: "DEBT_PAYMENT", amount: 8000, debtId: debt.id, description: "t", transactionDate: "2026-01-01" }, uid);
    assert(false, "debió rechazarse");
  } catch (e) {
    assert(true, "rechazado tras rollback: " + e.message);
  }
  assert((await balanceAcc(acc.id)) === 7000, "Cuenta restaurada = 7000 (sin estado a medias)");
  assert((await balanceDebt(debt.id)) === 2000, "Deuda restaurada = 2000 (sin estado a medias)");
  const row = (await A.from("transactions").select("amount").eq("id", tx.id).single()).data;
  assert(norm(row.amount) === 3000, "Fila restaurada a 3000 (no quedó en 8000)");
  await clean();

  // ---- Caso H: eliminación atómica (RPC 013) deuda + saldos coherentes ----
  console.log("\n=== Caso H: DELETE atómico => fila borrada y saldos restaurados ===");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(5000, 5000, 5000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  assert((await balanceAcc(acc.id)) === 7000, "Antes del delete: Cuenta = 7000");
  assert((await balanceDebt(debt.id)) === 2000, "Antes del delete: Deuda = 2000");
  const txH = (await A.from("transactions").select("*").eq("id", tx.id).single()).data;
  await deleteTx(tx.id, uid, txH);
  assert((await balanceAcc(acc.id)) === 10000, "Tras delete atómico: Cuenta restaurada = 10000");
  assert((await balanceDebt(debt.id)) === 5000, "Tras delete atómico: Deuda restaurada = 5000");
  const { data: rowH } = await A.from("transactions").select("id").eq("id", tx.id);
  assert((rowH ?? []).length === 0, "La fila fue eliminada (0 filas)");
  await clean();

  console.log("\n=== RESULTADO: " + passed + " OK, " + failed + " FALLOS ===");
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error("\nERROR EN PRUEBA:", e.message);
  process.exit(1);
});
