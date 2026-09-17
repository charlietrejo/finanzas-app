#!/usr/bin/env node
/**
 * Verifica manualmente contra un proyecto Supabase real la RPC
 * confirm_recurring_occurrence (secciones 3.2/3.4.1 del doc,
 * 024_recurring_is_automatic.sql): botón "Registrar ahora" del Dashboard
 * para confirmar a mano la ocurrencia de una plantilla recurrente MANUAL —
 * atomicidad transacción+avance de next_occurrence_date, rechazo sobre una
 * plantilla automática, y rechazo sobre una plantilla inexistente/ajena.
 * (Que el cron -generate_recurring_occurrence- nunca toque una plantilla
 * manual se prueba en verify-recurring-cron.mjs, que sí usa el service role
 * key que esa RPC exige — aquí, con un usuario autenticado normal, esa RPC
 * siempre rechaza sin importar la plantilla.)
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
 *   node scripts/verify-confirm-recurring-occurrence.mjs
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

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDaysUTC(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

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

async function getTransaction(id) {
  const { data, error } = await supabase.from("transactions").select("*").eq("id", id).single();
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
    .insert({ user_id: userId, name: "verify-confirm-recurring", type: "debit", initial_balance: 1000, current_balance: 1000 })
    .select()
    .single();
  if (accountError) throw accountError;
  cleanup.accountIds.push(account.id);

  const nextOccurrence = today;
  const nextOccurrenceAfterConfirm = addDaysUTC(today, 7);

  console.log("\n1) Confirmar la ocurrencia de una plantilla MANUAL: crea la transacción y avanza next_occurrence_date, atómico");
  const { data: manualTemplate, error: manualTemplateError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: account.id,
      type: "expense",
      amount: 400,
      date: addDaysUTC(today, -7),
      is_recurring: true,
      recurring_frequency: "weekly",
      next_occurrence_date: nextOccurrence,
      recurring_is_automatic: false,
      note: "Renta en efectivo",
      tags: [],
    })
    .select()
    .single();
  if (manualTemplateError) throw manualTemplateError;

  const { data: confirmed, error: confirmError } = await supabase.rpc("confirm_recurring_occurrence", {
    p_template_id: manualTemplate.id,
    p_next_occurrence_date: nextOccurrenceAfterConfirm,
    p_account_id: account.id,
    p_debt_id: null,
    p_type: "expense",
    p_amount: 400,
    p_date: today,
  });
  check("confirm_recurring_occurrence no da error", !confirmError);
  check("crea una transacción real (is_recurring=false)", confirmed?.is_recurring === false);
  check("saldo de la cuenta baja a 600", (await getAccount(account.id)).current_balance === 600);

  const templateAfterConfirm = await getTransaction(manualTemplate.id);
  check(
    "next_occurrence_date de la plantilla avanzó al valor pasado por el llamador",
    templateAfterConfirm.next_occurrence_date === nextOccurrenceAfterConfirm
  );
  check("la plantilla sigue siendo is_recurring=true (no se reemplaza a sí misma)", templateAfterConfirm.is_recurring === true);

  // El caso "el cron nunca toca una plantilla manual" (generate_recurring_occurrence
  // con recurring_is_automatic=false) ya está cubierto en verify-recurring-cron.mjs,
  // que llama esa RPC con el service role key correcto — aquí solo hay un
  // cliente autenticado normal, con el que esa RPC siempre rechaza con
  // "No autorizado" sin importar la plantilla (correcto: es security definer,
  // solo invocable por service_role), así que no tiene sentido repetirlo aquí.

  console.log("\n2) Confirmar sobre una plantilla AUTOMÁTICA se rechaza (ese botón no debería existir para ella, pero la RPC también lo bloquea)");
  const { data: autoTemplate, error: autoTemplateError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: account.id,
      type: "expense",
      amount: 219,
      date: addDaysUTC(today, -30),
      is_recurring: true,
      recurring_frequency: "monthly",
      next_occurrence_date: today,
      recurring_is_automatic: true,
      note: "Netflix",
      tags: [],
    })
    .select()
    .single();
  if (autoTemplateError) throw autoTemplateError;

  const { error: rejectError } = await supabase.rpc("confirm_recurring_occurrence", {
    p_template_id: autoTemplate.id,
    p_next_occurrence_date: addDaysUTC(today, 30),
    p_account_id: account.id,
    p_debt_id: null,
    p_type: "expense",
    p_amount: 219,
    p_date: today,
  });
  check("rechaza confirmar una plantilla automática", !!rejectError);
  const autoAfter = await getTransaction(autoTemplate.id);
  check("next_occurrence_date de la plantilla automática no se movió", autoAfter.next_occurrence_date === today);

  console.log("\n3) Confirmar una plantilla inexistente (o de otro usuario) se rechaza");
  const { error: notFoundError } = await supabase.rpc("confirm_recurring_occurrence", {
    p_template_id: "00000000-0000-0000-0000-000000000000",
    p_next_occurrence_date: today,
    p_account_id: account.id,
    p_debt_id: null,
    p_type: "expense",
    p_amount: 10,
    p_date: today,
  });
  check("rechaza un template_id que no existe", !!notFoundError);

  console.log("\nLimpiando datos de prueba...");
  // Las plantillas se borran en cascada al borrar la cuenta.
  await supabase.from("accounts").delete().in("id", cleanup.accountIds);

  console.log(`\n${pass} pruebas OK, ${fail} fallidas.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
