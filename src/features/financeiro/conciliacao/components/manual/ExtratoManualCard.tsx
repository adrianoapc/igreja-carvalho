import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Search, Split, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { anonymizePixDescription } from "@/utils/anonymization";
import type { ExtratoItem } from "../../model/types";

interface ExtratoManualCardProps {
  extrato: ExtratoItem;
  onVincular: (extrato: ExtratoItem) => void;
  onDividir: (extrato: ExtratoItem) => void;
  onIgnorar: (extratoId: string) => void;
}

/**
 * Rótulo legível pro `motivo` de `fin_listar_extratos_sem_candidato` (C2-1) —
 * chaves batem com o CASE da RPC (`supabase/migrations/
 * 20260817120000_fin_listar_extratos_sem_candidato_motivos_reais.sql`).
 */
const MOTIVO_LABEL: Record<string, string> = {
  venda_getnet_sem_vinculo_confirmado:
    "Parece Getnet, mas nenhum motor confirmou o vínculo ainda",
  tarifa_bancaria_sem_lancamento:
    "Tarifa bancária — provavelmente falta lançar essa despesa",
  aplicacao_financeira_automatica:
    "Aplicação/resgate automático do banco (ContaMax) — não é receita ou despesa da igreja",
  cheque_sem_lancamento_correspondente:
    "Cheque sem lançamento correspondente — confira manualmente",
  sem_transacao_compativel_no_periodo:
    "Nenhuma transação compatível encontrada no período",
};

/**
 * Motivos onde a movimentação NUNCA é receita/despesa real da igreja — só
 * `aplicacao_financeira_automatica` (ContaMax é um sweep de caixa dentro do
 * próprio banco, sem contrapartida no DRE). "Dividir" não faz sentido (linha
 * única) e "Ignorar" vira a ação primária; "Buscar manualmente" continua
 * disponível (só secundário/menos destacado) porque a classificação é um
 * heurístico de texto (`descricao ILIKE '%CONTAMAX%'`) — se errar numa linha
 * real, o tesoureiro ainda precisa de uma saída pra vincular.
 *
 * `tarifa_bancaria_sem_lancamento` NÃO entra aqui (achado P1 do @codex no
 * commit `deeb5ee9`, PR #112): tarifa é uma despesa REAL — `Ignorar` só
 * marca `extratos_bancarios.reconciliado=true`
 * (`fin_marcar_extrato_ignorado`), não cria nenhum lançamento de despesa.
 * Promover Ignorar a ação primária pra tarifa incentivava o tesoureiro a
 * descartar a linha sem nunca registrar o gasto, subestimando despesas no
 * DRE. Tarifa mantém o conjunto de ações padrão (Buscar manualmente
 * primário) igual a Getnet/genérico — cheque também fica de fora pelo
 * mesmo motivo original (pode corresponder a uma oferta/pagamento real).
 */
const MOTIVOS_NUNCA_RECEITA_OU_DESPESA = new Set([
  "aplicacao_financeira_automatica",
]);

/** Card de um extrato pendente na aba "Por Extrato" do Modo Clássico. */
export function ExtratoManualCard({
  extrato,
  onVincular,
  onDividir,
  onIgnorar,
}: ExtratoManualCardProps) {
  const { formatValue } = useHideValues();
  const isCredito = extrato.tipo === "credito" || extrato.tipo === "CREDIT";
  const nuncaReceitaOuDespesa = extrato.motivo
    ? MOTIVOS_NUNCA_RECEITA_OU_DESPESA.has(extrato.motivo)
    : false;

  return (
    <div
      className={`p-4 rounded-lg border ${
        isCredito
          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
          : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-medium text-sm truncate">
              {anonymizePixDescription(extrato.descricao)}
            </p>
            <Badge variant="outline" className="text-xs shrink-0">
              {isCredito ? "Crédito" : "Débito"}
            </Badge>
            {extrato.possivel_duplicata_de && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-400 text-amber-700 dark:text-amber-400 text-xs font-normal shrink-0"
                title="Outra linha de extrato com mesmo valor/conta e data próxima, de origem diferente — pode ser a mesma movimentação importada duas vezes."
              >
                <AlertTriangle className="w-3 h-3" />
                possível duplicata
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {format(parseISO(extrato.data_transacao), "dd/MM/yyyy", {
                locale: ptBR,
              })}
            </span>
            {extrato.contas && (
              <>
                <span>•</span>
                <span className="truncate">{extrato.contas.nome}</span>
              </>
            )}
          </div>
          {extrato.motivo && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {MOTIVO_LABEL[extrato.motivo] ?? extrato.motivo}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`font-bold ${isCredito ? "text-green-600" : "text-red-600"}`}>
            {isCredito ? "+" : "-"}
            {formatValue(Math.abs(extrato.valor))}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {nuncaReceitaOuDespesa && (
          <Button size="sm" variant="default" onClick={() => onIgnorar(extrato.id)}>
            <X className="w-3 h-3 mr-1" />
            Ignorar
          </Button>
        )}
        <Button
          size="sm"
          variant={nuncaReceitaOuDespesa ? "ghost" : "default"}
          onClick={() => onVincular(extrato)}
        >
          <Search className="w-3 h-3 mr-1" />
          Buscar manualmente
        </Button>
        {!nuncaReceitaOuDespesa && (
          <>
            <Button size="sm" variant="outline" onClick={() => onDividir(extrato)}>
              <Split className="w-3 h-3 mr-1" />
              Dividir
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onIgnorar(extrato.id)}>
              <X className="w-3 h-3 mr-1" />
              Ignorar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
