import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceRecurringDate } from "@/lib/recurring";
import type { RecurringFrequency } from "@/types/database";

export const dynamic = "force-dynamic";

interface EligibleTemplate {
  id: string;
  next_occurrence_date: string;
  recurring_frequency: RecurringFrequency;
  recurring_interval_days: number | null;
}

/**
 * Fase 8 del doc: llamada diariamente por un Vercel Cron Job (ver
 * vercel.json). Vercel manda automáticamente `Authorization: Bearer
 * $CRON_SECRET` en cada invocación cuando esa env var existe en el
 * proyecto — así que validar ese header es suficiente para que la ruta no
 * sea invocable públicamente, sin necesitar sesión de usuario.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: templates, error } = await supabase
    .from("transactions")
    .select("id, next_occurrence_date, recurring_frequency, recurring_interval_days")
    .eq("is_recurring", true)
    .lte("next_occurrence_date", today)
    .or(`recurring_end_date.is.null,recurring_end_date.gte.${today}`)
    .returns<EligibleTemplate[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let generated = 0;
  let skipped = 0;
  const errors: { template_id: string; message: string }[] = [];

  for (const template of templates ?? []) {
    const nextOccurrenceDate = advanceRecurringDate(
      template.next_occurrence_date,
      template.recurring_frequency,
      template.recurring_interval_days
    );

    const { data, error: rpcError } = await supabase.rpc("generate_recurring_occurrence", {
      p_template_id: template.id,
      p_next_occurrence_date: nextOccurrenceDate,
    });

    if (rpcError) {
      errors.push({ template_id: template.id, message: rpcError.message });
      continue;
    }
    if (data) {
      generated++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({
    processed: templates?.length ?? 0,
    generated,
    skipped,
    errors,
  });
}
