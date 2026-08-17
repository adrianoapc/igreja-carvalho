import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

/**
 * Paleta de status validada (skill dataviz, references/palette.md) — 4 cores
 * reservadas, cada uma com ícone + rótulo (nunca só cor). O par âmbar/vermelho
 * herdado do app (`--destructive`) não separa (ΔE < 15 entre os dois, medido
 * com `validate_palette.js` — abaixo do piso de visão normal, não só
 * daltonismo). Extraída de ConciliacaoCartaoLedger.tsx (Fase 7b) pra ser
 * reaproveitada em outras telas que precisem do mesmo vocabulário de status
 * (ex.: HistoricoExtratos), em vez de cada tela reinventar cor via Tailwind
 * cru (`text-yellow-600`/`text-green-600` falham CVD: ΔE 3.6 sob protanopia).
 */
export const STATUS_COLOR = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export type StatusTone = keyof typeof STATUS_COLOR;

// Contraste de texto medido por swatch (WCAG relative luminance) — preto
// (tom "primary ink" do skill) pra good/warning/serious, branco só pra
// critical (é o único em que branco vence: 4.80:1 vs 4.37:1 de preto).
export const STATUS_TEXT: Record<StatusTone, string> = {
  good: "#0b0b0b",
  warning: "#0b0b0b",
  serious: "#0b0b0b",
  critical: "#ffffff",
};

export function pillStyle(tone: StatusTone): { backgroundColor: string; color: string } {
  return { backgroundColor: STATUS_COLOR[tone], color: STATUS_TEXT[tone] };
}

export const STATUS_ICON: Record<StatusTone, typeof CheckCircle2> = {
  good: CheckCircle2,
  warning: Clock,
  serious: AlertTriangle,
  critical: AlertCircle,
};
