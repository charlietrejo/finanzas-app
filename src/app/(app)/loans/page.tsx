import { createClient } from "@/lib/supabase/server";
import { LoansClient } from "./loans-client";
import type { Account, LoanStatus } from "@/types/database";

export interface LoanGivenRow {
  id: string;
  borrower_name: string;
  expected_return_date: string | null;
  current_balance: number;
  status: LoanStatus;
  transaction: { date: string; amount: number } | null;
}

export default async function LoansPage() {
  const supabase = await createClient();

  const [{ data: loans }, { data: accounts }] = await Promise.all([
    supabase
      .from("loans_given")
      .select("id, borrower_name, expected_return_date, current_balance, status, transaction:transactions(date, amount)")
      .order("created_at", { ascending: false }),
    supabase.from("accounts").select("*").is("archived_at", null).order("created_at", { ascending: true }),
  ]);

  return (
    <LoansClient
      loans={(loans ?? []) as unknown as LoanGivenRow[]}
      accounts={(accounts ?? []) as Account[]}
    />
  );
}
