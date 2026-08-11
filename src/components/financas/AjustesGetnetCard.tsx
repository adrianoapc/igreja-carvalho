import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHideValues } from "@/hooks/useHideValues";
import { rpcErrorMessage } from "@/components/financas/ScoreBadge";
import {
  listarAjustesGetnet,
  listarResumoCiGetnet,
  type AjusteGetnet,
  type ResumoCiGetnet,
} from "@/features/financeiro/core/api/getnetRecebivel.api";

export interface AjustesGetnetCardProps {
  integracaoId: string;
  periodoInicio: string;
  periodoFim: string;
  filialId?: string | null;
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function ValorComSinal({
  sinal,
  valor,
  formatValue,
}: {
  sinal: string | null;
  valor: number | null;
  formatValue: (v: number) => string;
}) {
  if (valor == null) return <span className="text-muted-foreground">—</span>;
  // `sinal` é nullable no banco (byte corrompido/em branco no extrato) —
  // achado do code-review: tratar NULL como "não negativo" pintava de
  // verde/crédito um valor de sinal desconhecido, exatamente o oposto do
  // objetivo do card (deixar dedução visível, não escondida/mascarada).
  if (sinal !== "-" && sinal !== "+") {
    return <span>{formatValue(valor)} (sinal não informado)</span>;
  }
  const negativo = sinal === "-";
  return (
    <span className={negativo ? "text-destructive" : "text-green-600"}>
      {negativo ? "− " : "+ "}
      {formatValue(valor)}
    </span>
  );
}

/**
 * Ciclo 2 (C2-4) — Ajustes Getnet: `getnet_ajustes` (Tabela II do manual —
 * aluguel de POS, chargeback, cancelamento etc.) e linhas
 * `getnet_resumo.indicador_tipo_pagamento=CI` (Cobrança Interna), gravadas
 * pelo import desde sempre e nunca antes exibidas em nenhuma tela — a
 * dedução real (aluguel de POS descontado do repasse) que motivou o ciclo.
 */
export function AjustesGetnetCard({
  integracaoId,
  periodoInicio,
  periodoFim,
  filialId = null,
}: AjustesGetnetCardProps) {
  const { formatValue } = useHideValues();

  const {
    data: ajustes = [],
    isLoading: loadingAjustes,
    isError: errorAjustes,
    error: erroAjustes,
  } = useQuery<AjusteGetnet[]>({
    queryKey: ["ajustes-getnet", integracaoId, filialId, periodoInicio, periodoFim],
    queryFn: () =>
      listarAjustesGetnet({ integracaoId, periodoInicio, periodoFim, filialId }),
    enabled: !!integracaoId,
  });

  const {
    data: linhasCi = [],
    isLoading: loadingCi,
    isError: errorCi,
    error: erroCi,
  } = useQuery<ResumoCiGetnet[]>({
    queryKey: ["resumo-ci-getnet", integracaoId, filialId, periodoInicio, periodoFim],
    queryFn: () =>
      listarResumoCiGetnet({ integracaoId, periodoInicio, periodoFim, filialId }),
    enabled: !!integracaoId,
  });

  if (!integracaoId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileWarning className="w-4 h-4" /> Ajustes Getnet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Ajustes ({ajustes.length})
          </p>
          {loadingAjustes ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : errorAjustes ? (
            // Achado do code-review: sem isso, uma falha real na RPC
            // renderizava idêntico a "0 ajustes no período" — o pior
            // resultado possível pra um card cujo propósito é justamente
            // não deixar dedução passar despercebida.
            <div className="border rounded-lg p-3 text-center text-sm text-destructive">
              Não foi possível carregar os ajustes
              {rpcErrorMessage(erroAjustes) ? `: ${rpcErrorMessage(erroAjustes)}` : "."}
            </div>
          ) : ajustes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum ajuste no período (aluguel de POS, chargeback, cancelamento etc.).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>RV</TableHead>
                    <TableHead>Terminal</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ajustes.map((a) => (
                    <TableRow key={a.ajuste_id}>
                      <TableCell className="text-sm">
                        {formatarData(a.data_pagamento_rv ?? a.data_rv)}
                      </TableCell>
                      <TableCell className="text-sm">{a.motivo_descricao}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.rv_ajustado}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.numero_terminal ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <ValorComSinal
                          sinal={a.sinal}
                          valor={a.valor_ajuste}
                          formatValue={formatValue}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Cobrança interna — CI ({linhasCi.length})
          </p>
          {loadingCi ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : errorCi ? (
            <div className="border rounded-lg p-3 text-center text-sm text-destructive">
              Não foi possível carregar as linhas de cobrança interna
              {rpcErrorMessage(erroCi) ? `: ${rpcErrorMessage(erroCi)}` : "."}
            </div>
          ) : linhasCi.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma linha de cobrança interna no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>RV</TableHead>
                    <TableHead className="text-right">Valor líquido</TableHead>
                    <TableHead className="text-right">Valor da cobrança</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasCi.map((r) => (
                    <TableRow key={r.resumo_id}>
                      <TableCell className="text-sm">
                        {formatarData(r.data_pagamento_rv ?? r.data_rv)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.rv}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatValue(r.valor_liquido)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {r.valor_liquido_cobranca == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          // Sempre dedução (aluguel de POS/ajuste), nunca
                          // crédito — manual pág. 14: o "sinal" geral só se
                          // refere a valor_liquido (seq 14), não a este
                          // campo (seq 29), que é magnitude simples (achado
                          // do code-review: exibir sem sinal escondia
                          // exatamente a dedução que motivou o card).
                          <span className="text-destructive">
                            − {formatValue(r.valor_liquido_cobranca)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
