#!/usr/bin/env node
/**
 * Verifica manualmente contra un proyecto Supabase real las reglas de
 * aportaciones a metas de ahorro (sección 3.5 / 5): atomicidad cuenta+meta,
 * rechazo si deja la cuenta en negativo, y reversión correcta al eliminar
 * una aportación.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
 *   node scripts/verify-goal-contribution-rpc.mjs
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
const cleanup = { accountIds: [], goalIds: [] };

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

async function getGoal(id) {
  const { data, error } = await supabase.from("goals").select("*").eq("id", id).single();
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
    .insert({ user_id: userId, name: "verify-goal-account", type: "debit", initial_balance: 500, current_balance: 500 })
    .select()
    .single();
  if (accountError) throw accountError;
  cleanup.accountIds.push(account.id);

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .insert({ user_id: userId, name: "verify-goal", target_amount: 1000, current_amount: 0, target_date: "2027-01-01" })
    .select()
    .single();
  if (goalError) throw goalError;
  cleanup.goalIds.push(goal.id);

  console.log("\n1) Aportación sin fondos suficientes se rechaza");
  const { error: insufficientError } = await supabase.rpc("create_goal_contribution", {
    p_goal_id: goal.id,
    p_account_id: account.id,
    p_amount: 600,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza aportación sin fondos suficientes", !!insufficientError);
  check("current_amount de la meta no cambió", (await getGoal(goal.id)).current_amount === 0);

  console.log("\n2) Aportación válida descuenta cuenta y suma a la meta atómicamente");
  const { data: contribution, error: contributionError } = await supabase.rpc("create_goal_contribution", {
    p_goal_id: goal.id,
    p_account_id: account.id,
    p_amount: 300,
    p_date: new Date().toISOString().slice(0, 10),
    p_note: "aportación de prueba",
  });
  check("la aportación se registra sin error", !contributionError);
  check("saldo de la cuenta baja a 200", (await getAccount(account.id)).current_balance === 200);
  check("current_amount de la meta sube a 300", (await getGoal(goal.id)).current_amount === 300);

  console.log("\n3) Eliminar la aportación revierte ambos saldos");
  if (contribution) {
    const { error: deleteError } = await supabase.rpc("delete_goal_contribution", { p_id: contribution.id });
    check("delete_goal_contribution no da error", !deleteError);
    check("saldo de la cuenta vuelve a 500", (await getAccount(account.id)).current_balance === 500);
    check("current_amount de la meta vuelve a 0", (await getGoal(goal.id)).current_amount === 0);
  }

  console.log("\nLimpiando datos de prueba...");
  await supabase.from("goals").delete().in("id", cleanup.goalIds);
  await supabase.from("accounts").delete().in("id", cleanup.accountIds);

  console.log(`\n${pass} pruebas OK, ${fail} fallidas.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
