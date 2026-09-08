import { createClient } from "@/lib/supabase/server";
import { GoalsClient } from "./goals-client";
import type { Account, Goal } from "@/types/database";

export default async function GoalsPage() {
  const supabase = await createClient();

  const [{ data: goals }, { data: accounts }] = await Promise.all([
    supabase.from("goals").select("*").order("created_at", { ascending: true }),
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
  ]);

  return (
    <GoalsClient
      goals={(goals ?? []) as Goal[]}
      accounts={(accounts ?? []) as Account[]}
    />
  );
}
