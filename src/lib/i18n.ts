export function transactionTypeLabel(type: string) {
  switch (type) {
    case "INCOME":
      return "Ingreso";
    case "EXPENSE":
      return "Gasto";
    case "TRANSFER":
      return "Transferencia";
    default:
      return type;
  }
}

export function translateLabel(label: string) {
  const map: Record<string, string> = {
    "Income": "Ingreso",
    "Bills & Utilities": "Facturas y servicios",
    "Spending": "Gastos",
    "Left for Savings": "Disponible para ahorro",
    "Total net worth": "Patrimonio total",
    "Summary": "Resumen",
    "Monthly flow": "Flujo mensual",
    "Insights": "Insights",
    "Overview": "Resumen",
    "Assets": "Activos",
    "Debt": "Deuda",
    "Net Worth": "Patrimonio",
  };

  return map[label] ?? label;
}
