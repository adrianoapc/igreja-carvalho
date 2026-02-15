import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SincronizacaoResultado {
  sucesso: boolean;
  atualizacoes?: number;
  mensagem?: string;
  erro?: string;
  timestamp?: string;
}

/**
 * Componente para sincronizar conciliações de transferências bancárias
 * 
 * Sincroniza automaticamente o status de conciliação entre transações
 * de ENTRADA e SAÍDA que fazem parte de uma transferência.
 */
export function SincronizacaoTransferenciasWidget() {
  const igrejaId = useIgrejaId();
  const filialId = useFilialId();
  const queryClient = useQueryClient();
  const [ultimaExecucao, setUltimaExecucao] = useState<string | null>(
    localStorage.getItem("ultima_sync_transferencias") || null
  );

  // Buscar status de discrepâncias (transferências com entrada conciliada mas saída não)
  const { data: discrepancias, isLoading: carregandoDiscrepancias } = useQuery({
    queryKey: ["discrepancias-transferencias", igrejaId, filialId],
    queryFn: async () => {
      if (!igrejaId) return 0;

      const { data: dados, error } = await supabase.rpc(
        "contar_transferencias_dessincronizadas",
        {
          p_igreja_id: igrejaId,
          p_filial_id: filialId || null,
        }
      );

      if (error) throw error;
      return dados || 0;
    },
    enabled: !!igrejaId,
    refetchInterval: 5 * 60 * 1000, // Recarrega a cada 5 minutos
  });

  // Mutation para sincronizar
  const { mutate: sincronizar, isPending: sincronizando } = useMutation({
    mutationFn: async () => {
      if (!igrejaId) throw new Error("Igreja não identificada");

      const { data: resultado, error } = await supabase.rpc(
        "sincronizar_transferencias_reconciliacao",
        {
          p_limite: 500,
        }
      );

      if (error) throw error;
      return resultado as SincronizacaoResultado;
    },
    onSuccess: (resultado) => {
      if (resultado.sucesso) {
        toast.success(
          `✓ ${resultado.atualizacoes || 0} transações sincronizadas!`
        );
        setUltimaExecucao(new Date().toISOString());
        localStorage.setItem(
          "ultima_sync_transferencias",
          new Date().toISOString()
        );
        queryClient.invalidateQueries({
          queryKey: ["discrepancias-transferencias"],
        });
      } else {
        toast.error(resultado.erro || "Erro ao sincronizar");
      }
    },
    onError: (error: any) => {
      console.error("Erro na sincronização:", error);
      toast.error(
        error.message || "Erro ao sincronizar transferências"
      );
    },
  });

  const temDiscrepancias = (discrepancias || 0) > 0;
  const horariioUltimaExecucao = ultimaExecucao
    ? format(new Date(ultimaExecucao), "dd/MM/yyyy HH:mm")
    : "Nunca";

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-600" />
            <div>
              <CardTitle className="text-base">
                Sincronização de Transferências
              </CardTitle>
              <CardDescription className="text-xs">
                Mantém entrada e saída de transferências com status igual
              </CardDescription>
            </div>
          </div>
          {temDiscrepancias ? (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="w-3 h-3" />
              {discrepancias} pendente(s)
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
              <CheckCircle2 className="w-3 h-3" />
              Sincronizado
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white dark:bg-slate-900 p-3 rounded border">
            <p className="text-xs text-muted-foreground mb-1">
              Transferências Dessincronizadas
            </p>
            {carregandoDiscrepancias ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            ) : (
              <p className="text-lg font-bold text-amber-600">
                {discrepancias || 0}
              </p>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 p-3 rounded border">
            <p className="text-xs text-muted-foreground mb-1">
              Última Sincronização
            </p>
            <p className="text-xs font-mono text-green-600">
              {horariioUltimaExecucao}
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded text-xs space-y-2 text-muted-foreground">
          <p>
            <strong>O que faz:</strong> Quando uma ENTRADA de transferência é
            conciliada com o extrato, a SAÍDA correspondente recebe o mesmo
            status.
          </p>
          <p>
            <strong>Benefício:</strong> Evita inconsistências entre contas e
            facilita a conciliação bancária completa.
          </p>
        </div>

        {/* Botão */}
        <Button
          onClick={() => sincronizar()}
          disabled={sincronizando || !temDiscrepancias}
          className="w-full gap-2"
          variant={temDiscrepancias ? "default" : "outline"}
        >
          {sincronizando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sincronizando...
            </>
          ) : temDiscrepancias ? (
            <>
              <Zap className="w-4 h-4" />
              Sincronizar Agora ({discrepancias})
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Tudo Sincronizado
            </>
          )}
        </Button>

        {/* Nota */}
        <p className="text-xs text-muted-foreground text-center">
          💡 Sincronização automática ocorre diariamente. Clique acima para
          forçar uma sincronização imediata.
        </p>
      </CardContent>
    </Card>
  );
}
