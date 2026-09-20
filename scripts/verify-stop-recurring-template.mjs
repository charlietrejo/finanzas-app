#!/usr/bin/env node
/**
 * Verifica manualmente contra un proyecto Supabase real las dos garantías
 * de la sección 3.4.1 del doc ("Eliminar una recurrencia" / "Los dos
 * botones de eliminar nunca coexisten"):
 *
 *   (1) Eliminar una plantilla recurrente (is_recurring=true) — vía el
 *       mismo UPDATE que usa stopRecurringTemplate en
 *       src/app/(app)/transactions/actions.ts, que a propósito NO llama
 *       delete_transaction/reverse_transaction_effect — detiene las
 *       futuras repeticiones SIN revertir el saldo de ninguna ocurrencia
 *       ya generada (ni la de la propia plantilla, ni las generadas por el
 *       cron -generate_recurring_occurrence- ni las confirmadas a mano
 *       -confirm_recurring_occurrence-).
 *   (2) Eliminar una ocurrencia individual normal (is_recurring=false) vía
 *       delete_transaction SÍ revierte el saldo de ESA transacción
 *       específica, sin tocar ninguna otra fila ni el estado (is_recurring/
 *       next_occurrence_date/recurring_frequency) de la plantilla que la
 *       originó, si sigue activa.
 *
 * Es autosuficiente (crea y borra su propio usuario de prueba, igual que
 * verify-recurring-cron.mjs) porque necesita DOS roles: un cliente
 * autenticado normal (create_transaction, confirm_recurring_occurrence,
 * delete_transaction, y el UPDATE de "eliminar recurrencia") y el service
 * role key (generate_recurring_occurrence, security definer, solo
 * invocable por ese rol — simula al cron).
 *
 * Uso:
 *   npm run verify:stop-recurring
 *   (requiere SUPABASE_SERVICE_ROLE_KEY en .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en .env.local."
  );
  process.exit(1);
}

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TEST_EMAIL = "carlostrejo771+verifystoprecurring@gmail.com";
const TEST_PASSWORD = "TestPass123!";

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

function runSql(sql) {
  const tmpFile = path.join(tmpdir(), `verify-stop-recurring-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(tmpFile, sql, "utf-8");
  try {
    return execFileSync("supabase", ["db", "query", "--linked", "--file", tmpFile], { encoding: "utf-8", shell: true });
  } finally {
    unlinkSync(tmpFile);
  }
}

function deleteTestUser() {
  runSql(`delete from auth.users where email = '${TEST_EMAIL}' returning email;`);
}

function createTestUser() {
  const sql = `
with new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated', '${TEST_EMAIL}',
    crypt('${TEST_PASSWORD}', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  )
  returning id
)
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), new_user.id,
  jsonb_build_object('sub', new_user.id::text, 'email', '${TEST_EMAIL}'),
  'email', new_user.id::text, now(), now(), now()
from new_user
returning user_id;
`.trim();
  runSql(sql);
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDaysUTC(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

const today = isoDate(new Date());

async function getAccount(id) {
  const { data, error } = await admin.from("accounts").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}
async function getTransaction(id) {
  const { data, error } = await admin.from("transactions").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}
async function countTransactions(accountId) {
  const { data, error } = await admin.from("transactions").select("id").eq("account_id", accountId);
  if (error) throw error;
  return data.length;
}

/** Mismo UPDATE que stopRecurringTemplate (actions.ts) — deliberadamente
 * sin RPC, sin reverse_transaction_effect: solo apaga los campos de
 * recurrencia. */
async function stopRecurringTemplate(client, id) {
  const { error } = await client
    .from("transactions")
    .update({
      is_recurring: false,
      recurring_frequency: null,
      recurring_interval_days: null,
      recurring_end_date: null,
      recurring_is_automatic: true,
      next_occurrence_date: null,
    })
    .eq("id", id);
  return error;
}

