import { createClient } from "@/lib/supabase/server";
import { getReportsData } from "@/lib/reports-data";
import { ReportsClient } from "./reports-client";

const VALID_RANGES = [6, 12, 24] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const { months: monthsParam } = await searchParams;
  const parsed = Number(monthsParam);
  const months = VALID_RANGES.includes(parsed as (typeof VALID_RANGES)[number]) ? parsed : 12;

  const supabase = await createClient();
  const data = await getReportsData(supabase, months);

  return <ReportsClient months={months} data={data} />;
}
