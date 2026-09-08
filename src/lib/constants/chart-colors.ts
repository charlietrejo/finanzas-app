/**
 * Paleta categórica validada por la skill dataviz (references/palette.md):
 * pasa los 6 checks de accesibilidad CVD contra nuestra superficie #ffffff
 * (ver decisión de paleta en el plan de Fase 4). No usar tonos de marca aquí
 * sin volver a correr scripts/validate_palette.js — el verde/ámbar/teal de
 * marca fallan la separación CVD.
 */
export const CATEGORICAL_CHART_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

export const CASH_FLOW_COLORS = {
  income: "#008300",
  expense: "#e34948",
} as const;

export const NET_WORTH_COLOR = "#6161ff";
