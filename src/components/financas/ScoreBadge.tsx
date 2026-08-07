import { Badge } from "@/components/ui/badge";

/**
 * Normalizador de score tolerante a 2 escalas usadas hoje no domínio Getnet:
 * Hop 1/2 (`fin_gerar_candidatos_oferta_venda_getnet` /
 * `fin_gerar_candidatos_venda_banco_getnet`) devolvem 0..1; lote de
 * antecipação e a busca manual (`fin_buscar_recebiveis_getnet_oferta`) já
 * devolvem 0..100. `score > 1` é tratado como "já é percentual".
 */
export function scorePct(score: number): number {
  const pct = score > 1 ? score : score * 100;
  return Math.round(pct);
}

export interface ScoreThresholds {
  /** Score (0..100, já normalizado) a partir do qual o badge é "Alta". */
  alta: number;
  /** Score (0..100, já normalizado) a partir do qual o badge é "Média" (abaixo disso, "Baixa"). */
  media: number;
}

/**
 * Badge de score compartilhado — thresholds SEMPRE explícitos via prop, sem
 * default mágico. Cada call-site usa o corte que já usava antes da extração:
 * Hop 1/2 = 85/50, lote de antecipação e busca manual do ledger = 60/30,
 * `VincularTransacaoDialog` = 80/50. Não unificar cortes entre famílias
 * diferentes — ver Fase 7b do plano de ledger Getnet.
 */
export function ScoreBadge({
  score,
  thresholds,
}: {
  score: number;
  thresholds: ScoreThresholds;
}) {
  const pct = scorePct(score);
  if (pct >= thresholds.alta) {
    return <Badge className="bg-green-500 text-white">Alta ({pct}%)</Badge>;
  }
  if (pct >= thresholds.media) {
    return <Badge className="bg-yellow-500 text-white">Média ({pct}%)</Badge>;
  }
  return <Badge variant="secondary">Baixa ({pct}%)</Badge>;
}

/** Supabase/PostgREST rejeita com objeto `{ message }`, não `instanceof Error`. */
export function rpcErrorMessage(err: unknown): string | null {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (typeof err === "string" && err.trim()) return err;
  return null;
}
