import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Destaque visual compartilhado de "sugestão" no Modo Inteligente — sem
 * percentual. C2-0: antes só o painel Banco (sugestão ML, `ExtratoSugestaoMLA`)
 * mostrava um score numérico; o painel Sistema (candidato do motor F4,
 * `TransacaoListItem`) já não mostrava número, só um highlight amarelo. São
 * dois mecanismos internamente diferentes (ML persistido com aceitar/rejeitar
 * vs. score do motor F4 sob demanda, só quando 1 extrato está selecionado) —
 * unificados aqui só na aparência, pra dar consistência entre os painéis sem
 * expor score em nenhum dos dois.
 */
export function SugestaoTag({
  label = "Sugestão",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      <Sparkles className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

/** Borda tracejada compartilhada — aplicar no container do item quando houver sugestão. */
export const SUGESTAO_BORDA_CLASS =
  "border-dashed border-amber-400/70 bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-700/50";
