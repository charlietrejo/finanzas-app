// QA-37 — Lecturas de datos en el servidor para Server Components.
// Reutiliza la MISMA lógica de consulta que finance.ts pero con el cliente
// Supabase server-side (createSupabaseServerClient), leyendo las cookies de
// sesión vía next/headers. Respeta RLS exactamente igual que el cliente
// browser (auth.uid() del JWT en las cookies). No contiene mutaciones ni RPCs
// de escritura: solo lecturas para el render inicial del dashboard.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Account, Budget, Category, Debt, Goal, Transaction } from "@/types";

export async function listAccountsServer(): Promise<Account[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Account[];
}

export async function listTransactionsServer(): Promise<Transaction[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function listDebtsServer(): Promise<Debt[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Debt[];
}

export async function listCategoriesServer(): Promise<Category[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function listBudgetsServer(): Promise<Budget[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Budget[];
}

export async function listGoalsServer(): Promise<Goal[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Goal[];
}
