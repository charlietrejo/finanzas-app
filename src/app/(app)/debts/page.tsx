import { createClient } from "@/lib/supabase/server";
import { DebtsClient } from "./debts-client";
import type { Account, Debt } from "@/types/database";

export default async function DebtsPage() {
  const supabase = await createClient();

  const [{ data: debts }, { data: accounts }] = await Promise.all([
    supabase.from("debts").select("*").is("archived_at", null).order("created_at", { ascending: true }),
    supabase.from("accounts").select("*").is("archived_at", null).order("created_at", { ascending: true }),
  ]);

  return <DebtsClient debts={(debts ?? []) as Debt[]} accounts={(accounts ?? []) as Account[]} />;
}
