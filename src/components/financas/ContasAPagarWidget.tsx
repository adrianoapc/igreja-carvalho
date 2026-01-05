import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmarPagamentoDialog } from "@/components/financas/ConfirmarPagamentoDialog";
import { useHideValues } from "@/hooks/useHideValues";
import { useFilialId } from "@/hooks/useFilialId";

interface TransacaoPendente {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
}

interface TransacaoRow {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  solicitacao_reembolso_id: string | null;
  solicitacao_reembolso?: { status: string } | null;
}

type AlertaStatus = "vencido" | "hoje" | "breve" | "ok";

function resolverStatus(dataVencimento: string): AlertaStatus {
  const hoje = new Date();
  const vencimento = parseISO(dataVencimento);
  const diff = differenceInCalendarDays(vencimento, hoje);

  if (diff < 0) return "vencido";
  if (isToday(vencimento)) return "hoje";
  if (diff <= 3) return "breve";
  return "ok";
}

function badgeProps(status: AlertaStatus) {
  switch (status) {
    case "vencido":
      return { label: "Vencido", className: "bg-red-100 text-red-700 border-red-200" };
    case "hoje":
      return { label: "Vence Hoje!", className: "bg-orange-100 text-orange-700 border-orange-200" };
    case "breve":
      return { label: "Atenção", className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    default:
      return { label: "No prazo", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  }
}

export function ContasAPagarWidget() {
  const { formatValue } = useHideValues();
  const queryClient = useQueryClient();
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<string | null>(null);
  const { igrejaId, filialId, isAllFiliais, loading: filialLoading } = useFilialId();

  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ["contas-a-pagar-widget", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("transacoes_financeiras")
        .select(`
          id, descricao, valor, data_vencimento, solicitacao_reembolso_id,
          solicitacao_reembolso:solicitacao_reembolso_id(status)
        `)
        .eq("tipo", "saida")
        .eq("status", "pendente")
        .eq("igreja_id", igrejaId)
        .order("data_vencimento", { ascending: true })
        .limit(20); // Buscar mais pois vamos filtrar
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (!isAllFiliais && filialId) {
        // need new query builder: re-run?
      }
      if (!isAllFiliais && filialId) {
        // Reexecute with filial filter
      }
      // We cannot alter after await; better apply in query before executing:
    },
  });

      if (error) throw error;

      const rows = (data ?? []) as TransacaoRow[];
      // Filtrar: exclui transações de reembolso que NÃO estão pagas
      const filtered = rows.filter((t) =>
        !t.solicitacao_reembolso_id || t.solicitacao_reembolso?.status === "pago"
      );

      return filtered.slice(0, 10).map((t) => ({
        id: t.id,
        descricao: t.descricao,
        valor: Number(t.valor),
        data_vencimento: t.data_vencimento,
      }));
    },
    enabled: !!igrejaId && !filialLoading,
  });

  const totalPendencias = useMemo(
    () => transacoes.reduce((sum, t) => sum + Number(t.valor || 0), 0),
    [transacoes]
  );

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      queryClient.invalidateQueries({ queryKey: ["contas-a-pagar-widget"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      setTransacaoSelecionada(null);
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Próximos Vencimentos</CardTitle>
          <Badge variant="outline" className="text-sm">
            {formatValue(totalPendencias)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando contas a pagar...</p>}
        {!isLoading && transacoes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma conta pendente.</p>
        )}

        {!isLoading && transacoes.length > 0 && (
          <div className="space-y-2">
            {transacoes.map((transacao) => {
              const status = resolverStatus(transacao.data_vencimento);
              const { label, className } = badgeProps(status);
              const dataFormatada = format(parseISO(transacao.data_vencimento), "dd/MM", { locale: ptBR });

              return (
                <div
                  key={transacao.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 gap-3"
                >
                  <div className="w-16 text-left">
                    <p className="text-sm font-semibold">{dataFormatada}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{transacao.descricao}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatValue(Number(transacao.valor))}</p>
                      <Badge variant="outline" className={`text-xs ${className}`}>
                        {label}
                      </Badge>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setTransacaoSelecionada(transacao.id)}
                    >
                      Pagar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <ConfirmarPagamentoDialog
        open={!!transacaoSelecionada}
        onOpenChange={handleDialogChange}
        transacaoId={transacaoSelecionada || ""}
        tipo="saida"
      />
    </Card>
  );
}
