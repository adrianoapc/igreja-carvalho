import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useHideValues } from "@/hooks/useHideValues";
import { useIgrejaId } from "@/hooks/useIgrejaId";

export function ReconciliacaoBancaria() {
  const [reconciliando, setReconciliando] = useState(false);
  const { formatValue } = useHideValues();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();

  const { data: contas, refetch } = useQuery({
    queryKey: ['reconciliacao-contas', igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from('contas')
        .select('*')
        .eq('ativo', true)
        .eq('igreja_id', igrejaId);
      
      if (error) throw error;
      return data;
    },
    enabled: !igrejaLoading && !!igrejaId,
  });

  const { data: transacoes } = useQuery({
    queryKey: ['reconciliacao-transacoes', igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select('*')
        .eq('status', 'pago')
        .eq('igreja_id', igrejaId);
      
      if (error) throw error;
      return data;
    },
    enabled: !igrejaLoading && !!igrejaId,
  });


  const calcularSaldoCalculado = (contaId: string) => {
    if (!transacoes) return 0;
    
    const conta = contas?.find(c => c.id === contaId);
    if (!conta) return 0;

    const saldoInicial = Number(conta.saldo_inicial);
    
    const transacoesConta = transacoes.filter(t => t.conta_id === contaId);
    
    const entradas = transacoesConta
      .filter(t => t.tipo === 'entrada')
      .reduce((sum, t) => sum + Number(t.valor_liquido || t.valor), 0);
    
    const saidas = transacoesConta
      .filter(t => t.tipo === 'saida')
      .reduce((sum, t) => sum + Number(t.valor_liquido || t.valor), 0);
    
    return saldoInicial + entradas - saidas;
  };

  const reconciliarTodas = async () => {
    if (!contas || !igrejaId) return;
    
    setReconciliando(true);
    try {
      for (const conta of contas) {
        const saldoCalculado = calcularSaldoCalculado(conta.id);
        
        await supabase
          .from('contas')
          .update({ saldo_atual: saldoCalculado })
          .eq('id', conta.id)
          .eq('igreja_id', igrejaId);
      }
      
      await refetch();
      toast.success('Reconciliação concluída com sucesso!');
    } catch (error) {
      console.error('Erro ao reconciliar:', error);
      toast.error('Erro ao reconciliar contas');
    } finally {
      setReconciliando(false);
    }
  };

  const getDiscrepancias = () => {
    if (!contas) return [];
    
    return contas.map(conta => {
      const saldoRegistrado = Number(conta.saldo_atual);
      const saldoCalculado = calcularSaldoCalculado(conta.id);
      const diferenca = saldoRegistrado - saldoCalculado;
      
      return {
        ...conta,
        saldoRegistrado,
        saldoCalculado,
        diferenca,
        hasDiferenca: Math.abs(diferenca) > 0.01, // Tolerância de 1 centavo
      };
    });
  };

  const discrepancias = getDiscrepancias();
  const totalDiscrepancias = discrepancias.filter(d => d.hasDiferenca).length;

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Reconciliação Bancária</CardTitle>
          <Button
            onClick={reconciliarTodas}
            disabled={reconciliando}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${reconciliando ? 'animate-spin' : ''}`} />
            Reconciliar Todas
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalDiscrepancias > 0 && (
          <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-900 dark:text-orange-300">
                {totalDiscrepancias} conta(s) com discrepância
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                O saldo registrado não corresponde ao calculado a partir das transações
              </p>
            </div>
          </div>
        )}

        {totalDiscrepancias === 0 && contas && contas.length > 0 && (
          <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-green-900 dark:text-green-300">
              Todas as contas estão reconciliadas
            </p>
          </div>
        )}

        <div className="space-y-3">
          {discrepancias.map((conta) => (
            <div
              key={conta.id}
              className={`p-4 rounded-lg border ${
                conta.hasDiferenca 
                  ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20' 
                  : 'border-border bg-muted/30'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-sm">{conta.nome}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{conta.tipo}</p>
                </div>
                {conta.hasDiferenca ? (
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    Discrepância
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    OK
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Saldo Registrado</p>
                  <p className="font-semibold">{formatValue(conta.saldoRegistrado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Saldo Calculado</p>
                  <p className="font-semibold">{formatValue(conta.saldoCalculado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Diferença</p>
                  <p className={`font-semibold ${conta.hasDiferenca ? 'text-orange-600' : 'text-green-600'}`}>
                    {formatValue(conta.diferenca)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!contas || contas.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma conta cadastrada
          </p>
        )}
      </CardContent>
    </Card>
  );
}
