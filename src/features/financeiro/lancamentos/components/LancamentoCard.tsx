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
import { EncargoBadges } from "@/components/financas/EncargoBadges";
import {
  getStatusColorDynamic,
  getStatusDisplay,
  isPagamentoDinheiro,
  colunaDataFiltro,
  somarEncargos,
  TIPO_DATA_FILTRO_DEFAULT,
  type TransacaoResumo,
  type TipoDataFiltro,
} from "@/features/financeiro/core";
import { useFormaPagamentoDinheiroId } from "@/features/financeiro/core/hooks/useFormaPagamentoDinheiroId";

/**
 * Card de lançamento compartilhado por Entradas e Saídas (F2/ADR-029).
 * UX: tap único abre a edição (double-click não é padrão touch); ações e
 * cópia de ID interrompem a propagação.
 */

export interface LancamentoCardTransacao extends TransacaoResumo {
  id: string;
  descricao: string;
  valor: number | string;
  valor_liquido?: number | string | null;
  taxas_administrativas?: number | string | null;
  multas?: number | string | null;
  juros?: number | string | null;
  desconto?: number | string | null;
  status: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  conciliacao_status?: string | null;
  conferido_manual?: boolean | null;
  forma_pagamento_id?: string | null;
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
  /** Eixo de data usado pra buscar o período (TransacoesPage) — decide se o
   * card mostra vencimento ou pagamento no bloco de data compacto. */
  tipoData?: TipoDataFiltro;
  /** Bruto (valor nominal) ou líquido (valor_liquido, com desconto/taxa/
   * juros/multa) — controla o valor exibido e os badges de composição. */
  visaoValor?: "bruto" | "liquido";
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
  tipoData = TIPO_DATA_FILTRO_DEFAULT,
  visaoValor = "bruto",
}: LancamentoCardProps) {
  const conciliacaoStatus =
    transacao.conciliacao_status ||
    (conciliacaoMap.get(transacao.id) ? "conciliado_extrato" : "nao_conciliado");
  const formaDinheiroId = useFormaPagamentoDinheiroId();
  const isDinheiro = isPagamentoDinheiro(transacao.forma_pagamento_id, formaDinheiroId);
  const isConferidoManual =
    conciliacaoStatus === "nao_conciliado" &&
    isDinheiro &&
    !!transacao.conferido_manual;
  const conciliacaoBadge = CONCILIACAO_BADGES[conciliacaoStatus];
  // Mesmo eixo usado pra buscar o período — senão o card mostra vencimento
  // mesmo quando a lista foi filtrada/ordenada por pagamento (Data de Caixa).
  const dataExibidaStr =
    transacao[colunaDataFiltro(tipoData)] || transacao.data_vencimento;
  const dataExibida = new Date(dataExibidaStr + "T00:00:00");
  const valorExibido =
    visaoValor === "liquido"
      ? Number(transacao.valor_liquido ?? transacao.valor)
      : Number(transacao.valor);
  const encargosTotais = somarEncargos([transacao]);

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
          {format(dataExibida, "dd", { locale: ptBR })}
        </div>
        <div className="text-[10px] md:text-xs text-muted-foreground uppercase">
          {format(dataExibida, "MMM", { locale: ptBR })}
        </div>
      </div>

      <div className="h-10 w-px bg-border" />

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm md:text-base flex items-baseline gap-1.5">
          <span className="truncate min-w-0 flex-1">{transacao.descricao}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(transacao.id);
              toast.success("ID copiado!");
            }}
            className="text-[10px] font-mono font-normal text-muted-foreground/70 hover:text-foreground px-1 rounded hover:bg-muted transition-colors flex-shrink-0"
            title="Copiar ID"
          >
            {transacao.id.substring(0, 6)}
          </button>
        </h3>
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
          {visaoValor === "liquido" && (
            <EncargoBadges
              totais={encargosTotais}
              formatCurrency={formatCurrency}
              className="justify-end mb-1"
            />
          )}
          <div className="flex items-center gap-1.5 justify-end">
            <p
              className={`text-base md:text-lg font-bold whitespace-nowrap ${valorClass}`}
            >
              {formatCurrency(valorExibido)}
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
            {transacao.tipo_lancamento === "parcelado" &&
              !!transacao.total_parcelas &&
              transacao.total_parcelas > 1 && (
                <Badge
                  variant="outline"
                  className="text-[10px] md:text-xs"
                  title="Parcela deste lançamento — competência compartilhada com as demais (D10)"
                >
                  Parcela {transacao.numero_parcela}/{transacao.total_parcelas}
                </Badge>
              )}
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
