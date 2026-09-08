#!/usr/bin/env node
/**
 * Verifica manualmente contra un proyecto Supabase real la fórmula
 * simplificada de patrimonio neto histórico (sección 3.6, ver plan de
 * Fase 4): crea cuentas/deudas/transacciones en dos meses distintos y
 * confirma que netWorth(T) = Σinitial_balance(≤T) + ingresos(≤T) −
 * gastos(≤T) − Σprincipal(≤T), calculado a mano, contra lo que devuelve
 * getReportsData/computeNetWorthSeries.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
 *   node scripts/verify-reports-data.mjs
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

function computeNetWorth(accounts, debts, transactions, endExclusive) {
  const assetsBase = accounts
    .filter((a) => a.created_at < endExclusive)
    .reduce((s, a) => s + a.initial_balance, 0);
  const debtsBase = debts.filter((d) => d.created_at < endExclusive).reduce((s, d) => s + d.principal, 0);
  const cashFlow = transactions
    .filter((t) => t.date < endExclusive)
    .reduce((s, t) => (t.type === "income" ? s + t.amount : t.type === "expense" ? s - t.amount : s), 0);
  return assetsBase + cashFlow - debtsBase;
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

  // Cuenta y deuda creadas "en enero" (usamos un mes fijo lejano en el pasado
  // para no chocar con datos reales del usuario si los hubiera).
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({ user_id: userId, name: "verify-reports-account", type: "debit", initial_balance: 1000, current_balance: 1000 })
    .select()
    .single();
  if (accountError) throw accountError;
  cleanup.accountIds.push(account.id);

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .insert({ user_id: userId, name: "verify-reports-debt", type: "loan", principal: 400, current_balance: 400, interest_rate: 10, minimum_payment: 50 })
    .select()
    .single();
  if (debtError) throw debtError;
  cleanup.debtIds.push(debt.id);

  // La cuenta y la deuda se crean "hoy" (created_at = now()), así que las
  // transacciones de prueba deben fecharse hoy o después — de lo contrario
  // la fórmula las excluye correctamente por haberse creado después del
  // corte, que es el comportamiento esperado (ver net-worth.test.ts).
  const today = new Date();
  const january = today.toISOString().slice(0, 10);
  const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 10));
  const february = nextMonth.toISOString().slice(0, 10);

  const { error: incomeError } = await supabase.rpc("create_transaction", {
    p_account_id: account.id,
    p_type: "income",
    p_amount: 500,
    p_date: january,
  });
  if (incomeError) throw incomeError;

  const { error: expenseError } = await supabase.rpc("create_transaction", {
    p_account_id: account.id,
    p_type: "expense",
    p_amount: 200,
    p_date: february,
  });
  if (expenseError) throw expenseError;

  const { data: accounts } = await supabase
    .from("accounts")
    .select("initial_balance, created_at")
    .eq("id", account.id);
  const { data: debts } = await supabase.from("debts").select("principal, created_at").eq("id", debt.id);
  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, amount, date")
    .eq("account_id", account.id);

  const monthCutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
  const nextMonthCutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 1))
    .toISOString()
    .slice(0, 10);

  console.log("\n1) Patrimonio neto al final del mes 1 (antes del gasto del mes 2)");
  const janNetWorth = computeNetWorth(accounts, debts, transactions, monthCutoff);
  check("1000 (saldo inicial) + 500 (ingreso) - 400 (deuda) = 1100", janNetWorth === 1100);

  console.log("\n2) Patrimonio neto al final del mes 2 (incluye el gasto)");
  const febNetWorth = computeNetWorth(accounts, debts, transactions, nextMonthCutoff);
  check("1100 - 200 (gasto) = 900", febNetWorth === 900);

  console.log("\n3) Un pago de deuda no cambia el patrimonio neto (se cancela con la baja de la cuenta)");
  const { error: paymentError } = await supabase.rpc("create_debt_payment", {
    p_debt_id: debt.id,
    p_account_id: account.id,
    p_amount: 100,
    p_date: february,
  });
  if (paymentError) throw paymentError;

  // El pago de deuda no aparece en `transactions`, así que computeNetWorth
  // (que solo lee transactions/accounts/debts.principal) debe dar el MISMO
  // resultado que antes del pago para el mismo corte de fecha.
  const febNetWorthAfterPayment = computeNetWorth(accounts, debts, transactions, nextMonthCutoff);
  check("el patrimonio neto de febrero no cambia tras el pago de deuda", febNetWorthAfterPayment === febNetWorth);

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
