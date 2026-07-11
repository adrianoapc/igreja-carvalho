import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TransacaoActionsMenu } from "@/components/financas/TransacaoActionsMenu";
import {
  getStatusColorDynamic,
  getStatusDisplay,
  isPagamentoDinheiro,
  type TransacaoResumo,
} from "@/features/financeiro/core";

/**
 * Card de lançamento compartilhado por Entradas e Saídas (F2/ADR-029).
 * UX: tap único abre a edição (double-click não é padrão touch); ações e
 * cópia de ID interrompem a propagação.
 */

export interface LancamentoCardTransacao extends TransacaoResumo {
  id: string;
  descricao: string;
  valor: number | string;
  status: string;
  data_vencimento: string;
  conciliacao_status?: string | null;
  conferido_manual?: boolean | null;
  forma_pagamento?: string | null;
  solicitacao_reembolso_id?: string | null;
  categoria?: { nome: string; cor?: string | null } | null;
  conta?: { nome: string } | null;
  fornecedor?: { nome: string } | null;
}

interface LancamentoCardProps {
  transacao: LancamentoCardTransacao;
  tipo: "entrada" | "saida";
  valorClass: string;
  conciliacaoMap: Map<string, boolean>;
  formatCurrency: (value: number) => string;
  onEdit: (transacao: LancamentoCardTransacao) => void;
  onVerExtrato: (
    extratoId: string,
    entrada?: {
      id: string;
      descricao: string;
      valor: number;
      data_pagamento: string;
    },
  ) => void;
  bordered?: boolean;
}

const CONCILIACAO_BADGES: Record<string, { label: string; className: string }> =
  {
    conciliado_extrato: {
      label: "Conciliado (Extrato)",
      className:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    },
    conciliado_manual: {
      label: "Conciliado Manual",
      className:
        "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300",
    },
    conciliado_bot: {
      label: "Conciliado Bot",
      className:
        "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
    },
  };

export function LancamentoCard({
  transacao,
  tipo,
  valorClass,
  conciliacaoMap,
  formatCurrency,
  onEdit,
  onVerExtrato,
  bordered = true,
}: LancamentoCardProps) {
  const conciliacaoStatus =
    transacao.conciliacao_status ||
    (conciliacaoMap.get(transacao.id) ? "conciliado_extrato" : "nao_conciliado");
  const isDinheiro = isPagamentoDinheiro(transacao.forma_pagamento);
  const isConferidoManual =
    conciliacaoStatus === "nao_conciliado" &&
    isDinheiro &&
    !!transacao.conferido_manual;
  const conciliacaoBadge = CONCILIACAO_BADGES[conciliacaoStatus];
  const dataVencimento = new Date(transacao.data_vencimento + "T00:00:00");

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-card hover:bg-accent/50 transition-colors cursor-pointer ${
        bordered ? "rounded-lg border" : ""
      }`}
      onClick={() => onEdit(transacao)}
    >
      {/* Data compacta */}
      <div className="flex-shrink-0 text-center w-12 md:w-14">
        <div className="text-xs md:text-sm font-bold text-foreground">
          {format(dataVencimento, "dd", { locale: ptBR })}
        </div>
        <div className="text-[10px] md:text-xs text-muted-foreground uppercase">
          {format(dataVencimento, "MMM", { locale: ptBR })}
        </div>
      </div>

      <div className="h-10 w-px bg-border" />

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm md:text-base truncate flex-1">
            {transacao.descricao}
          </h3>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(transacao.id);
              toast.success("ID copiado!");
            }}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors flex-shrink-0"
            title="Copiar ID"
          >
            {transacao.id.substring(0, 6)}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          {transacao.fornecedor && (
            <>
              <span className="truncate">{transacao.fornecedor.nome}</span>
              {transacao.categoria && <span>•</span>}
            </>
          )}
          {transacao.categoria && (
            <>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: transacao.categoria.cor || "#666",
                }}
              />
              <span className="truncate">{transacao.categoria.nome}</span>
            </>
          )}
          {transacao.conta && (
            <>
              <span>•</span>
              <span className="truncate">{transacao.conta.nome}</span>
            </>
          )}
        </div>
      </div>

      {/* Valor e ações — cliques aqui não abrem a edição */}
      <div
        className="flex items-center gap-2 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <p
              className={`text-base md:text-lg font-bold whitespace-nowrap ${valorClass}`}
            >
              {formatCurrency(Number(transacao.valor))}
            </p>
            {transacao.solicitacao_reembolso_id && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1 border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400"
                    >
                      <ReceiptText className="w-2.5 h-2.5" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reembolso</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1 mt-1">
            <Badge
              className={`text-[10px] md:text-xs ${getStatusColorDynamic(transacao)}`}
            >
              {getStatusDisplay(transacao, tipo)}
            </Badge>
            {conciliacaoBadge ? (
              <Badge
                className={`text-[10px] md:text-xs ${conciliacaoBadge.className}`}
              >
                {conciliacaoBadge.label}
              </Badge>
            ) : isConferidoManual ? (
              <Badge className="text-[10px] md:text-xs bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                Conferido
              </Badge>
            ) : null}
          </div>
        </div>
        <TransacaoActionsMenu
          transacaoId={transacao.id}
          status={transacao.status}
          tipo={tipo}
          isReembolso={!!transacao.solicitacao_reembolso_id}
          isDinheiro={isDinheiro}
          conferidoManual={!!transacao.conferido_manual}
          conciliacaoStatus={conciliacaoStatus}
          onEdit={() => onEdit(transacao)}
          onVerExtrato={onVerExtrato}
        />
      </div>
    </div>
  );
}
