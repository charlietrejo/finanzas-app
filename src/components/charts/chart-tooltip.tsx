interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  formatter?: (value: number) => string;
  payload?: { name: string; value: number; color: string }[];
}

export function ChartTooltip({ active, label, payload, formatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-badge border border-mist bg-snow px-3 py-2 text-sm shadow-[var(--shadow-card)]">
      {label && <p className="mb-1 font-medium text-ink">{label}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-slate">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}:</span>
          <span className="font-medium text-ink">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
