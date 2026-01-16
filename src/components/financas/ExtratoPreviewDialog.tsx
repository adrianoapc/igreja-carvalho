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
import { HideValuesToggle } from "@/components/financas/HideValuesToggle";
import { anonymizePixDescription } from "@/utils/anonymization";
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

  // Função para formatar valor como moeda BRL
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Função que combina formatação de moeda com ocultação de valores
  const formatValueWithCurrency = (value: number) => {
    const formatted = formatCurrency(value);
    const hidden = formatValue(value);
    // Se formatValue retorna um símbolo diferente de R$, significa que esconde
    return hidden.includes("•") ? hidden : formatted;
  };
  const [dataInicio, setDataInicio] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [dataFim, setDataFim] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [extrato, setExtrato] = useState<ExtratoItem[]>([]);
  const [fetched, setFetched] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "credito" | "debito">(
    "todos"
  );
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
      // Santander retorna: creditDebitType, transactionName, amount (string), transactionDate (DD/MM/YYYY)
      const transacoes: ExtratoItem[] = (data.transacoes || [])
        .filter(
          (t: {
            transactionName?: string;
            descricao?: string;
            historicComplement?: string;
          }) => {
            // Filtrar transações CONTAMAX (movimentações internas do banco)
            const textoCompleto = [
              t.transactionName,
              t.descricao,
              t.historicComplement,
            ]
              .filter(Boolean)
              .join(" ")
              .toUpperCase();
            return !textoCompleto.includes("CONTAMAX");
          }
        )
        .map(
          (t: {
            creditDebitType?: string;
            transactionName?: string;
            historicComplement?: string;
            amount?: string | number;
            transactionDate?: string;
            // Campos alternativos caso já venha transformado
            external_id?: string;
            data_transacao?: string;
            descricao?: string;
            valor?: number;
            tipo?: string;
            saldo?: number;
          }) => {
            // Parse da data no formato DD/MM/YYYY para ISO
            let dataFormatada = t.data_transacao || t.transactionDate || "";
            if (dataFormatada.includes("/")) {
              const [dia, mes, ano] = dataFormatada.split("/");
              dataFormatada = `${ano}-${mes}-${dia}`;
            }

            const valorNumerico =
              typeof t.amount === "string"
                ? parseFloat(t.amount.replace(",", "."))
                : t.amount || t.valor || 0;

            const descricaoOriginal =
              t.descricao ||
              [t.transactionName, t.historicComplement]
                .filter(Boolean)
                .join(" - ");
            const descricaoCompleta =
              anonymizePixDescription(descricaoOriginal);

            const tipoTransacao =
              t.tipo ||
              (t.creditDebitType?.toUpperCase() === "CREDITO"
                ? "credito"
                : "debito");

            return {
              id: t.external_id || crypto.randomUUID(),
              data: dataFormatada,
              descricao: descricaoCompleta,
              valor: Math.abs(valorNumerico),
              tipo: tipoTransacao,
              saldo_apos: t.saldo,
            };
          }
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
      setFiltroTipo("todos");
    }
    onOpenChange(open);
  };

  // Filtrar extrato por tipo
  const extratoFiltrado = extrato.filter((item) => {
    if (filtroTipo === "todos") return true;
    return item.tipo === filtroTipo;
  });

  const toggleFiltro = (tipo: "credito" | "debito") => {
    setFiltroTipo((prev) => (prev === tipo ? "todos" : tipo));
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      trigger={null}
      dialogContentProps={{ className: "max-w-2xl" }}
    >
      <div className="space-y-4">
        {/* Header com Título */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Extrato Bancário</h2>
              <p className="text-sm text-muted-foreground">{contaNome}</p>
            </div>
          </div>
          <HideValuesToggle />
        </div>

        {/* Saldo Atual - Card destacado */}
        <div className="p-4 bg-gradient-to-br from-primary/15 to-primary/5 rounded-lg border border-primary/20 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/20 rounded-lg">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Saldo Disponível
                </p>
                {loadingSaldo ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      Atualizando...
                    </p>
                  </div>
                ) : saldoAtual !== null ? (
                  <p
                    className={`text-2xl font-bold ${
                      saldoAtual >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {formatValueWithCurrency(saldoAtual)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Dados não disponíveis
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={buscarSaldo}
              disabled={loadingSaldo}
              className="h-9 gap-1.5"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingSaldo ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline text-xs">Atualizar</span>
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
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Resumo do Período
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => toggleFiltro("credito")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  filtroTipo === "credito"
                    ? "bg-green-200 dark:bg-green-900/50 border-green-400 dark:border-green-700 ring-2 ring-green-500 ring-offset-1"
                    : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30 hover:bg-green-100 dark:hover:bg-green-950/40"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Créditos
                  </p>
                </div>
                <p className="text-lg font-bold text-green-600">
                  {formatValueWithCurrency(totalCreditos)}
                </p>
                {filtroTipo === "credito" && (
                  <p className="text-xs text-green-600 mt-1">
                    Clique para limpar
                  </p>
                )}
              </button>
              <button
                onClick={() => toggleFiltro("debito")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  filtroTipo === "debito"
                    ? "bg-red-200 dark:bg-red-900/50 border-red-400 dark:border-red-700 ring-2 ring-red-500 ring-offset-1"
                    : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-950/40"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Débitos
                  </p>
                </div>
                <p className="text-lg font-bold text-red-600">
                  {formatValueWithCurrency(totalDebitos)}
                </p>
                {filtroTipo === "debito" && (
                  <p className="text-xs text-red-600 mt-1">
                    Clique para limpar
                  </p>
                )}
              </button>
              <div
                className={`p-3 rounded-lg border ${
                  saldoPeriodo >= 0
                    ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30"
                    : "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/30"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowRightLeft
                    className={`w-4 h-4 ${
                      saldoPeriodo >= 0 ? "text-blue-600" : "text-orange-600"
                    }`}
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    Saldo Período
                  </p>
                </div>
                <p
                  className={`text-lg font-bold ${
                    saldoPeriodo >= 0 ? "text-blue-600" : "text-orange-600"
                  }`}
                >
                  {formatValueWithCurrency(saldoPeriodo)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Transações */}
        {fetched && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Transações ({extratoFiltrado.length}
                {filtroTipo !== "todos" ? ` de ${extrato.length}` : ""})
              </h3>
              {filtroTipo !== "todos" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiltroTipo("todos")}
                  className="h-7 text-xs"
                >
                  Limpar filtro
                </Button>
              )}
            </div>
            <ScrollArea className="h-[300px] border rounded-lg bg-muted/30">
              {extratoFiltrado.length > 0 ? (
                <div className="p-2 space-y-2">
                  {extratoFiltrado.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        item.tipo === "credito"
                          ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/30"
                          : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.descricao}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {item.data && !isNaN(new Date(item.data).getTime())
                              ? format(new Date(item.data), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })
                              : item.data || "Data inválida"}
                          </p>
                          {item.saldo_apos !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              Saldo: {formatValue(item.saldo_apos)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p
                          className={`text-sm font-bold ${
                            item.tipo === "credito"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {item.tipo === "credito" ? "+" : "-"}
                          {formatValueWithCurrency(item.valor)}
                        </p>
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
          </div>
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