async function main() {
  console.log("Preparando usuario de prueba temporal...");
  try {
    deleteTestUser();
  } catch {
    // no había usuario previo
  }
  createTestUser();
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInError) throw signInError;
  const userId = signIn.user.id;
  console.log(`Usuario listo: ${TEST_EMAIL}\n`);

  let accountId;
  try {
    const { data: account, error: accountError } = await anon
      .from("accounts")
      .insert({ user_id: userId, name: "verify-stop-recurring", type: "debit", initial_balance: 1000, current_balance: 1000 })
      .select()
      .single();
    if (accountError) throw accountError;
    accountId = account.id;

    console.log("\n=== Escenario 1: plantilla AUTOMÁTICA con 2 ocurrencias del cron, se elimina la plantilla ===");
    const { data: templateA, error: templateAError } = await anon.rpc("create_transaction", {
      p_account_id: accountId,
      p_type: "expense",
      p_amount: 100,
      p_date: addDaysUTC(today, -21),
      p_is_recurring: true,
      p_recurring_frequency: "weekly",
      p_next_occurrence_date: addDaysUTC(today, -14),
      p_recurring_is_automatic: true,
    });
    if (templateAError) throw templateAError;
    check("crea la plantilla A (automática) sin error", true);
    check("la creación de la plantilla ya afecta el saldo (700 -> 900 esperado tras -100)", (await getAccount(accountId)).current_balance === 900);

    const { data: occA1 } = await admin.rpc("generate_recurring_occurrence", {
      p_template_id: templateA.id,
      p_next_occurrence_date: addDaysUTC(today, -7),
    });
    check("el cron genera la 1a ocurrencia de A", !!occA1);
    const { data: occA2 } = await admin.rpc("generate_recurring_occurrence", {
      p_template_id: templateA.id,
      p_next_occurrence_date: today,
    });
    check("el cron genera la 2a ocurrencia de A", !!occA2);
    check("saldo tras plantilla A + 2 ocurrencias del cron: 1000-100-100-100=700", (await getAccount(accountId)).current_balance === 700);
    check("hay 3 filas para esta cuenta (plantilla + 2 ocurrencias)", (await countTransactions(accountId)) === 3);

    const stopAError = await stopRecurringTemplate(anon, templateA.id);
    check("eliminar la plantilla A no da error", !stopAError);

    const balanceAfterStopA = (await getAccount(accountId)).current_balance;
    check("el saldo NO cambia al eliminar la plantilla A (sigue en 700)", balanceAfterStopA === 700);
    check("las 3 filas siguen existiendo (plantilla + 2 ocurrencias, nada se borró)", (await countTransactions(accountId)) === 3);

    const templateAAfter = await getTransaction(templateA.id);
    check("la fila de la plantilla A sigue existiendo", !!templateAAfter);
    check("la plantilla A queda is_recurring=false (detuvo futuras repeticiones)", templateAAfter?.is_recurring === false);

    const occA1After = await getTransaction(occA1.id);
    const occA2After = await getTransaction(occA2.id);
    check("occA1 (generada por el cron) sigue existiendo intacta", !!occA1After && occA1After.amount === 100 && occA1After.is_recurring === false);
    check("occA2 (generada por el cron) sigue existiendo intacta", !!occA2After && occA2After.amount === 100 && occA2After.is_recurring === false);

    console.log("\n=== Escenario 2: plantilla MANUAL con 1 ocurrencia confirmada a mano, se elimina la plantilla ===");
    const { data: templateB, error: templateBError } = await anon.rpc("create_transaction", {
      p_account_id: accountId,
      p_type: "expense",
      p_amount: 50,
      p_date: addDaysUTC(today, -14),
      p_is_recurring: true,
      p_recurring_frequency: "weekly",
      p_next_occurrence_date: addDaysUTC(today, -7),
      p_recurring_is_automatic: false,
    });
    if (templateBError) throw templateBError;
    check("crea la plantilla B (manual) sin error", true);
    check("saldo tras crear B: 700-50=650", (await getAccount(accountId)).current_balance === 650);

    const { data: occB1, error: occB1Error } = await anon.rpc("confirm_recurring_occurrence", {
      p_template_id: templateB.id,
      p_next_occurrence_date: today,
      p_account_id: accountId,
      p_debt_id: null,
      p_type: "expense",
      p_amount: 50,
      p_date: addDaysUTC(today, -7),
    });
    check("'Marcar como pagada' (confirm_recurring_occurrence) no da error", !occB1Error);
    check("saldo tras confirmar la ocurrencia de B: 650-50=600", (await getAccount(accountId)).current_balance === 600);

    const stopBError = await stopRecurringTemplate(anon, templateB.id);
    check("eliminar la plantilla B no da error", !stopBError);
    check("el saldo NO cambia al eliminar la plantilla B (sigue en 600)", (await getAccount(accountId)).current_balance === 600);

    const occB1After = await getTransaction(occB1.id);
    check("la ocurrencia confirmada a mano de B sigue existiendo intacta", !!occB1After && occB1After.amount === 50 && occB1After.is_recurring === false);
    const templateBAfter = await getTransaction(templateB.id);
    check("la fila de la plantilla B sigue existiendo, is_recurring=false", !!templateBAfter && templateBAfter.is_recurring === false);

    console.log("\n=== Escenario 3 (por separado): eliminar UNA ocurrencia individual de una plantilla que SIGUE ACTIVA ===");
    const { data: templateC, error: templateCError } = await anon.rpc("create_transaction", {
      p_account_id: accountId,
      p_type: "expense",
      p_amount: 30,
      p_date: addDaysUTC(today, -14),
      p_is_recurring: true,
      p_recurring_frequency: "weekly",
      p_next_occurrence_date: addDaysUTC(today, -7),
      p_recurring_is_automatic: true,
    });
    if (templateCError) throw templateCError;
    check("saldo tras crear C: 600-30=570", (await getAccount(accountId)).current_balance === 570);

    const { data: occC1 } = await admin.rpc("generate_recurring_occurrence", {
      p_template_id: templateC.id,
      p_next_occurrence_date: today,
    });
    check("el cron genera la ocurrencia de C", !!occC1);
    check("saldo tras la ocurrencia de C: 570-30=540", (await getAccount(accountId)).current_balance === 540);

    const templateCBefore = await getTransaction(templateC.id);

    const { error: deleteOccCError } = await anon.rpc("delete_transaction", { p_id: occC1.id });
    check("eliminar la ocurrencia individual (delete_transaction) no da error", !deleteOccCError);

    const balanceAfterDeleteOccC = (await getAccount(accountId)).current_balance;
    check("el saldo se revierte EXACTAMENTE por el monto de esa ocurrencia: 540+30=570", balanceAfterDeleteOccC === 570);

    const occC1AfterDelete = await getTransaction(occC1.id);
    check("la ocurrencia eliminada ya no existe", occC1AfterDelete === null);

    const templateCAfter = await getTransaction(templateC.id);
    check("la plantilla C que la originó sigue existiendo", !!templateCAfter);
    check(
      "el estado de la plantilla C NO cambió al eliminar su ocurrencia (is_recurring/next_occurrence_date/frecuencia intactos)",
      templateCAfter?.is_recurring === templateCBefore?.is_recurring &&
        templateCAfter?.next_occurrence_date === templateCBefore?.next_occurrence_date &&
        templateCAfter?.recurring_frequency === templateCBefore?.recurring_frequency
    );

    console.log("\n=== Sanidad final: nada de los escenarios 1 y 2 se vio afectado por el escenario 3 ===");
    const templateAFinal = await getTransaction(templateA.id);
    const occA1Final = await getTransaction(occA1.id);
    const occA2Final = await getTransaction(occA2.id);
    const templateBFinal = await getTransaction(templateB.id);
    const occB1Final = await getTransaction(occB1.id);
    check(
      "plantilla A + sus 2 ocurrencias siguen intactas",
      !!templateAFinal && !!occA1Final && occA1Final.amount === 100 && !!occA2Final && occA2Final.amount === 100
    );
    check("plantilla B + su ocurrencia confirmada siguen intactas", !!templateBFinal && !!occB1Final && occB1Final.amount === 50);
    check(
      "saldo final: 1000 -100(A) -100(occA1) -100(occA2) -50(B) -50(occB1) -30(C) +30(revertido occC1) = 570",
      balanceAfterDeleteOccC === 570
    );
  } finally {
    console.log("\nLimpiando datos de prueba...");
    if (accountId) {
      await admin.from("transactions").delete().eq("account_id", accountId);
      await admin.from("accounts").delete().eq("id", accountId);
    }
    try {
      deleteTestUser();
    } catch (err) {
      console.error("No se pudo borrar el usuario de prueba:", err.message);
    }
  }

  console.log(`\n${pass} pruebas OK, ${fail} fallidas.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
