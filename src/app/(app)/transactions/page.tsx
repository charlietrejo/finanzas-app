import { createClient } from "@/lib/supabase/server";
import { getMerchants } from "@/lib/merchants-data";
import { TransactionsClient } from "./transactions-client";
import type { Account, Category, Debt, RecurringFrequency } from "@/types/database";

export interface TransactionRow {
  id: string;
  account_id: string | null;
  debt_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  merchant_id: string | null;
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  note: string | null;
  tags: string[];
  is_recurring: boolean;
  recurring_frequency: RecurringFrequency | null;
  recurring_interval_days: number | null;
  recurring_end_date: string | null;
  recurring_is_automatic: boolean;
  next_occurrence_date: string | null;
  account: { name: string } | null;
  debt: { name: string } | null;
  to_account: { name: string } | null;
  category: { name: string } | null;
  merchant: { name: string } | null;
}

export default async function TransactionsPage() {
  const supabase = await createClient();

  const [{ data: transactions }, { data: accounts }, { data: creditCards }, { data: categories }, merchants] =
    await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id, account_id, debt_id, to_account_id, category_id, merchant_id, type, amount, date, note, tags, is_recurring, recurring_frequency, recurring_interval_days, recurring_end_date, recurring_is_automatic, next_occurrence_date, account:accounts!transactions_account_id_fkey(name), debt:debts(name), to_account:accounts!transactions_to_account_id_fkey(name), category:categories(name), merchant:merchants(name)"
        )
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("accounts").select("*").is("archived_at", null).order("created_at", { ascending: true }),
      supabase
        .from("debts")
        .select("*")
        .eq("type", "credit_card")
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase.from("categories").select("*").order("name", { ascending: true }),
      getMerchants(),
    ]);

  return (
    <TransactionsClient
      transactions={(transactions ?? []) as unknown as TransactionRow[]}
      accounts={(accounts ?? []) as Account[]}
      creditCards={(creditCards ?? []) as Debt[]}
      categories={(categories ?? []) as Category[]}
      merchants={merchants}
    />
  );
}
