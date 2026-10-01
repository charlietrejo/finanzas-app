import { createClient } from "@/lib/supabase/server";
import { getLastCutoffDate } from "@/lib/date-utils";
import { DebtsClient } from "./debts-client";
import type { Account, Debt } from "@/types/database";

export default async function DebtsPage() {
  const supabase = await createClient();

  const [{ data: debts }, { data: accounts }] = await Promise.all([
    supabase.from("debts").select("*").is("archived_at", null).order("created_at", { ascending: true }),
    supabase.from("accounts").select("*").is("archived_at", null).order("created_at", { ascending: true }),
  ]);

  // Sección 3.4: dato informativo junto al pago mínimo — suma de gastos
  // pagados con cada tarjeta (debt_id) desde su último día de corte hasta
  // hoy. Solo tiene sentido si la tarjeta tiene cutoff_day capturado.
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const creditCards = (debts ?? []).filter((d) => d.type === "credit_card" && d.cutoff_day) as Debt[];

  const spentEntries = await Promise.all(
    creditCards.map(async (card) => {
      const periodStart = getLastCutoffDate(card.cutoff_day as number, today);
      const { data: spentTx } = await supabase
        .from("transactions")
        .select("amount")
        .eq("debt_id", card.id)
        .eq("type", "expense")
        .gte("date", periodStart)
        .lte("date", todayStr);
      const total = (spentTx ?? []).reduce((sum, tx) => sum + tx.amount, 0);
      return [card.id, total] as const;
    })
  );
  const spentThisPeriod = Object.fromEntries(spentEntries);

  return (
    <DebtsClient
      debts={(debts ?? []) as Debt[]}
      accounts={(accounts ?? []) as Account[]}
      spentThisPeriod={spentThisPeriod}
    />
  );
}
