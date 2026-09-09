#!/usr/bin/env node
/**
 * Verifica manualmente contra un proyecto Supabase real las reglas de negocio
 * críticas de Fase 1: saldo negativo, límite de crédito y atomicidad de
 * transferencias, usando las funciones RPC de supabase/migrations/005_transaction_rpc.sql.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   TEST_USER_EMAIL=tu-usuario-de-prueba@ejemplo.com TEST_USER_PASSWORD=... \
 *   node scripts/verify-transaction-rpc.mjs
 *
 * El usuario de prueba debe existir ya y tener el correo confirmado
 * (créalo una vez desde /register o el dashboard de Supabase).
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
const createdAccountIds = [];
const createdDebtIds = [];

function check(label, condition) {
  if (condition) {
    console.log(`  OK  ${label}`);
    pass++;
  } else {
    console.log(`FALLO ${label}`);
    fail++;
  }
}

async function createAccount(overrides) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: "verify-script",
      type: "debit",
      initial_balance: 0,
      current_balance: 0,
      ...overrides,
    })
    .select()
    .single();
  if (error) throw error;
  createdAccountIds.push(data.id);
  return data;
}

async function getAccount(id) {
  const { data, error } = await supabase.from("accounts").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function createDebt(overrides) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("debts")
    .insert({
      user_id: user.id,
      name: "verify-script",
      type: "credit_card",
      principal: 0,
      current_balance: 0,
      ...overrides,
    })
    .select()
    .single();
  if (error) throw error;
  createdDebtIds.push(data.id);
  return data;
}

async function getDebt(id) {
  const { data, error } = await supabase.from("debts").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function main() {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  if (signInError) {
    console.error("No se pudo iniciar sesión con el usuario de prueba:", signInError.message);
    process.exit(1);
  }

  console.log("\n1) Cuenta débito no permite saldo negativo");
  const debit = await createAccount({ name: "Débito prueba", type: "debit", initial_balance: 100, current_balance: 100 });
  const { error: overdraftError } = await supabase.rpc("create_transaction", {
    p_account_id: debit.id,
    p_type: "expense",
    p_amount: 150,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza gasto que deja saldo negativo", !!overdraftError);
  check("saldo de la cuenta no cambió", (await getAccount(debit.id)).current_balance === 100);

  console.log("\n2) Tarjeta de crédito (debts) permite hasta el credit_limit, pagada directamente con debt_id");
  const card = await createDebt({ name: "Tarjeta prueba", credit_limit: 500 });
  const { error: withinLimitError } = await supabase.rpc("create_transaction", {
    p_debt_id: card.id,
    p_account_id: null,
    p_type: "expense",
    p_amount: 500,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("acepta gasto igual al límite de crédito", !withinLimitError);
  const cardAfterCharge = await getDebt(card.id);
  check(
    "current_balance de la tarjeta sube a 500 (sin tocar ninguna cuenta)",
    cardAfterCharge.current_balance === "500.00" || cardAfterCharge.current_balance === 500
  );

  const { error: overLimitError } = await supabase.rpc("create_transaction", {
    p_debt_id: card.id,
    p_account_id: null,
    p_type: "expense",
    p_amount: 1,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza gasto que excede el límite de crédito", !!overLimitError);

  const { error: bothError } = await supabase.rpc("create_transaction", {
    p_debt_id: card.id,
    p_account_id: (await createAccount({ name: "Ambos prueba", type: "debit", initial_balance: 100, current_balance: 100 })).id,
    p_type: "expense",
    p_amount: 1,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza un gasto que da cuenta Y tarjeta a la vez", !!bothError);

  console.log("\n3) Transferencia atómica con fondos insuficientes se rechaza sin afectar destino");
  const origin = await createAccount({ name: "Origen prueba", type: "debit", initial_balance: 50, current_balance: 50 });
  const destination = await createAccount({ name: "Destino prueba", type: "debit", initial_balance: 20, current_balance: 20 });
  const { error: transferError } = await supabase.rpc("create_transaction", {
    p_account_id: origin.id,
    p_to_account_id: destination.id,
    p_type: "transfer",
    p_amount: 100,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("rechaza transferencia sin fondos suficientes", !!transferError);
  check("cuenta destino no cambió", (await getAccount(destination.id)).current_balance === 20);

  console.log("\n4) Transferencia válida mueve el saldo atómicamente");
  const { data: tx, error: validTransferError } = await supabase.rpc("create_transaction", {
    p_account_id: origin.id,
    p_to_account_id: destination.id,
    p_type: "transfer",
    p_amount: 30,
    p_date: new Date().toISOString().slice(0, 10),
  });
  check("transferencia válida se acepta", !validTransferError);
  check("cuenta origen baja 30", (await getAccount(origin.id)).current_balance === 20);
  check("cuenta destino sube 30", (await getAccount(destination.id)).current_balance === 50);

  console.log("\n5) Eliminar una transacción revierte el efecto de saldo");
  if (tx) {
    const { error: deleteError } = await supabase.rpc("delete_transaction", { p_id: tx.id });
    check("delete_transaction no da error", !deleteError);
    check("cuenta origen vuelve a 50", (await getAccount(origin.id)).current_balance === 50);
    check("cuenta destino vuelve a 20", (await getAccount(destination.id)).current_balance === 20);
  }

  console.log("\nLimpiando cuentas y deudas de prueba...");
  await supabase.from("accounts").delete().in("id", createdAccountIds);
  await supabase.from("debts").delete().in("id", createdDebtIds);

  console.log(`\n${pass} pruebas OK, ${fail} fallidas.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
