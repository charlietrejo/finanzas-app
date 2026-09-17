#!/usr/bin/env node
/**
 * Auditoría de seguridad (Fase 6): confirma que un usuario no puede leer,
 * insertar-referenciando, actualizar ni borrar datos de otro usuario, y que
 * la nueva migración 013_rls_ownership_hardening.sql efectivamente rechaza
 * inserts que referencian IDs ajenos (account_id/category_id/debt_id/goal_id).
 *
 * Extendido (post-review de la sección 3.4.2/3.1) para cubrir las tablas y
 * RPC agregadas en 021_loans_given.sql y 023_account_balance_adjustment.sql:
 * loans_given, loan_repayments, create_loan_repayment y adjust_account_balance.
 * Antes de esta extensión, verify-loans-given.mjs / verify-account-balance-
 * adjustment.mjs solo probaban "funciona con tus propios datos", no "rechaza
 * los datos de otro usuario" — este script es el único con ese propósito.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   USER_A_EMAIL=... USER_A_PASSWORD=... \
 *   USER_B_EMAIL=... USER_B_PASSWORD=... \
 *   node scripts/verify-cross-user-isolation.mjs
 *
 * Ambos usuarios deben existir ya y tener el correo confirmado.
 */
import { createClient } from "@supabase/supabase-js";

const {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  USER_A_EMAIL,
  USER_A_PASSWORD,
  USER_B_EMAIL,
  USER_B_PASSWORD,
} = process.env;

if (
  !NEXT_PUBLIC_SUPABASE_URL ||
  !NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  !USER_A_EMAIL ||
  !USER_A_PASSWORD ||
  !USER_B_EMAIL ||
  !USER_B_PASSWORD
) {
  console.error("Faltan variables de entorno. Revisa el comentario al inicio de este script.");
  process.exit(1);
}

let pass = 0;
let fail = 0;
function check(label, condition) {
  if (condition) {
    console.log(`  OK  ${label}`);
    pass++;
  } else {
    console.log(`FALLO ${label}`);
    fail++;
  }
}

