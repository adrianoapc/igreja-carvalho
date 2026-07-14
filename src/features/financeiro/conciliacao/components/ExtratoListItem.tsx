import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { anonymizePixDescription } from "@/utils/anonymization";
import { ExtratoSugestaoMLA } from "@/components/financas/ExtratoSugestaoMLA";
import type { ExtratoItem } from "../hooks/useConciliacaoInteligente";

export interface SugestaoExtrato {
  transacaoId?: string;
  transacaoDescricao: string;
  transacaoValor: number;
  transacaoData: string;
  score: number;
  tipoMatch: string;
  diferencaDias: number;
  sugestaoId: string;
}

interface ExtratoListItemProps {
  item: ExtratoItem;
  selected: boolean;
  sugestao?: SugestaoExtrato;
  isRejectingSugestao: boolean;
  onSelect: (id: string) => void;
  onAceitarSugestao: (extratoId: string, transacaoId?: string) => void;
  onRejeitarSugestao: (sugestaoId: string) => void;
  onOpenQuickCreate: (e: React.MouseEvent, item: ExtratoItem) => void;
}

/** Uma linha da lista de extratos pendentes (painel "Banco"). */
export function ExtratoListItem({
  item,
  selected,
  sugestao,
  isRejectingSugestao,
  onSelect,
  onAceitarSugestao,
  onRejeitarSugestao,
  onOpenQuickCreate,
}: ExtratoListItemProps) {
  return (
    <div
      onClick={() => {
        onSelect(item.id);
        if (sugestao?.transacaoId) {
          const transacaoElement = document.getElementById(
            `transacao-${sugestao.transacaoId}`,
          );
          if (transacaoElement) {
            transacaoElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            transacaoElement.classList.add("ring-2", "ring-yellow-400");
            setTimeout(() => {
              transacaoElement.classList.remove("ring-2", "ring-yellow-400");
            }, 2000);
          }
        }
      }}
      className={cn(
        "px-2 py-1.5 rounded border cursor-pointer transition-colors group",
        selected
          ? "bg-blue-100 dark:bg-blue-900 border-blue-400"
          : "border-border hover:bg-slate-50 dark:hover:bg-slate-800",
      )}
    >
      <ExtratoSugestaoMLA
        extratoId={item.id}
        valor={item.valor}
        data={item.data_transacao}
        descricao={anonymizePixDescription(item.descricao)}
        tipo={item.tipo}
        sugestao={
          sugestao
            ? {
                transacaoDescricao: sugestao.transacaoDescricao,
                transacaoValor: sugestao.transacaoValor,
                transacaoData: sugestao.transacaoData,
                score: sugestao.score,
                tipoMatch: sugestao.tipoMatch,
                diferencaDias: sugestao.diferencaDias,
                sugestaoId: sugestao.sugestaoId,
                onAceitar: () => onAceitarSugestao(item.id, sugestao.transacaoId),
                onRejeitar: () => onRejeitarSugestao(sugestao.sugestaoId),
                isRejecting: isRejectingSugestao,
              }
            : undefined
        }
      />
      <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5"
          onClick={(e) => onOpenQuickCreate(e, item)}
          title="Criar transação rápida"
        >
          <Plus className="w-3 h-3" />
        </Button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(item.id);
            toast.success("ID copiado!");
          }}
          className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors flex-shrink-0"
          title="Copiar ID do extrato"
        >
          {item.id.substring(0, 6)}
        </button>
      </div>
    </div>
  );
}
