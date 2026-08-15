// scripts/verify-isolation.mjs
// PRUEBA DE AISLAMIENTO (PRIORIDAD 3) contra el proyecto Supabase REMOTO linkeado.
// Crea dos usuarios de prueba (A y B), A crea datos, B intenta acceder/cruzar.
// No usa service_role. Solo anon key + sesiones de usuario reales.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// --- cargar .env.local (ruta absoluta desde cwd del proyecto) ---
const envPath = join(process.cwd(), ".env.local");
const envText = readFileSync(envPath, "utf8").replace(/^﻿/, "");
const env = {};
for (const raw of envText.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx === -1) continue;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local");
  process.exit(1);
}

const EMAIL_A = "aislamiento.a.verificacion@gmail.com";
const EMAIL_B = "aislamiento.b.verificacion@gmail.com";
const PASS = process.env.PENTEST_PASSWORD;
const client = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });

const results = [];
function check(name, blocked, detail) {
  results.push({ name, blocked: !!blocked, detail });
  console.log(`${blocked ? "BLOQUEADO" : "FALLO (permitido)"} | ${name} | ${detail ?? ""}`);
}

async function getSession(email) {
  // Los usuarios de prueba ya deben existir y estar confirmados en el panel.
  const r = await client.auth.signInWithPassword({ email, password: PASS });
  if (r.error) throw new Error(`login ${email}: ${r.error.message} (¿usuario creado y confirmado en Supabase Auth?)`);
  return r.data;
}

const today = new Date().toISOString().slice(0, 10);

async function run() {
  const sA = await getSession(EMAIL_A);
  const sB = await getSession(EMAIL_B);
  const A = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  const B = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  await A.auth.setSession(sA.session);
  await B.auth.setSession(sB.session);
  const uidA = sA.user.id;
  const uidB = sB.user.id;
  console.log(`Usuario A=${uidA}\nUsuario B=${uidB}\n`);

  // --- A crea datos propios ---
  const { data: accA, error: eAccA } = await A.from("accounts").insert({
    user_id: uidA, name: "Cta A", type: "BANK", initial_balance: 1000, current_balance: 1000,
  }).select().single();
  if (eAccA) throw new Error("A no pudo crear cuenta: " + eAccA.message);
  const { data: debtA, error: eDebtA } = await A.from("debts").insert({
    user_id: uidA, name: "Deuda A", type: "LOAN", initial_amount: 500, current_balance: 500,
  }).select().single();
  if (eDebtA) throw new Error("A no pudo crear deuda: " + eDebtA.message);
  const { data: catA, error: eCatA } = await A.from("categories").insert({
    user_id: uidA, name: "Cat A", type: "EXPENSE",
  }).select().single();
  if (eCatA) throw new Error("A no pudo crear categoría: " + eCatA.message);
  const { data: txA, error: eTxA } = await A.from("transactions").insert({
    user_id: uidA, account_id: accA.id, category_id: catA.id, type: "EXPENSE",
    amount: 100, description: "tx A", transaction_date: today,
  }).select().single();
  if (eTxA) throw new Error("A no pudo crear transacción: " + eTxA.message);

  // B necesita una cuenta propia para intentar transacciones cruzadas
  const { data: accB, error: eAccB } = await B.from("accounts").insert({
    user_id: uidB, name: "Cta B", type: "BANK", initial_balance: 1000, current_balance: 1000,
  }).select().single();
  if (eAccB) throw new Error("B no pudo crear cuenta: " + eAccB.message);

  console.log("=== USUARIO B intenta acceder a datos de A ===");

  // 1) B lee cuenta de A
  const { data: r1, error: e1 } = await B.from("accounts").select().eq("id", accA.id).single();
  check("B lee cuenta de A (SELECT)", !!e1 || !r1, e1 ? e1.message : "devolvió fila (MAL)");

  // 2) B modifica cuenta de A
  const { error: e2 } = await B.from("accounts").update({ name: "hackeada" }).eq("id", accA.id);
  // Un UPDATE que afecta 0 filas NO devuelve error; verificamos el valor real con A.
  const { data: afterUpd, error: e2b } = await A.from("accounts").select("name").eq("id", accA.id).single();
  const modificado = afterUpd && afterUpd.name === "hackeada";
  check("B modifica cuenta de A (UPDATE)", !!e2 || !modificado, modificado ? "nombre cambió a 'hackeada' (MAL)" : (e2 ? e2.message : "0 filas afectadas / nombre intacto (OK)"));

  // 3) B elimina cuenta de A
  const { error: e3 } = await B.from("accounts").delete().eq("id", accA.id);
  check("B elimina cuenta de A (DELETE)", !!e3 || (await B.from("accounts").select("id").eq("id", accA.id).maybeSingle()).data === null, e3 ? e3.message : "borró/0 filas");

  // 4) B inserta transacción atribuyéndose a A (user_id=A) con su cuenta
  const { error: e4 } = await B.from("transactions").insert({
    user_id: uidA, account_id: accB.id, category_id: catA.id, type: "EXPENSE",
    amount: 1, description: "cross", transaction_date: today,
  });
  check("B inserta tx con user_id=A (INSERT user_id)", !!e4, e4 ? e4.message : "sin error (MAL)");

  // 5) B inserta transacción con account_id de A (su propio user_id)
  const { error: e5 } = await B.from("transactions").insert({
    user_id: uidB, account_id: accA.id, category_id: catA.id, type: "EXPENSE",
    amount: 1, description: "cross-acct", transaction_date: today,
  });
  check("B inserta tx con account_id de A (FK)", !!e5, e5 ? e5.message : "sin error (MAL)");

  // 6) B inserta transacción con category_id de A
  const { error: e6 } = await B.from("transactions").insert({
    user_id: uidB, account_id: accB.id, category_id: catA.id, type: "EXPENSE",
    amount: 1, description: "cross-cat", transaction_date: today,
  });
  check("B inserta tx con category_id de A (FK)", !!e6, e6 ? e6.message : "sin error (MAL)");

  // 7) B inserta transacción con debt_id de A
  const { error: e7 } = await B.from("transactions").insert({
    user_id: uidB, account_id: accB.id, category_id: catA.id, type: "DEBT_PAYMENT", debt_id: debtA.id,
    amount: 1, description: "cross-debt", transaction_date: today,
  });
  check("B inserta tx con debt_id de A (FK)", !!e7, e7 ? e7.message : "sin error (MAL)");

  // 8) B lista categorías: no debe ver catA
  const { data: catsB, error: e8 } = await B.from("categories").select("id");
  const veCatA = (catsB ?? []).some((c) => c.id === catA.id);
  check("B NO ve category_id de A en listado", !veCatA, veCatA ? "ve catA (MAL)" : "no ve catA (OK)");

  // 9) A sí puede operar lo suyo (control positivo)
  const { data: r9, error: e9 } = await A.from("accounts").select().eq("id", accA.id).single();
  check("A lee su propia cuenta (control +)", !e9 && !!r9, e9 ? e9.message : "OK");

  const fallos = results.filter((r) => !r.blocked && !/control \+/.test(r.name));
  console.log(`\n=== RESUMEN ===\nBloqueados: ${results.filter((r) => r.blocked).length}/${results.length}`);
  if (fallos.length) {
    console.log("VULNERABILIDADES ABIERTAS:");
    fallos.forEach((f) => console.log(" - " + f.name));
    process.exitCode = 2;
  } else {
    console.log("AISLAMIENTO CORRECTO: Usuario B no accedió a ningún dato de A.");
  }
}

run().catch((e) => {
  console.error("ERROR EN PRUEBA:", e.message);
  process.exitCode = 3;
});