function freshClient() {
  return createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

async function main() {
  const clientA = freshClient();
  const clientB = freshClient();

  const { data: sessionA, error: errA } = await clientA.auth.signInWithPassword({
    email: USER_A_EMAIL,
    password: USER_A_PASSWORD,
  });
  if (errA) throw errA;
  const { data: sessionB, error: errB } = await clientB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });
  if (errB) throw errB;
  const userIdA = sessionA.user.id;
  const userIdB = sessionB.user.id;

  console.log("\n0) Setup: A crea sus propios datos, B crea una cuenta propia para los intentos de referencia cruzada");

  const { data: accA } = await clientA
    .from("accounts")
    .insert({ user_id: userIdA, name: "A-account", type: "debit", initial_balance: 1000, current_balance: 1000 })
    .select()
    .single();
  const { data: catA } = await clientA
    .from("categories")
    .insert({ user_id: userIdA, name: "A-category", type: "expense" })
    .select()
    .single();
  const { data: txA } = await clientA.rpc("create_transaction", {
    p_account_id: accA.id,
    p_type: "expense",
    p_amount: 50,
    p_date: new Date().toISOString().slice(0, 10),
    p_category_id: catA.id,
  });
  const { data: budgetA } = await clientA
    .from("budgets")
    .insert({ user_id: userIdA, category_id: catA.id, month: `${new Date().toISOString().slice(0, 7)}-01`, amount_limit: 500 })
    .select()
    .single();
  const { data: debtA } = await clientA
    .from("debts")
    .insert({ user_id: userIdA, name: "A-debt", type: "loan", principal: 1000, current_balance: 1000 })
    .select()
    .single();
  const { data: goalA } = await clientA
    .from("goals")
    .insert({ user_id: userIdA, name: "A-goal", target_amount: 1000, target_date: "2027-01-01" })
    .select()
    .single();

  const { data: accB } = await clientB
    .from("accounts")
    .insert({ user_id: userIdB, name: "B-account", type: "debit", initial_balance: 1000, current_balance: 1000 })
    .select()
    .single();

  // Préstamo otorgado por A (sección 3.4.2) y un cobro parcial, para probar
  // que B no puede leer/tocar loans_given ni loan_repayments de A. Una
  // transacción propia de B para probar las referencias cruzadas de
  // loan_repayments_insert_own sin depender también de su check de transacción.
  const loanA = await clientA.rpc("create_loan_given", {
    p_account_id: accA.id,
    p_debt_id: null,
    p_amount: 200,
    p_date: new Date().toISOString().slice(0, 10),
    p_category_id: catA.id,
    p_borrower_name: "Deudor de A",
  });
  const repaymentA = await clientA.rpc("create_loan_repayment", {
    p_loan_given_id: loanA.data.id,
    p_account_id: accA.id,
    p_amount: 50,
    p_date: new Date().toISOString().slice(0, 10),
  });
  const { data: txB } = await clientB.rpc("create_transaction", {
    p_account_id: accB.id,
    p_type: "expense",
    p_amount: 5,
    p_date: new Date().toISOString().slice(0, 10),
  });

  console.log("\n1) B no puede LEER datos de A");
  const readTests = [
    ["accounts", accA.id],
    ["categories", catA.id],
    ["transactions", txA.id],
    ["budgets", budgetA.id],
    ["debts", debtA.id],
    ["goals", goalA.id],
    ["loans_given", loanA.data.id],
    ["loan_repayments", repaymentA.data.id],
  ];
  for (const [table, id] of readTests) {
    const { data } = await clientB.from(table).select("*").eq("id", id);
    check(`B no puede leer ${table}/${id}`, (data ?? []).length === 0);
  }

  console.log("\n2) B no puede INSERTAR filas propias que referencien IDs de A (hardening de 013)");

  const { error: txCrossCategory } = await clientB.from("transactions").insert({
    user_id: userIdB,
    account_id: accB.id,
    category_id: catA.id, // ajeno
    type: "expense",
    amount: 10,
    date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza transacción propia con category_id ajeno", !!txCrossCategory);

  const { error: txCrossAccount } = await clientB.from("transactions").insert({
    user_id: userIdB,
    account_id: accA.id, // ajeno
    type: "expense",
    amount: 10,
    date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza transacción con account_id ajeno", !!txCrossAccount);

  const { error: budgetCross } = await clientB.from("budgets").insert({
    user_id: userIdB,
    category_id: catA.id, // ajeno
    month: `${new Date().toISOString().slice(0, 7)}-01`,
    amount_limit: 100,
  });
  check("rechaza presupuesto con category_id ajeno", !!budgetCross);

  const { error: debtPaymentCross } = await clientB.from("debt_payments").insert({
    user_id: userIdB,
    debt_id: debtA.id, // ajeno
    account_id: accB.id,
    amount: 10,
    date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza debt_payment con debt_id ajeno", !!debtPaymentCross);

  const { error: goalContribCross } = await clientB.from("goal_contributions").insert({
    user_id: userIdB,
    goal_id: goalA.id, // ajeno
    account_id: accB.id,
    amount: 10,
    date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza goal_contribution con goal_id ajeno", !!goalContribCross);

  const { error: loanGivenCross } = await clientB.from("loans_given").insert({
    user_id: userIdB,
    transaction_id: txA.id, // ajeno
    borrower_name: "x",
    current_balance: 10,
    status: "active",
  });
  check("rechaza loans_given con transaction_id ajeno", !!loanGivenCross);

  const { error: loanRepaymentCrossLoan } = await clientB.from("loan_repayments").insert({
    user_id: userIdB,
    loan_given_id: loanA.data.id, // ajeno
    transaction_id: txB.id, // propio
    amount: 5,
    date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza loan_repayment con loan_given_id ajeno", !!loanRepaymentCrossLoan);

  console.log("\n3) B no puede ACTUALIZAR ni BORRAR filas de A por id directo");

  const { data: updateResult } = await clientB.from("accounts").update({ name: "hackeado" }).eq("id", accA.id).select();
  check("update de B sobre cuenta de A afecta 0 filas", (updateResult ?? []).length === 0);

  const { data: deleteResult } = await clientB.from("categories").delete().eq("id", catA.id).select();
  check("delete de B sobre categoría de A afecta 0 filas", (deleteResult ?? []).length === 0);

  const { data: loanUpdateResult } = await clientB
    .from("loans_given")
    .update({ borrower_name: "hackeado" })
    .eq("id", loanA.data.id)
    .select();
  check("update de B sobre préstamo de A afecta 0 filas", (loanUpdateResult ?? []).length === 0);

  const { data: loanDeleteResult } = await clientB
    .from("loan_repayments")
    .delete()
    .eq("id", repaymentA.data.id)
    .select();
  check("delete de B sobre cobro de préstamo de A afecta 0 filas", (loanDeleteResult ?? []).length === 0);

  console.log("\n4) Las RPC siguen rechazando IDs ajenos (regresión, ya funcionaba antes del fix)");

  const { error: rpcTxCross } = await clientB.rpc("create_transaction", {
    p_account_id: accA.id,
    p_type: "expense",
    p_amount: 10,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("create_transaction rechaza account_id ajeno", !!rpcTxCross);

  const { error: rpcDebtCross } = await clientB.rpc("create_debt_payment", {
    p_debt_id: debtA.id,
    p_account_id: accB.id,
    p_amount: 10,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("create_debt_payment rechaza debt_id ajeno", !!rpcDebtCross);

  const { error: rpcGoalCross } = await clientB.rpc("create_goal_contribution", {
    p_goal_id: goalA.id,
    p_account_id: accB.id,
    p_amount: 10,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("create_goal_contribution rechaza goal_id ajeno", !!rpcGoalCross);

  const { error: rpcLoanRepaymentCross } = await clientB.rpc("create_loan_repayment", {
    p_loan_given_id: loanA.data.id,
    p_account_id: accB.id,
    p_amount: 10,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("create_loan_repayment rechaza loan_given_id ajeno", !!rpcLoanRepaymentCross);

  const { error: rpcAdjustBalanceCross } = await clientB.rpc("adjust_account_balance", {
    p_account_id: accA.id,
    p_real_balance: 999,
  });
  check("adjust_account_balance rechaza account_id ajeno", !!rpcAdjustBalanceCross);

  console.log("\nLimpiando datos de prueba...");
  await clientA.from("goals").delete().eq("id", goalA.id);
  await clientA.from("debts").delete().eq("id", debtA.id);
  await clientA.from("budgets").delete().eq("id", budgetA.id);
  await clientA.from("accounts").delete().eq("id", accA.id); // cascada: borra txA
  await clientA.from("categories").delete().eq("id", catA.id);
  await clientB.from("accounts").delete().eq("id", accB.id);

  console.log(`\n${pass} pruebas OK, ${fail} fallidas.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
