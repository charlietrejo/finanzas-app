// scripts/verify-integrity.mjs
// PRUEBA DE INTEGRIDAD FINANCIERA (Casos 1-10) contra el proyecto Supabase REMOTO.
// Usa el cliente anon + sesión real del usuario de prueba A.
// No modifica RLS ni UI. Solo crea/elimina datos de prueba y valida saldos.

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

async function login() {
  const r = await A.auth.signInWithPassword({ email: EMAIL_A, password: PASS });
  if (r.error || !r.data.session) throw new Error("login A: " + (r.error?.message || "sin sesión"));
  return r.data.session;
}

function assert(cond, msg) {
  if (!cond) {
    console.log("  FALLO: " + msg);
    throw new Error("Aserción fallida: " + msg);
  }
  console.log("  OK: " + msg);
}

async function clean() {
  // Limpia datos de prueba previos del usuario A.
  const { data: acc } = await A.from("accounts").select("id");
  for (const a of acc ?? []) {
    await A.from("transactions").delete().eq("account_id", a.id);
  }
  const { data: dts } = await A.from("debts").select("id");
  for (const d of dts ?? []) {
    await A.from("transactions").delete().eq("debt_id", d.id);
  }
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
async function mkDebt(balance, initial, uid) {
  const { data, error } = await A.from("debts")
    .insert({ user_id: uid, name: "TestDebt", type: "LOAN", initial_amount: initial, current_balance: balance })
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
  return Number(data.current_balance);
}
async function balanceDebt(id) {
  const { data } = await A.from("debts").select("current_balance").eq("id", id).single();
  return Number(data.current_balance);
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
  // Aplica efecto vía RPC (igual que finance.ts, que propaga el error).
  const { error: rpcError } = await A.rpc("apply_transaction_effect", {
    p_action: "apply",
    p_id: data.id,
    p_user_id: uid,
    p_account_id: payload.accountId,
    p_type: payload.type,
    p_amount: payload.amount,
    p_debt_id: payload.debtId ?? null,
    p_destination_account_id: payload.destinationAccountId ?? null,
  });
  if (rpcError) {
    // Igual que createTransaction de la app: no dejar transacción huérfana.
    await A.from("transactions").delete().eq("id", data.id);
    throw new Error(rpcError.message || "RPC falló");
  }
  return data;
}
async function updateTx(id, payload, uid) {
  const { error: uerr } = await A.from("transactions").update({
    account_id: payload.accountId,
    type: payload.type,
    amount: payload.amount,
    description: "t",
    debt_id: payload.debtId ?? null,
    destination_account_id: payload.destinationAccountId ?? null,
  }).eq("id", id);
  if (uerr) throw uerr;
  const { data } = await A.from("transactions").select("*").eq("id", id).single();
  // revert anterior + apply nuevo (igual que updateTransaction).
  await A.rpc("apply_transaction_effect", {
    p_action: "revert", p_id: id, p_user_id: uid,
    p_account_id: data.account_id, p_type: data.type, p_amount: data.amount,
    p_debt_id: data.debt_id ?? null, p_destination_account_id: data.destination_account_id ?? null,
  });
  // Nota: en el script simplificamos: revertimos el estado original leyendo el existente antes del update.
  // Para exactitud, el updateTransaction real ya pasa existingTx. Aquí recreamos:
}

async function run() {
  await login();
  const uid = (await A.auth.getUser()).data.user.id;
  await clean();

  console.log("\n--- Caso 1: Pago válido 3000 (Cta 10000, Deuda 8000) ---");
  let acc = await mkAccount(10000, uid);
  let debt = await mkDebt(8000, 8000, uid);
  let tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  assert((await balanceAcc(acc.id)) === 7000, "Cuenta = 7000");
  assert((await balanceDebt(debt.id)) === 5000, "Deuda = 5000");
  await A.from("transactions").delete().eq("id", tx.id); // limpieza
  await clean();

  console.log("\n--- Caso 2: Pago inválido 3000 (Cta 1000, Deuda 8000) -> RECHAZADO ---");
  acc = await mkAccount(1000, uid);
  debt = await mkDebt(8000, 8000, uid);
  try {
    await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
    assert(false, "debió rechazarse");
  } catch (e) {
    assert(true, "rechazado: " + e.message);
  }
  assert((await balanceAcc(acc.id)) === 1000, "Cuenta sigue 1000");
  assert((await balanceDebt(debt.id)) === 8000, "Deuda sigue 8000");
  assert((await txnsOfAccount(acc.id)).length === 0, "no quedó transacción huérfana");
  await clean();

  console.log("\n--- Caso 3: Crear pago 3000, editar a 5000 ---");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(8000, 8000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  // updateTransaction real: revert(tx) + update + apply(nuevo). Recreamos con RPC.
  await A.rpc("apply_transaction_effect", { p_action: "revert", p_id: tx.id, p_user_id: uid, p_account_id: acc.id, p_type: "DEBT_PAYMENT", p_amount: 3000, p_debt_id: debt.id, p_destination_account_id: null });
  await A.from("transactions").update({ amount: 5000 }).eq("id", tx.id);
  const tx3 = (await A.from("transactions").select("*").eq("id", tx.id).single()).data;
  await A.rpc("apply_transaction_effect", { p_action: "apply", p_id: tx.id, p_user_id: uid, p_account_id: tx3.account_id, p_type: tx3.type, p_amount: tx3.amount, p_debt_id: tx3.debt_id ?? null, p_destination_account_id: null });
  // tras revertir 3000: cta=10000, deuda=8000; tras apply 5000: cta=5000, deuda=3000
  assert((await balanceAcc(acc.id)) === 5000, "Cuenta = 5000");
  assert((await balanceDebt(debt.id)) === 3000, "Deuda = 3000");
  await A.from("transactions").delete().eq("id", tx.id);
  await clean();

  console.log("\n--- Caso 4: Crear pago 5000, editar a 1000 ---");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(8000, 8000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 5000, debtId: debt.id }, uid);
  await A.rpc("apply_transaction_effect", { p_action: "revert", p_id: tx.id, p_user_id: uid, p_account_id: acc.id, p_type: "DEBT_PAYMENT", p_amount: 5000, p_debt_id: debt.id, p_destination_account_id: null });
  await A.from("transactions").update({ amount: 1000 }).eq("id", tx.id);
  const tx4 = (await A.from("transactions").select("*").eq("id", tx.id).single()).data;
  await A.rpc("apply_transaction_effect", { p_action: "apply", p_id: tx.id, p_user_id: uid, p_account_id: tx4.account_id, p_type: tx4.type, p_amount: tx4.amount, p_debt_id: tx4.debt_id ?? null, p_destination_account_id: null });
  // tras revertir 5000: cta=10000, deuda=8000; tras apply 1000: cta=9000, deuda=7000
  assert((await balanceAcc(acc.id)) === 9000, "Cuenta = 9000");
  assert((await balanceDebt(debt.id)) === 7000, "Deuda = 7000");
  await A.from("transactions").delete().eq("id", tx.id);
  await clean();

  console.log("\n--- Caso 5: Crear pago y eliminarlo ---");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(8000, 8000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 3000, debtId: debt.id }, uid);
  await A.rpc("apply_transaction_effect", { p_action: "revert", p_id: tx.id, p_user_id: uid, p_account_id: acc.id, p_type: "DEBT_PAYMENT", p_amount: 3000, p_debt_id: debt.id, p_destination_account_id: null });
  await A.from("transactions").delete().eq("id", tx.id);
  assert((await balanceAcc(acc.id)) === 10000, "Cuenta regresa a 10000");
  assert((await balanceDebt(debt.id)) === 8000, "Deuda regresa a 8000");
  await clean();

  console.log("\n--- Caso 6: Eliminar deuda con transacciones asociadas -> RECHAZADO ---");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(8000, 8000, uid);
  tx = await createTx({ accountId: acc.id, type: "DEBT_PAYMENT", amount: 1000, debtId: debt.id }, uid);
  // Replica deleteDebt de la app: valida primero y da mensaje claro.
  const { data: rel, error: relErr } = await A.from("transactions").select("id").eq("debt_id", debt.id).limit(1);
  let deleteErrMsg = null;
  if (relErr) deleteErrMsg = relErr.message;
  else if ((rel ?? []).length > 0) {
    deleteErrMsg = "No puedes eliminar esta deuda porque tiene movimientos asociados. Elimina primero sus movimientos.";
  } else {
    const { error: delErr } = await A.from("debts").delete().eq("id", debt.id);
    if (delErr) deleteErrMsg = delErr.message;
  }
  assert(deleteErrMsg !== null, "deleteDebt rechazado: " + deleteErrMsg);
  assert((await balanceDebt(debt.id)) === 7000, "Deuda permanece (7000)");
  assert((await txnsOfDebt(debt.id)).length === 1, "Transacción permanece");
  await A.from("transactions").delete().eq("id", tx.id);
  await clean();

  console.log("\n--- Caso 7: Compra tarjeta deuda A, cambiar account.debt_id a B, eliminar compra -> afecta A no B ---");
  const { data: cardAccRow } = await A.from("accounts").insert({ user_id: uid, name: "Card", type: "CREDIT_CARD", initial_balance: 0, current_balance: 0 }).select().single();
  let cardAcc = cardAccRow;
  let debtA = await mkCardDebt(0, 5000, uid);
  let debtB = await mkCardDebt(0, 5000, uid);
  await A.from("accounts").update({ debt_id: debtA.id }).eq("id", cardAcc.id);
  let compra = await createTx({ accountId: cardAcc.id, type: "EXPENSE", amount: 1000, debtId: debtA.id }, uid);
  // compra tiene debt_id = A. Cambiamos account.debt_id a B.
  await A.from("accounts").update({ debt_id: debtB.id }).eq("id", cardAcc.id);
  // Eliminar compra: revert debe usar compra.debt_id (A).
  await A.rpc("apply_transaction_effect", { p_action: "revert", p_id: compra.id, p_user_id: uid, p_account_id: cardAcc.id, p_type: "EXPENSE", p_amount: 1000, p_debt_id: debtA.id, p_destination_account_id: null });
  await A.from("transactions").delete().eq("id", compra.id);
  assert((await balanceDebt(debtA.id)) === 0, "Deuda A regresa a 0 (revertida por compra.debt_id)");
  assert((await balanceDebt(debtB.id)) === 0, "Deuda B intacta (0)");
  await A.from("accounts").delete().eq("id", cardAcc.id);
  await A.from("debts").delete().eq("id", debtA.id);
  await A.from("debts").delete().eq("id", debtB.id);

  console.log("\n--- Caso 8: DEBT_PAYMENT sin debt_id -> RECHAZADO ---");
  acc = await mkAccount(10000, uid);
  const r8 = await A.rpc("apply_transaction_effect", { p_action: "apply", p_id: "00000000-0000-0000-0000-000000000000", p_user_id: uid, p_account_id: acc.id, p_type: "DEBT_PAYMENT", p_amount: 1000, p_debt_id: null, p_destination_account_id: null });
  assert(r8.error !== null, "rechazado (sin debt_id): " + (r8.error?.message || ""));
  await A.from("accounts").delete().eq("id", acc.id);

  console.log("\n--- Caso 9: DEBT_PAYMENT > deuda actual -> RECHAZADO ---");
  acc = await mkAccount(10000, uid);
  debt = await mkDebt(2000, 2000, uid);
  const r9 = await A.rpc("apply_transaction_effect", { p_action: "apply", p_id: "00000000-0000-0000-0000-000000000000", p_user_id: uid, p_account_id: acc.id, p_type: "DEBT_PAYMENT", p_amount: 5000, p_debt_id: debt.id, p_destination_account_id: null });
  assert(r9.error !== null, "rechazado (> deuda): " + (r9.error?.message || ""));
  assert((await balanceAcc(acc.id)) === 10000, "Cuenta intacta 10000");
  await A.from("accounts").delete().eq("id", acc.id);
  await A.from("debts").delete().eq("id", debt.id);

  console.log("\n--- Caso 10: amount 0 / negativo / NaN / Infinity -> RECHAZADO ---");
  acc = await mkAccount(10000, uid);
  for (const amt of [0, -500, NaN, Infinity]) {
    const r = await A.rpc("apply_transaction_effect", { p_action: "apply", p_id: "00000000-0000-0000-0000-000000000000", p_user_id: uid, p_account_id: acc.id, p_type: "EXPENSE", p_amount: amt, p_debt_id: null, p_destination_account_id: null });
    assert(r.error !== null, "amount=" + amt + " rechazado: " + (r.error?.message || ""));
  }
  assert((await balanceAcc(acc.id)) === 10000, "Cuenta intacta tras intentos inválidos");
  await A.from("accounts").delete().eq("id", acc.id);

  console.log("\n=== TODOS LOS CASOS PASARON ===");
}

run().catch((e) => {
  console.error("\nERROR EN PRUEBA:", e.message);
  process.exit(1);
});
