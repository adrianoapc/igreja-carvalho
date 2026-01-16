import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import {
  Loader2,
  Download,
  Search,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  AlertCircle,
  CheckCircle2,
  Wallet,
  RefreshCw,
} from "lucide-react";

interface ExtratoItem {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
  saldo_apos?: number;
}

interface ExtratoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contaId: string;
  contaNome: string;
  integracaoId: string;
  agencia?: string;
  contaNumero?: string;
  cnpjBanco?: string;
}

export function ExtratoPreviewDialog({
  open,
  onOpenChange,
  contaId,
  contaNome,
  integracaoId,
  agencia,
  contaNumero,
  cnpjBanco,
}: ExtratoPreviewDialogProps) {
  const { formatValue } = useHideValues();
  const [dataInicio, setDataInicio] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [dataFim, setDataFim] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [extrato, setExtrato] = useState<ExtratoItem[]>([]);
  const [fetched, setFetched] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    inseridos: number;
    atualizados: number;
    ignorados: number;
  } | null>(null);
  const [saldoAtual, setSaldoAtual] = useState<number | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  const buscarSaldo = async () => {
    setLoadingSaldo(true);
    try {
      const { data, error } = await supabase.functions.invoke("santander-api", {
        body: {
          action: "saldo",
          integracao_id: integracaoId,
          conta_id: contaId,
          banco_id: cnpjBanco,
          agencia: agencia || "",
          conta: contaNumero?.replace(/\D/g, "") || "",
        },
      });

      if (error) {
        console.error("Erro ao buscar saldo:", error);
        return;
      }

      if (data.success && data.balance?.availableAmount !== undefined) {
        setSaldoAtual(data.balance.availableAmount);
      }
    } catch (err) {
      console.error("Exceção ao buscar saldo:", err);
    } finally {
      setLoadingSaldo(false);
    }
  };

  useEffect(() => {
    if (open && integracaoId) {
      buscarSaldo();
    }
  }, [open, integracaoId]);

  const totalCreditos = extrato
    .filter((e) => e.tipo === "credito")
    .reduce((sum, e) => sum + e.valor, 0);

  const totalDebitos = extrato
    .filter((e) => e.tipo === "debito")
    .reduce((sum, e) => sum + e.valor, 0);

  const saldoPeriodo = totalCreditos - totalDebitos;

  const handleBuscarExtrato = async () => {
    setLoading(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("santander-api", {
        body: {
          action: "extrato",
          integracao_id: integracaoId,
          conta_id: contaId,
          banco_id: cnpjBanco,
          agencia: agencia || "",
          conta: contaNumero?.replace(/\D/g, "") || "",
          data_inicio: dataInicio,
          data_fim: dataFim,
        },
      });

      if (error) {
        console.error("Erro ao buscar extrato:", error);
        toast.error("Erro ao buscar extrato", { description: error.message });
        return;
      }

      if (!data.success) {
        toast.error("Falha ao buscar extrato", { description: data.error });
        return;
      }

      // Transformar dados do banco para formato interno
      const transacoes: ExtratoItem[] = (data.transacoes || []).map(
        (t: {
          external_id: string;
          data_transacao: string;
          descricao: string;
          valor: number;
          tipo: string;
          saldo?: number;
        }) => ({
          id: t.external_id || crypto.randomUUID(),
          data: t.data_transacao,
          descricao: t.descricao,
          valor: Math.abs(t.valor),
          tipo: t.tipo === "credito" ? "credito" : "debito",
          saldo_apos: t.saldo,
        })
      );

      setExtrato(transacoes);
      setFetched(true);
      toast.success(`${transacoes.length} transações encontradas`);
    } catch (err) {
      console.error("Exceção ao buscar extrato:", err);
      toast.error("Erro ao buscar extrato");
    } finally {
      setLoading(false);
    }
  };

  const handleImportar = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("santander-api", {
        body: {
          action: "sync",
          integracao_id: integracaoId,
          conta_id: contaId,
          banco_id: cnpjBanco,
          agencia: agencia || "",
          conta: contaNumero?.replace(/\D/g, "") || "",
          data_inicio: dataInicio,
          data_fim: dataFim,
        },
      });

      if (error) {
        console.error("Erro ao sincronizar:", error);
        toast.error("Erro ao importar extrato", { description: error.message });
        return;
      }

      if (!data.success) {
        toast.error("Falha ao importar", { description: data.error });
        return;
      }

      setSyncResult({
        inseridos: data.stats?.inserted || 0,
        atualizados: data.stats?.updated || 0,
        ignorados: data.stats?.skipped || 0,
      });

      toast.success("Extrato importado com sucesso!", {
        description: `${data.stats?.inserted || 0} novos, ${
          data.stats?.updated || 0
        } atualizados`,
      });
    } catch (err) {
      console.error("Exceção ao sincronizar:", err);
      toast.error("Erro ao importar extrato");
    } finally {
      setSyncing(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setExtrato([]);
      setFetched(false);
      setSyncResult(null);
    }
    onOpenChange(open);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      trigger={null}
      dialogContentProps={{ className: "max-w-2xl" }}
    >
      <div className="space-y-4">
        {/* Header com Saldo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Extrato Bancário</h2>
              <p className="text-sm text-muted-foreground">{contaNome}</p>
            </div>
          </div>
          
          {/* Saldo Atual */}
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
            <Wallet className="w-5 h-5 text-primary" />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Saldo Atual</p>
              {loadingSaldo ? (
                <Loader2 className="w-4 h-4 animate-spin ml-auto" />
              ) : saldoAtual !== null ? (
                <p className="text-lg font-bold text-primary">
                  {formatValue(saldoAtual)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">--</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={buscarSaldo}
              disabled={loadingSaldo}
            >
              <RefreshCw className={`w-4 h-4 ${loadingSaldo ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Seletor de Período */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="dataInicio" className="text-xs">
              Data Início
            </Label>
            <Input
              id="dataInicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="dataFim" className="text-xs">
              Data Fim
            </Label>
            <Input
              id="dataFim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleBuscarExtrato} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Buscar
            </Button>
          </div>
        </div>

        {/* Resultado da Sincronização */}
        {syncResult && (
          <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-900 dark:text-green-300">
                Importação concluída!
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                {syncResult.inseridos} inserido(s), {syncResult.atualizados}{" "}
                atualizado(s), {syncResult.ignorados} ignorado(s)
              </p>
            </div>
          </div>
        )}

        {/* Resumo do Período */}
        {fetched && extrato.length > 0 && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-green-600" />
                <p className="text-xs text-muted-foreground">Créditos</p>
              </div>
              <p className="text-sm font-bold text-green-600">
                {formatValue(totalCreditos)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingDown className="w-3 h-3 text-red-600" />
                <p className="text-xs text-muted-foreground">Débitos</p>
              </div>
              <p className="text-sm font-bold text-red-600">
                {formatValue(totalDebitos)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <ArrowRightLeft className="w-3 h-3" />
                <p className="text-xs text-muted-foreground">Saldo</p>
              </div>
              <p
                className={`text-sm font-bold ${
                  saldoPeriodo >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatValue(saldoPeriodo)}
              </p>
            </div>
          </div>
        )}

        {/* Lista de Transações */}
        {fetched && (
          <ScrollArea className="h-[300px] border rounded-lg">
            {extrato.length > 0 ? (
              <div className="p-2 space-y-2">
                {extrato.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      item.tipo === "credito"
                        ? "bg-green-50 dark:bg-green-950/20"
                        : "bg-red-50 dark:bg-red-950/20"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.descricao}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(item.data), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p
                        className={`text-sm font-bold ${
                          item.tipo === "credito"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {item.tipo === "credito" ? "+" : "-"}{" "}
                        {formatValue(item.valor)}
                      </p>
                      {item.saldo_apos !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Saldo: {formatValue(item.saldo_apos)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma transação encontrada no período
                </p>
              </div>
            )}
          </ScrollArea>
        )}

        {/* Instrução inicial */}
        {!fetched && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Selecione o período e clique em "Buscar" para visualizar o extrato
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Fechar
          </Button>
          {fetched && extrato.length > 0 && (
            <Button onClick={handleImportar} disabled={syncing}>
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Importar para Conciliação
            </Button>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
