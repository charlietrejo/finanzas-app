#!/usr/bin/env node
/**
 * Verifica manualmente contra un proyecto Supabase real la reconciliación de
 * saldo (sección 3.1): adjust_account_balance calcula la diferencia contra
 * el saldo calculado, crea el movimiento correcto (ingreso o gasto) con
 * is_adjustment=true y la categoría "Ajuste de saldo", afecta el saldo de la
 * cuenta, y esos movimientos quedan fuera del cálculo de gasto por
 * categoría (el mismo query que usa Presupuestos).
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
 *   node scripts/verify-account-balance-adjustment.mjs
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
const today = new Date().toISOString().slice(0, 10);

let pass = 0;
let fail = 0;
const cleanup = { accountIds: [] };

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
    .insert({ user_id: userId, name: "verify-adjust-account", type: "debit", initial_balance: 1000, current_balance: 1000 })
    .select()
    .single();
  if (accountError) throw accountError;
  cleanup.accountIds.push(account.id);

  console.log("\n1) Saldo real menor al calculado crea un gasto de ajuste");
  const { data: expenseTx, error: expenseError } = await supabase.rpc("adjust_account_balance", {
    p_account_id: account.id,
    p_real_balance: 850,
  });
  check("adjust_account_balance no da error", !expenseError);
  check("saldo de la cuenta baja a 850", (await getAccount(account.id)).current_balance === 850);
  check("la transacción es un gasto de 150", expenseTx?.type === "expense" && expenseTx?.amount === 150);
  check("is_adjustment=true", expenseTx?.is_adjustment === true);

  const { data: expenseCategory } = await supabase
    .from("categories")
    .select("id")
    .eq("id", expenseTx?.category_id)
    .single();
  check("categoría del ajuste es 'Ajuste de saldo' (gasto)", expenseCategory?.id === expenseTx?.category_id);
  const { data: expenseCategoryRow } = await supabase
    .from("categories")
    .select("name, type")
    .eq("id", expenseTx?.category_id)
    .single();
  check(
    "nombre/tipo de categoría correctos",
    expenseCategoryRow?.name === "Ajuste de saldo" && expenseCategoryRow?.type === "expense"
  );

  console.log("\n2) Saldo real mayor al calculado crea un ingreso de ajuste");
  const { data: incomeTx, error: incomeError } = await supabase.rpc("adjust_account_balance", {
    p_account_id: account.id,
    p_real_balance: 1200,
  });
  check("adjust_account_balance no da error", !incomeError);
  check("saldo de la cuenta sube a 1200", (await getAccount(account.id)).current_balance === 1200);
  check("la transacción es un ingreso de 350", incomeTx?.type === "income" && incomeTx?.amount === 350);
  check("is_adjustment=true", incomeTx?.is_adjustment === true);

  const { data: incomeCategoryRow } = await supabase
    .from("categories")
    .select("name, type")
    .eq("id", incomeTx?.category_id)
    .single();
  check(
    "categoría del ajuste es 'Ajuste de saldo' (ingreso)",
    incomeCategoryRow?.name === "Ajuste de saldo" && incomeCategoryRow?.type === "income"
  );

  console.log("\n3) Saldo real igual al calculado se rechaza (nada que ajustar)");
  const { error: noDiffError } = await supabase.rpc("adjust_account_balance", {
    p_account_id: account.id,
    p_real_balance: 1200,
  });
  check("rechaza cuando no hay diferencia", !!noDiffError);

  console.log("\n4) Saldo real negativo se rechaza");
  const { error: negativeError } = await supabase.rpc("adjust_account_balance", {
    p_account_id: account.id,
    p_real_balance: -1,
  });
  check("rechaza saldo negativo", !!negativeError);
  check("saldo de la cuenta no cambió", (await getAccount(account.id)).current_balance === 1200);

  console.log("\n5) Un gasto normal (no ajuste) sigue con is_adjustment=false por default");
  const { data: normalCategory } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "expense")
    .eq("is_essential", false)
    .limit(1)
    .single();
  const { data: normalTx, error: normalError } = await supabase.rpc("create_transaction", {
    p_account_id: account.id,
    p_type: "expense",
    p_amount: 80,
    p_date: today,
    p_category_id: normalCategory?.id ?? null,
  });
  check("create_transaction no da error", !normalError);
  check("is_adjustment=false por default", normalTx?.is_adjustment === false);

  console.log("\n6) El comparativo de Presupuestos (mismo query que budgets-data.ts) excluye los ajustes");
  const { data: monthRows, error: monthRowsError } = await supabase
    .from("transactions")
    .select("category_id, amount, is_adjustment")
    .eq("account_id", account.id)
    .eq("type", "expense")
    .eq("is_adjustment", false)
    .gte("date", `${today.slice(0, 7)}-01`);
  check("la query de presupuestos no da error", !monthRowsError);
  check(
    "solo trae el gasto normal (80), no el ajuste de 150",
    monthRows?.length === 1 && monthRows[0].amount === 80
  );

  console.log("\nLimpiando datos de prueba...");
  await supabase.from("accounts").delete().in("id", cleanup.accountIds);

  console.log(`\n${pass} pruebas OK, ${fail} fallidas.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
