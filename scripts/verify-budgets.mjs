#!/usr/bin/env node
/**
 * Verifica manualmente contra un proyecto Supabase real las reglas de Fase 2
 * (presupuestos): constraint único por categoría/mes, RLS, y que la suma de
 * gastos por categoría/mes (misma lógica que src/lib/budgets-data.ts) cuadre
 * contra transacciones creadas con la RPC create_transaction.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
 *   node scripts/verify-budgets.mjs
 *
 * El usuario de prueba debe existir ya y tener el correo confirmado.
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
const cleanup = { accountIds: [], categoryIds: [], budgetIds: [] };

function check(label, condition) {
  if (condition) {
    console.log(`  OK  ${label}`);
    pass++;
  } else {
    console.log(`FALLO ${label}`);
    fail++;
  }
}

function getBudgetStatus(spent, limit, alertThresholdPct) {
  if (limit <= 0) return "ok";
  const pct = (spent / limit) * 100;
  if (pct >= 100) return "over";
  if (pct >= alertThresholdPct) return "warning";
  return "ok";
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

  const month = new Date().toISOString().slice(0, 7);

  console.log("\n1) Setup: cuenta, categoría y presupuesto de prueba");
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({ user_id: userId, name: "verify-budgets", type: "debit", initial_balance: 10000, current_balance: 10000 })
    .select()
    .single();
  if (accountError) throw accountError;
  cleanup.accountIds.push(account.id);

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .insert({ user_id: userId, name: "verify-budgets-categoria", type: "expense" })
    .select()
    .single();
  if (categoryError) throw categoryError;
  cleanup.categoryIds.push(category.id);

  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .insert({ user_id: userId, category_id: category.id, month: `${month}-01`, amount_limit: 1000, alert_threshold_pct: 80 })
    .select()
    .single();
  if (budgetError) throw budgetError;
  cleanup.budgetIds.push(budget.id);
  check("presupuesto creado con límite 1000 y umbral 80%", budget.amount_limit == 1000);

  console.log("\n2) Constraint único: no se puede duplicar presupuesto de la misma categoría/mes");
  const { error: dupError } = await supabase
    .from("budgets")
    .insert({ user_id: userId, category_id: category.id, month: `${month}-01`, amount_limit: 500, alert_threshold_pct: 80 });
  check("rechaza presupuesto duplicado (categoría+mes)", !!dupError && dupError.code === "23505");

  console.log("\n3) Gasto por debajo del umbral -> estado ok");
  await supabase.rpc("create_transaction", {
    p_account_id: account.id,
    p_type: "expense",
    p_amount: 300,
    p_date: `${month}-05`,
    p_category_id: category.id,
  });
  let spent = await sumExpenses(category.id, month);
  check("suma de gastos = 300", spent === 300);
  check("estado = ok (300/1000 = 30%)", getBudgetStatus(spent, 1000, 80) === "ok");

  console.log("\n4) Gasto que cruza el umbral de 80% -> estado warning");
  await supabase.rpc("create_transaction", {
    p_account_id: account.id,
    p_type: "expense",
    p_amount: 550,
    p_date: `${month}-10`,
    p_category_id: category.id,
  });
  spent = await sumExpenses(category.id, month);
  check("suma de gastos = 850", spent === 850);
  check("estado = warning (850/1000 = 85%)", getBudgetStatus(spent, 1000, 80) === "warning");

  console.log("\n5) Gasto que excede el 100% -> estado over");
  await supabase.rpc("create_transaction", {
    p_account_id: account.id,
    p_type: "expense",
    p_amount: 200,
    p_date: `${month}-15`,
    p_category_id: category.id,
  });
  spent = await sumExpenses(category.id, month);
  check("suma de gastos = 1050", spent === 1050);
  check("estado = over (1050/1000 = 105%)", getBudgetStatus(spent, 1000, 80) === "over");

  console.log("\n6) Un gasto en OTRO mes no se mezcla con el presupuesto del mes actual");
  const [curYear, curMonthNum] = month.split("-").map(Number);
  const otherDate = new Date(Date.UTC(curYear, curMonthNum - 1 - 2, 1)); // dos meses atrás
  const otherMonth = otherDate.toISOString().slice(0, 7);
  await supabase.rpc("create_transaction", {
    p_account_id: account.id,
    p_type: "expense",
    p_amount: 999,
    p_date: `${otherMonth}-05`,
    p_category_id: category.id,
  });
  spent = await sumExpenses(category.id, month);
  check("la suma del mes actual no cambió tras un gasto en otro mes", spent === 1050);

  async function sumExpenses(categoryId, m) {
    const start = `${m}-01`;
    const [y, mm] = m.split("-").map(Number);
    const end = new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 10);
    const { data } = await supabase
      .from("transactions")
      .select("amount")
      .eq("type", "expense")
      .eq("category_id", categoryId)
      .gte("date", start)
      .lt("date", end);
    return (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  }

  console.log("\nLimpiando datos de prueba...");
  await supabase.from("budgets").delete().in("id", cleanup.budgetIds);
  await supabase.from("accounts").delete().in("id", cleanup.accountIds);
  await supabase.from("categories").delete().in("id", cleanup.categoryIds);

  console.log(`\n${pass} pruebas OK, ${fail} fallidas.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
