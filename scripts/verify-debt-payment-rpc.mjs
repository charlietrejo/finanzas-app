#!/usr/bin/env node
/**
 * Verifica manualmente contra un proyecto Supabase real las reglas de pagos
 * de deuda (sección 3.4 / 5): atomicidad cuenta+deuda, rechazo si el pago
 * excede el saldo de la deuda, rechazo si deja la cuenta en negativo, y
 * reversión correcta al eliminar un pago.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
 *   node scripts/verify-debt-payment-rpc.mjs
 */
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD } =
  process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY || !TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  console.error(
    "Faltan variables de entorno. Revisa el comentario al inicio de este script para el uso correcto."
  );
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);

let pass = 0;
let fail = 0;
const cleanup = { accountIds: [], debtIds: [] };

function check(label, condition) {
  if (condition) {
    console.log(`  OK  ${label}`);
    pass++;
  } else {
    console.log(`FALLO ${label}`);
    fail++;
  }
}

async function getAccount(id) {
  const { data, error } = await supabase.from("accounts").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function getDebt(id) {
  const { data, error } = await supabase.from("debts").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function main() {
  const { data: userData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  if (signInError) {
    console.error("No se pudo iniciar sesión con el usuario de prueba:", signInError.message);
    process.exit(1);
  }
  const userId = userData.user.id;

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({ user_id: userId, name: "verify-debt-account", type: "debit", initial_balance: 500, current_balance: 500 })
    .select()
    .single();
  if (accountError) throw accountError;
  cleanup.accountIds.push(account.id);

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .insert({ user_id: userId, name: "verify-debt", type: "credit_card", principal: 1000, current_balance: 1000, interest_rate: 30, minimum_payment: 100 })
    .select()
    .single();
  if (debtError) throw debtError;
  cleanup.debtIds.push(debt.id);

  console.log("\n1) Pago que excede el saldo de la deuda se rechaza");
  const { error: overpayError } = await supabase.rpc("create_debt_payment", {
    p_debt_id: debt.id,
    p_account_id: account.id,
    p_amount: 1500,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza pago mayor al saldo de la deuda", !!overpayError);
  check("saldo de la deuda no cambió", (await getDebt(debt.id)).current_balance === 1000);
  check("saldo de la cuenta no cambió", (await getAccount(account.id)).current_balance === 500);

  console.log("\n2) Pago que dejaría la cuenta en negativo se rechaza");
  const { error: insufficientError } = await supabase.rpc("create_debt_payment", {
    p_debt_id: debt.id,
    p_account_id: account.id,
    p_amount: 600,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza pago sin fondos suficientes en la cuenta", !!insufficientError);

  console.log("\n3) Pago válido descuenta cuenta y deuda atómicamente");
  const { data: payment, error: paymentError } = await supabase.rpc("create_debt_payment", {
    p_debt_id: debt.id,
    p_account_id: account.id,
    p_amount: 300,
    p_date: new Date().toISOString().slice(0, 10),
    p_note: "pago de prueba",
  });
  check("el pago se registra sin error", !paymentError);
  check("saldo de la cuenta baja a 200", (await getAccount(account.id)).current_balance === 200);
  check("saldo de la deuda baja a 700", (await getDebt(debt.id)).current_balance === 700);

  console.log("\n4) Eliminar el pago revierte ambos saldos");
  if (payment) {
    const { error: deleteError } = await supabase.rpc("delete_debt_payment", { p_id: payment.id });
    check("delete_debt_payment no da error", !deleteError);
    check("saldo de la cuenta vuelve a 500", (await getAccount(account.id)).current_balance === 500);
    check("saldo de la deuda vuelve a 1000", (await getDebt(debt.id)).current_balance === 1000);
  }

  console.log("\nLimpiando datos de prueba...");
  await supabase.from("debts").delete().in("id", cleanup.debtIds);
  await supabase.from("accounts").delete().in("id", cleanup.accountIds);

  console.log(`\n${pass} pruebas OK, ${fail} fallidas.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
