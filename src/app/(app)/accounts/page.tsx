import { createClient } from "@/lib/supabase/server";
import { AccountsClient } from "./accounts-client";
import type { Account } from "@/types/database";

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  return <AccountsClient accounts={(data ?? []) as Account[]} />;
}
