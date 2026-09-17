#!/usr/bin/env node
/**
 * Verifica el motor de recurrencias de la Fase 8
 * (generate_recurring_occurrence, supabase/migrations/019_recurring_engine.sql)
 * directo contra Supabase real, con el service role key — esa función es
 * `security definer` y solo la puede invocar ese rol (nunca un usuario
 * autenticado ni anónimo). A diferencia de los demás scripts verify-*.mjs,
 * este es autosuficiente: crea su propio usuario de prueba temporal directo
 * en auth.users (mismo mecanismo que scripts/verify-all.mjs) y lo borra al
 * terminar, así que no depende de TEST_USER_EMAIL/PASSWORD.
 *
 * Uso:
 *   npm run verify:recurring
 *   (requiere SUPABASE_SERVICE_ROLE_KEY en .env.local — Supabase Dashboard
 *   → Settings → API → service_role)
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Agrega SUPABASE_SERVICE_ROLE_KEY a .env.local (Supabase Dashboard → Settings → API → service_role) y corre con `npm run verify:recurring`."
  );
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TEST_EMAIL = "carlostrejo771+verifyrecurring@gmail.com";

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
  const tmpFile = path.join(tmpdir(), `verify-recurring-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(tmpFile, sql, "utf-8");
  try {
    return execFileSync("supabase", ["db", "query", "--linked", "--file", tmpFile], {
      encoding: "utf-8",
      shell: true,
    });
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
    crypt('TestPass123!', gen_salt('bf')),
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
  const out = runSql(sql);
  const parsed = JSON.parse(out);
  return parsed.rows[0].user_id;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDaysUTC(d, days) {
  const nd = new Date(d);
  nd.setUTCDate(nd.getUTCDate() + days);
  return nd;
}
function addMonthsUTC(d, months) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}

const today = new Date();
const todayStr = isoDate(today);

const createdAccountIds = [];
const createdTxIds = [];

async function createAccount(userId) {
  const { data, error } = await supabase
    .from("accounts")
    .insert({ user_id: userId, name: "verify-recurring", type: "debit", initial_balance: 100_000, current_balance: 100_000 })
    .select()
    .single();
  if (error) throw error;
  createdAccountIds.push(data.id);
  return data;
}

async function createTemplate(userId, accountId, overrides) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: accountId,
      type: "expense",
      amount: 100,
      is_recurring: true,
      tags: [],
      ...overrides,
    })
    .select()
    .single();
  if (error) throw error;
  createdTxIds.push(data.id);
  return data;
}

async function countMatchingOccurrences(userId, accountId, amount, date) {
  const { data, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact" })
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("amount", amount)
    .eq("date", date)
    .eq("is_recurring", false);
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
  const userId = createTestUser();
  console.log(`Usuario listo: ${TEST_EMAIL}\n`);

  try {
    const account = await createAccount(userId);

    console.log("\n1) Netflix mensual: genera exactamente una transacción por mes, sin duplicarse");
    const twoMonthsAgo = isoDate(addMonthsUTC(today, -2));
    const oneMonthAgo = isoDate(addMonthsUTC(today, -1));
    const nextAfterFirst = isoDate(addMonthsUTC(new Date(`${oneMonthAgo}T00:00:00Z`), 1));

    const netflix = await createTemplate(userId, account.id, {
      date: twoMonthsAgo,
      recurring_frequency: "monthly",
      next_occurrence_date: oneMonthAgo,
      note: "Netflix",
      amount: 219,
    });

    const { data: firstRun, error: firstError } = await supabase.rpc("generate_recurring_occurrence", {
      p_template_id: netflix.id,
      p_next_occurrence_date: nextAfterFirst,
    });
    check("primera corrida no da error", !firstError);
    check("primera corrida genera la ocurrencia", !!firstRun);
    check("la ocurrencia generada tiene is_recurring=false", firstRun?.is_recurring === false);
    check("la ocurrencia generada tiene la fecha vencida (mes pasado)", firstRun?.date === oneMonthAgo);

    const { data: afterFirst } = await supabase.from("transactions").select("next_occurrence_date").eq("id", netflix.id).single();
    check("next_occurrence_date de la plantilla avanzó un mes", afterFirst.next_occurrence_date === nextAfterFirst);

    // Simula un reintento del cron para el MISMO periodo ya generado (ej.
    // el cron corrió dos veces, o algo dejó next_occurrence_date de vuelta
    // en el valor vencido) — no debe crear una segunda transacción.
    await supabase.from("transactions").update({ next_occurrence_date: oneMonthAgo }).eq("id", netflix.id);
    const { data: secondRun, error: secondError } = await supabase.rpc("generate_recurring_occurrence", {
      p_template_id: netflix.id,
      p_next_occurrence_date: nextAfterFirst,
    });
    check("segunda corrida (mismo periodo) no da error", !secondError);
    check("segunda corrida NO genera una segunda transacción (idempotencia)", secondRun === null);

    const occurrenceCount = await countMatchingOccurrences(userId, account.id, 219, oneMonthAgo);
    check("solo existe UNA transacción generada para ese mes (sin duplicados)", occurrenceCount === 1);

    console.log("\n2) Strava anual: no genera nada en los meses intermedios");
    const eightMonthsFromNow = isoDate(addMonthsUTC(today, 8));
    const strava = await createTemplate(userId, account.id, {
      date: todayStr,
      recurring_frequency: "annual",
      next_occurrence_date: eightMonthsFromNow,
      note: "Strava",
      amount: 700,
    });

    const { data: stravaRun, error: stravaError } = await supabase.rpc("generate_recurring_occurrence", {
      p_template_id: strava.id,
      p_next_occurrence_date: isoDate(addMonthsUTC(today, 20)),
    });
    check("no da error al procesar una recurrencia no vencida", !stravaError);
    check("no genera nada porque next_occurrence_date todavía no llega", stravaRun === null);

    const { data: stravaAfter } = await supabase.from("transactions").select("next_occurrence_date").eq("id", strava.id).single();
    check("next_occurrence_date de Strava no se movió", stravaAfter.next_occurrence_date === eightMonthsFromNow);

    console.log("\n3) Recurrencia con recurring_end_date ya vencida deja de generar");
    const twoDaysAgo = isoDate(addDaysUTC(today, -2));
    const expired = await createTemplate(userId, account.id, {
      date: twoMonthsAgo,
      recurring_frequency: "monthly",
      next_occurrence_date: oneMonthAgo,
      recurring_end_date: twoDaysAgo,
      note: "Suscripción cancelada",
      amount: 150,
    });

    const { data: expiredRun, error: expiredError } = await supabase.rpc("generate_recurring_occurrence", {
      p_template_id: expired.id,
      p_next_occurrence_date: nextAfterFirst,
    });
    check("no da error al procesar una recurrencia vencida", !expiredError);
    check("no genera nada porque recurring_end_date ya pasó", expiredRun === null);

    const { data: expiredAfter } = await supabase.from("transactions").select("next_occurrence_date").eq("id", expired.id).single();
    check("next_occurrence_date de la recurrencia vencida no se movió", expiredAfter.next_occurrence_date === oneMonthAgo);

    console.log("\n4) Secciones 3.2/3.4.1: una plantilla MANUAL (recurring_is_automatic=false) nunca se genera sola");
    const manualTemplate = await createTemplate(userId, account.id, {
      date: twoMonthsAgo,
      recurring_frequency: "weekly",
      next_occurrence_date: oneMonthAgo,
      recurring_is_automatic: false,
      note: "Renta en efectivo",
      amount: 400,
    });

    const { data: manualRun, error: manualError } = await supabase.rpc("generate_recurring_occurrence", {
      p_template_id: manualTemplate.id,
      p_next_occurrence_date: isoDate(addDaysUTC(new Date(`${oneMonthAgo}T00:00:00Z`), 7)),
    });
    check("no da error al procesar una plantilla manual", !manualError);
    check("no genera nada porque la plantilla es manual (el cron la ignora)", manualRun === null);

    const { data: manualAfter } = await supabase
      .from("transactions")
      .select("next_occurrence_date")
      .eq("id", manualTemplate.id)
      .single();
    check(
      "next_occurrence_date de la plantilla manual NO avanzó (solo avanza vía confirm_recurring_occurrence, botón 'Registrar ahora')",
      manualAfter.next_occurrence_date === oneMonthAgo
    );

    const manualOccurrenceCount = await countMatchingOccurrences(userId, account.id, 400, oneMonthAgo);
    check("no se creó ninguna transacción real para la plantilla manual", manualOccurrenceCount === 0);
  } finally {
    console.log("\nLimpiando datos de prueba...");
    if (createdTxIds.length > 0) await supabase.from("transactions").delete().in("id", createdTxIds);
    // Borra también las ocurrencias reales generadas por el propio motor
    // (no tienen id capturado arriba, se limpian por dueño de cuenta).
    if (createdAccountIds.length > 0) {
      await supabase.from("transactions").delete().in("account_id", createdAccountIds);
      await supabase.from("accounts").delete().in("id", createdAccountIds);
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
