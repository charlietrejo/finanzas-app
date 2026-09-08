import { daysBetween } from "@/lib/date-utils";

const AVG_DAYS_PER_MONTH = 30.44;
const MIN_DAYS_FOR_PROJECTION = 7;

export type GoalProjectionStatus = "completed" | "insufficient_data" | "no_progress" | "projected";

export interface GoalProjection {
  status: GoalProjectionStatus;
  monthsToGo: number | null;
  projectedDate: string | null;
  onTrack: boolean | null;
}

/**
 * Proyección de cumplimiento "según ritmo actual" (sección 3.5): usa el
 * ritmo de aportación observado (current_amount / tiempo transcurrido desde
 * la creación de la meta) para estimar cuándo se alcanzaría target_amount.
 */
export function projectGoalCompletion({
  targetAmount,
  currentAmount,
  createdAt,
  targetDate,
  today = new Date(),
}: {
  targetAmount: number;
  currentAmount: number;
  createdAt: string;
  targetDate: string;
  today?: Date;
}): GoalProjection {
  if (currentAmount >= targetAmount) {
    return { status: "completed", monthsToGo: null, projectedDate: null, onTrack: true };
  }

  const daysElapsed = daysBetween(createdAt, today);
  if (daysElapsed < MIN_DAYS_FOR_PROJECTION) {
    return { status: "insufficient_data", monthsToGo: null, projectedDate: null, onTrack: null };
  }

  const monthlyRate = currentAmount / (daysElapsed / AVG_DAYS_PER_MONTH);
  if (monthlyRate <= 0) {
    return { status: "no_progress", monthsToGo: null, projectedDate: null, onTrack: false };
  }

  const remaining = targetAmount - currentAmount;
  const monthsToGo = Math.ceil(remaining / monthlyRate);

  const projected = new Date(today);
  projected.setUTCDate(projected.getUTCDate() + Math.ceil(monthsToGo * AVG_DAYS_PER_MONTH));

  const onTrack = projected.getTime() <= new Date(targetDate).getTime();

  return {
    status: "projected",
    monthsToGo,
    projectedDate: projected.toISOString().slice(0, 10),
    onTrack,
  };
}
