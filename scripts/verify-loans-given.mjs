#!/usr/bin/env node
/**
 * Verifica manualmente contra un proyecto Supabase real las reglas de
 * préstamos otorgados (sección 3.4.2): atomicidad gasto+loans_given al crear
 * un préstamo, atomicidad ingreso+saldo pendiente al cobrar (parcial y
 * total), status pasa a 'paid' al llegar a 0, y rechazos de datos inválidos.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
 *   node scripts/verify-loans-given.mjs
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

async function getLoan(id) {
  const { data, error } = await supabase.from("loans_given").select("*").eq("id", id).single();
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

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Préstamo")
    .eq("type", "expense")
    .single();
  if (categoryError) throw categoryError;

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({ user_id: userId, name: "verify-loans-account", type: "debit", initial_balance: 1000, current_balance: 1000 })
    .select()
    .single();
  if (accountError) throw accountError;
  cleanup.accountIds.push(account.id);

  console.log("\n1) Elegir cuenta Y tarjeta a la vez (o ninguna) se rechaza");
  const { error: bothError } = await supabase.rpc("create_loan_given", {
    p_account_id: null,
    p_debt_id: null,
    p_amount: 300,
    p_date: today,
    p_category_id: category.id,
    p_borrower_name: "Nadie",
  });
  check("rechaza sin cuenta ni tarjeta", !!bothError);

  console.log("\n2) Crear préstamo: gasto normal + loans_given atómicos");
  const { data: loan, error: loanError } = await supabase.rpc("create_loan_given", {
    p_account_id: account.id,
    p_debt_id: null,
    p_amount: 300,
    p_date: today,
    p_category_id: category.id,
    p_borrower_name: "Juan Pérez",
    p_expected_return_date: null,
  });
  check("create_loan_given no da error", !loanError);
  check("saldo de la cuenta baja a 700", (await getAccount(account.id)).current_balance === 700);
  check("loans_given.current_balance arranca en 300", loan?.current_balance === 300);
  check("status arranca 'active'", loan?.status === "active");

  const { data: originTx } = await supabase
    .from("transactions")
    .select("type, amount, category_id")
    .eq("id", loan.transaction_id)
    .single();
  check("la transacción original es un gasto de 300 con categoría Préstamo", originTx?.type === "expense" && originTx?.amount === 300 && originTx?.category_id === category.id);

  console.log("\n3) Cobro parcial reduce el saldo pendiente sin marcar pagado");
  const { error: partialError } = await supabase.rpc("create_loan_repayment", {
    p_loan_given_id: loan.id,
    p_account_id: account.id,
    p_amount: 100,
    p_date: today,
  });
  check("create_loan_repayment (parcial) no da error", !partialError);
  check("saldo de la cuenta sube a 800", (await getAccount(account.id)).current_balance === 800);
  check("saldo pendiente del préstamo baja a 200", (await getLoan(loan.id)).current_balance === 200);
  check("sigue 'active' (no llegó a 0)", (await getLoan(loan.id)).status === "active");

  console.log("\n4) Cobro que excede el saldo pendiente se rechaza");
  const { error: overError } = await supabase.rpc("create_loan_repayment", {
    p_loan_given_id: loan.id,
    p_account_id: account.id,
    p_amount: 500,
    p_date: today,
  });
  check("rechaza cobro mayor al saldo pendiente", !!overError);
  check("saldo pendiente no cambió", (await getLoan(loan.id)).current_balance === 200);

  console.log("\n5) Cobro final marca el préstamo como pagado");
  const { error: finalError } = await supabase.rpc("create_loan_repayment", {
    p_loan_given_id: loan.id,
    p_account_id: account.id,
    p_amount: 200,
    p_date: today,
  });
  check("create_loan_repayment (final) no da error", !finalError);
  check("saldo de la cuenta vuelve a 1000 (recuperó todo el préstamo)", (await getAccount(account.id)).current_balance === 1000);
  const paidLoan = await getLoan(loan.id);
  check("saldo pendiente llega a 0", paidLoan.current_balance === 0);
  check("status pasa a 'paid'", paidLoan.status === "paid");

  console.log("\n6) Cobrar un préstamo ya pagado se rechaza");
  const { error: alreadyPaidError } = await supabase.rpc("create_loan_repayment", {
    p_loan_given_id: loan.id,
    p_account_id: account.id,
    p_amount: 1,
    p_date: today,
  });
  check("rechaza cobro sobre préstamo ya pagado", !!alreadyPaidError);

  console.log("\nLimpiando datos de prueba...");
  // loans_given/loan_repayments se borran en cascada al borrar la cuenta ->
  // transacciones (ON DELETE CASCADE encadenado: accounts -> transactions ->
  // loans_given -> loan_repayments).
  await supabase.from("accounts").delete().in("id", cleanup.accountIds);

  console.log(`\n${pass} pruebas OK, ${fail} fallidas.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
