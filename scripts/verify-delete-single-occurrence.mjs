#!/usr/bin/env node
/**
 * Verifica manualmente contra un proyecto Supabase real que borrar UNA
 * ocurrencia normal (is_recurring=false) generada a partir de una
 * plantilla recurrente, usando el borrado GENÉRICO de movimiento
 * (delete_transaction) — no "Eliminar recurrencia" — solo revierte el
 * saldo de esa ocurrencia específica, sin tocar la plantilla ni las demás
 * ocurrencias ya generadas.
 *
 * Escenario: plantilla manual + 3 ocurrencias confirmadas a mano
 * (confirm_recurring_occurrence) → se borra solo la 3a (la última) con
 * delete_transaction → se confirma que la plantilla y las ocurrencias 1 y
 * 2 quedan intactas (filas y efecto en saldo), y que solo el saldo de la
 * 3a se revirtió.
 *
 * Es autosuficiente: crea su propio usuario de prueba desechable directo
 * en auth.users (mismo mecanismo que verify-all.mjs/verify-recurring-cron.mjs,
 * evita el rate-limit de envío de correo de Supabase) y lo borra al
 * terminar junto con todos sus datos, incluso si algo falla a medio camino.
 * No requiere SUPABASE_SERVICE_ROLE_KEY: confirm_recurring_occurrence y
 * delete_transaction son `security invoker`, invocables por un usuario
 * autenticado normal.
 *
 * Uso:
 *   npm run verify:delete-single-occurrence
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TEST_EMAIL = "carlostrejo771+verifydeletesingleocc@gmail.com";
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
  const tmpFile = path.join(tmpdir(), `verify-delete-single-occ-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
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
  const { data, error } = await supabase.from("accounts").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}
async function getTransaction(id) {
  const { data, error } = await supabase.from("transactions").select("*").eq("id", id).single();
  if (error) return null;
  return data;
}
async function countTransactions(accountId) {
  const { data, error } = await supabase.from("transactions").select("id").eq("account_id", accountId);
  if (error) throw error;
  return data.length;
}

async function main() {
  console.log("Preparando usuario de prueba temporal...");
  try {
    deleteTestUser();
  } catch {
    // no había usuario previo
  }
  createTestUser();
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInError) throw signInError;
  const userId = signIn.user.id;
  console.log(`Usuario listo: ${TEST_EMAIL}\n`);

  let accountId;
  try {
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .insert({ user_id: userId, name: "verify-delete-single-occ", type: "debit", initial_balance: 1000, current_balance: 1000 })
      .select()
      .single();
    if (accountError) throw accountError;
    accountId = account.id;

    console.log("\n1) Crear la plantilla recurrente (manual, is_recurring=true)");
    const { data: template, error: templateError } = await supabase.rpc("create_transaction", {
      p_account_id: accountId,
      p_type: "expense",
      p_amount: 40,
      p_date: addDaysUTC(today, -28),
      p_is_recurring: true,
      p_recurring_frequency: "weekly",
      p_next_occurrence_date: addDaysUTC(today, -21),
      p_recurring_is_automatic: false,
    });
    if (templateError) throw templateError;
    check("crea la plantilla sin error", true);
    check("la creación de la plantilla ya afecta el saldo: 1000-40=960", (await getAccount(accountId)).current_balance === 960);

    console.log("\n2) Confirmar 3 ocurrencias a partir de ella ('Marcar como pagada')");
    const { data: occ1, error: occ1Error } = await supabase.rpc("confirm_recurring_occurrence", {
      p_template_id: template.id,
      p_next_occurrence_date: addDaysUTC(today, -14),
      p_account_id: accountId,
      p_debt_id: null,
      p_type: "expense",
      p_amount: 40,
      p_date: addDaysUTC(today, -21),
    });
    check("confirma la 1a ocurrencia sin error", !occ1Error);

    const { data: occ2, error: occ2Error } = await supabase.rpc("confirm_recurring_occurrence", {
      p_template_id: template.id,
      p_next_occurrence_date: addDaysUTC(today, -7),
      p_account_id: accountId,
      p_debt_id: null,
      p_type: "expense",
      p_amount: 40,
      p_date: addDaysUTC(today, -14),
    });
    check("confirma la 2a ocurrencia sin error", !occ2Error);

    const { data: occ3, error: occ3Error } = await supabase.rpc("confirm_recurring_occurrence", {
      p_template_id: template.id,
      p_next_occurrence_date: today,
      p_account_id: accountId,
      p_debt_id: null,
      p_type: "expense",
      p_amount: 40,
      p_date: addDaysUTC(today, -7),
    });
    check("confirma la 3a ocurrencia (la última) sin error", !occ3Error);

    check(
      "saldo tras plantilla + 3 ocurrencias: 1000 - 40*4 = 840",
      (await getAccount(accountId)).current_balance === 840
    );
    check("hay 4 filas para esta cuenta (plantilla + 3 ocurrencias)", (await countTransactions(accountId)) === 4);

    const templateBefore = await getTransaction(template.id);
    const occ1Before = await getTransaction(occ1.id);
    const occ2Before = await getTransaction(occ2.id);

    console.log("\n3) Borrar SOLO la 3a ocurrencia (movimiento normal) con el borrado GENÉRICO — no 'Eliminar recurrencia'");
    const { error: deleteOcc3Error } = await supabase.rpc("delete_transaction", { p_id: occ3.id });
    check("delete_transaction sobre la 3a ocurrencia no da error", !deleteOcc3Error);

    console.log("\n4) Verificaciones");
    const balanceAfter = (await getAccount(accountId)).current_balance;
    check("el saldo se revierte EXACTAMENTE por el monto de la 3a ocurrencia: 840+40=880", balanceAfter === 880);

    const occ3After = await getTransaction(occ3.id);
    check("la 3a ocurrencia (eliminada) ya no existe", occ3After === null);

    check("quedan 3 filas para esta cuenta (plantilla + ocurrencias 1 y 2, la 3a se borró)", (await countTransactions(accountId)) === 3);

    const templateAfter = await getTransaction(template.id);
    check("la plantilla recurrente sigue existiendo", !!templateAfter);
    check(
      "el estado de la plantilla no cambió (is_recurring/next_occurrence_date/frecuencia/amount intactos)",
      templateAfter?.is_recurring === templateBefore?.is_recurring &&
        templateAfter?.next_occurrence_date === templateBefore?.next_occurrence_date &&
        templateAfter?.recurring_frequency === templateBefore?.recurring_frequency &&
        templateAfter?.amount === templateBefore?.amount
    );

    const occ1After = await getTransaction(occ1.id);
    check(
      "la 1a ocurrencia sigue existiendo, sin cambios",
      !!occ1After && occ1After.amount === occ1Before.amount && occ1After.date === occ1Before.date && occ1After.is_recurring === false
    );
    const occ2After = await getTransaction(occ2.id);
    check(
      "la 2a ocurrencia sigue existiendo, sin cambios",
      !!occ2After && occ2After.amount === occ2Before.amount && occ2After.date === occ2Before.date && occ2After.is_recurring === false
    );
  } finally {
    console.log("\nLimpiando datos de prueba...");
    if (accountId) {
      await supabase.from("transactions").delete().eq("account_id", accountId);
      await supabase.from("accounts").delete().eq("id", accountId);
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
