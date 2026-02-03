import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  ArrowLeft,
  Building2,
  Landmark,
  Wallet,
  Edit,
  Settings,
  TrendingUp,
  TrendingDown,
  List,
  Check,
  Calendar,
  TestTube2,
  Loader2,
  FileText,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ContaDialog } from "@/components/financas/ContaDialog";
import { AjusteSaldoDialog } from "@/components/financas/AjusteSaldoDialog";
import { ExtratoPreviewDialog } from "@/components/financas/ExtratoPreviewDialog";
import { TransferenciaDialog } from "@/components/financas/TransferenciaDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MonthPicker } from "@/components/financas/MonthPicker";
import { formatLocalDate, startOfMonthLocal, endOfMonthLocal } from "@/utils/dateUtils";
import { useHideValues } from "@/hooks/useHideValues";
import { HideValuesToggle } from "@/components/financas/HideValuesToggle";
import { useAuthContext } from "@/contexts/AuthContextProvider";

export default function Contas() {
  const navigate = useNavigate();
  const { formatValue } = useHideValues();
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();
  const [contaDialogOpen, setContaDialogOpen] = useState(false);
  const [ajusteSaldoDialogOpen, setAjusteSaldoDialogOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<{
    id: string;
    nome: string;
    tipo: string;
    saldo_atual: number;
  } | null>(null);
  const [selectedContaIds, setSelectedContaIds] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const [agruparPorData, setAgruparPorData] = useState(false);
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(
    new Set(),
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "pago" | "pendente">("all");
  const [testingContaId, setTestingContaId] = useState<string | null>(null);
  const [extratoDialogOpen, setExtratoDialogOpen] = useState(false);
  const [transferenciaDialogOpen, setTransferenciaDialogOpen] = useState(false);
  const [extratoContaData, setExtratoContaData] = useState<{
    id: string;
    nome: string;
    integracaoId: string;
    agencia?: string;
    contaNumero?: string;
    cnpjBanco?: string;
  } | null>(null);
  const { data: contas, isLoading } = useQuery({
    queryKey: ["contas", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("*")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !loading && !!igrejaId,
  });

  // Buscar integrações bancárias ativas
  const { data: integracoes } = useQuery({
    queryKey: ["integracoes-financeiras", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("integracoes_financeiras")
        .select("id, provedor, status")
        .eq("igreja_id", igrejaId)
        .eq("status", "ativo");
      if (error) throw error;
      return data;
    },
    enabled: !loading && !!igrejaId,
  });

  // Função para testar conexão bancária
  const handleTestConnection = async (conta: {
    id: string;
    cnpj_banco?: string | null;
    agencia?: string | null;
    conta_numero?: string | null;
  }) => {
    if (!conta.cnpj_banco) {
      toast.error("CNPJ do banco não configurado", {
        description: "Edite a conta e preencha o CNPJ do banco para testar a integração.",
      });
      return;
    }

    // Verificar se existe integração Santander ativa
    const santanderIntegracao = integracoes?.find((i) => i.provedor === "santander" && i.status === "ativo");
    if (!santanderIntegracao) {
      toast.error("Nenhuma integração Santander ativa", {
        description: "Configure uma integração Santander na página de integrações.",
      });
      return;
    }

    setTestingContaId(conta.id);
    try {
      const { data, error } = await supabase.functions.invoke("test-santander", {
        body: {
          integracao_id: santanderIntegracao.id,
          banco_id: conta.cnpj_banco,
          agencia: conta.agencia || "",
          conta: conta.conta_numero?.replace(/\D/g, "") || "",
        },
      });

      if (error) {
        console.error("Test error:", error);
        toast.error(`Erro no teste: ${error.message}`);
        return;
      }

      console.log("Test result:", data);

      if (data.balance?.obtained) {
        toast.success("Conexão testada com sucesso!", {
          description: `Saldo disponível: R$ ${data.balance.data?.availableAmount || "N/A"}`,
        });
      } else if (data.token?.obtained) {
        toast.warning("Token obtido, mas saldo falhou", {
          description: data.balance?.error?.detail || "Verifique os dados da conta",
        });
      } else {
        toast.error("Falha na conexão", {
          description: data.tokenError || "Verifique as credenciais da integração",
        });
      }
    } catch (err) {
      console.error("Test exception:", err);
      toast.error("Erro ao testar conexão");
    } finally {
      setTestingContaId(null);
    }
  };

  // Verificar se conta tem integração disponível
  const hasIntegration = (cnpjBanco?: string | null) => {
    if (!cnpjBanco || !integracoes) return false;
    // Por enquanto, só Santander está implementado
    const santanderCnpj = "90400888000142";
    return cnpjBanco === santanderCnpj && integracoes.some((i) => i.provedor === "santander" && i.status === "ativo");
  };

  const startDate = customRange
    ? formatLocalDate(customRange.from)
    : formatLocalDate(startOfMonthLocal(selectedMonth));
  const endDate = customRange
    ? formatLocalDate(customRange.to)
    : formatLocalDate(endOfMonthLocal(selectedMonth));

  const { data: transacoes, isLoading: isLoadingTransacoes } = useQuery({
    queryKey: [
      "transacoes-contas",
      igrejaId,
      filialId,
      isAllFiliais,
      selectedContaIds,
      selectedMonth,
      customRange,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          `
          *,
          categorias_financeiras(nome, cor),
          fornecedores(nome),
          contas(nome)
        `
        )
        .eq("igreja_id", igrejaId)
        .gte("data_vencimento", startDate)
        .lte("data_vencimento", endDate)
        .order("data_vencimento", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      if (selectedContaIds.length > 0) {
        query = query.in("conta_id", selectedContaIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !loading && !!igrejaId,
  });

  // Buscar todas as transações do período para calcular totais por conta
  const { data: allTransacoesPeriodo } = useQuery({
    queryKey: [
      "transacoes-periodo-all",
      igrejaId,
      filialId,
      isAllFiliais,
      selectedMonth,
      customRange,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("transacoes_financeiras")
        .select("conta_id, tipo, valor, status")
        .eq("igreja_id", igrejaId)
        .gte("data_vencimento", startDate)
        .lte("data_vencimento", endDate);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !loading && !!igrejaId,
  });

  // Calcular totais por conta no período
  const totaisPorConta = useMemo(() => {
    if (!allTransacoesPeriodo) return {};

    return allTransacoesPeriodo.reduce((acc, t) => {
      if (!acc[t.conta_id]) {
        acc[t.conta_id] = { entradas: 0, saidas: 0 };
      }
      if (t.tipo === "entrada") {
        acc[t.conta_id].entradas += Number(t.valor);
      } else {
        acc[t.conta_id].saidas += Number(t.valor);
      }
      return acc;
    }, {} as Record<string, { entradas: number; saidas: number }>);
  }, [allTransacoesPeriodo]);

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "bancaria":
        return <Landmark className="w-4 h-4" />;
      case "fisica":
        return <Wallet className="w-4 h-4" />;
      case "virtual":
        return <Building2 className="w-4 h-4" />;
      default:
        return <Wallet className="w-4 h-4" />;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "bancaria":
        return "Bancária";
      case "fisica":
        return "Física";
      case "virtual":
        return "Virtual";
      default:
        return tipo;
    }
  };

  const formatCurrency = (value: number) => {
    return formatValue(value);
  };

  const getStatusDisplay = (transacao: { status?: string; data_vencimento?: string | Date | null; tipo?: string }) => {
    if (transacao.status === "pago") {
      return transacao.tipo === "entrada" ? "Recebido" : "Pago";
    }
    if (transacao.status === "pendente") {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      if (transacao.data_vencimento) {
        const vencimento = new Date(transacao.data_vencimento + "T00:00:00");
        if (vencimento < hoje) {
          return "Atrasado";
        }
      }
      return "Pendente";
    }
    return transacao.status || "Pendente";
  };

  const getStatusColor = (transacao: { status?: string; data_vencimento?: string | Date | null; tipo?: string }) => {
    if (transacao.status === "pago") {
      return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
    }
    if (transacao.status === "pendente") {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      if (transacao.data_vencimento) {
        const vencimento = new Date(transacao.data_vencimento + "T00:00:00");
        if (vencimento < hoje) {
          return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
        }
      }
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400";
    }
    return "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400";
  };

  const toggleContaSelection = (contaId: string) => {
    setSelectedContaIds((prev) =>
      prev.includes(contaId)
        ? prev.filter((id) => id !== contaId)
        : [...prev, contaId]
    );
  };

  const clearSelection = () => {
    setSelectedContaIds([]);
  };

  // Filtrar transações por status
  const filterByStatus = (items: TransacaoLista[] | undefined) => {
    if (!items) return [];
    if (statusFilter === "all") return items;
    if (statusFilter === "pago") {
      return items.filter(t => t.status === "pago");
    }
    if (statusFilter === "pendente") {
      return items.filter(t => t.status === "pendente");
    }
    return items;
  };

  // Aplicar filtro de status
  const transacoesFiltradas = useMemo(() => {
    return filterByStatus(transacoes);
  }, [transacoes, statusFilter]);

  const toggleGrupo = (dataKey: string) => {
    setGruposExpandidos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dataKey)) {
        newSet.delete(dataKey);
      } else {
        newSet.add(dataKey);
      }
      return newSet;
    });
  };

  // Agrupar transações por data de vencimento
  const transacoesAgrupadas = useMemo(() => {
    if (!transacoes) return {};
    return transacoes.reduce((acc, t) => {
      const data = t.data_vencimento || "sem-data";
      if (!acc[data]) {
        acc[data] = [];
      }
      acc[data].push(t);
      return acc;
    }, {} as Record<string, typeof transacoes>);
  }, [transacoes]);

  // Ordenar datas (mais recentes primeiro)
  const datasOrdenadas = useMemo(() => {
    return Object.keys(transacoesAgrupadas).sort((a, b) => {
      if (a === "sem-data") return 1;
      if (b === "sem-data") return -1;
      return b.localeCompare(a);
    });
  }, [transacoesAgrupadas]);

  const totalEntradas =
    transacoesFiltradas
      ?.filter((t) => t.tipo === "entrada")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalSaidas =
    transacoesFiltradas
      ?.filter((t) => t.tipo === "saida")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const saldoPeriodo = totalEntradas - totalSaidas;

  type TransacaoLista = {
    id: string;
    tipo: string;
    descricao: string;
    valor: number | string;
    status?: string;
    data_vencimento?: string | Date | null;
    data_pagamento?: string | Date | null;
    contas?: { nome?: string } | null;
    categorias_financeiras?: { nome?: string } | null;
  };

  const renderTransactionList = (filteredTransacoes: TransacaoLista[]) => (
    <div className="space-y-2">
      {isLoadingTransacoes ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Carregando...
        </p>
      ) : filteredTransacoes && filteredTransacoes.length > 0 ? (
        filteredTransacoes.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              t.tipo === "entrada"
                ? "bg-green-50 dark:bg-green-950/20"
                : "bg-red-50 dark:bg-red-950/20"
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium truncate flex-1">{t.descricao}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(t.id);
                    toast.success("ID copiado!");
                  }}
                  className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors flex-shrink-0"
                  title="Copiar ID"
                >
                  {t.id.substring(0, 6)}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  {t.data_vencimento &&
                    format(
                      new Date(t.data_vencimento + "T00:00:00"),
                      "dd/MM/yyyy",
                      { locale: ptBR }
                    )}
                </p>
                {t.status && (
                  <Badge className={cn("text-xs", getStatusColor(t))}>
                    {getStatusDisplay(t)}
                  </Badge>
                )}
                {(selectedContaIds.length === 0 ||
                  selectedContaIds.length > 1) &&
                  t.contas && (
                    <Badge variant="secondary" className="text-xs">
                      {t.contas.nome}
                    </Badge>
                  )}
                {t.categorias_financeiras && (
                  <Badge variant="outline" className="text-xs">
                    {t.categorias_financeiras.nome}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right ml-2">
              <p
                className={`text-sm font-bold ${
                  t.tipo === "entrada" ? "text-green-600" : "text-red-600"
                }`}
              >
                {t.tipo === "entrada" ? "+" : "-"}{" "}
                {formatCurrency(Number(t.valor))}
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum lançamento encontrado
        </p>
      )}
    </div>
  );

  const renderTransactionListGrouped = (filteredTransacoes: TransacaoLista[]) => {
    // Agrupar transações filtradas por data de vencimento
    const gruposFiltrados = filteredTransacoes.reduce((acc, t) => {
      const data = typeof t.data_vencimento === 'string' 
        ? t.data_vencimento 
        : t.data_vencimento 
          ? t.data_vencimento.toISOString().split('T')[0] 
          : "sem-data";
      if (!acc[data]) {
        acc[data] = [];
      }
      acc[data].push(t);
      return acc;
    }, {} as Record<string, TransacaoLista[]>);

    const datasFiltradas = Object.keys(gruposFiltrados).sort((a, b) => {
      if (a === "sem-data") return 1;
      if (b === "sem-data") return -1;
      return b.localeCompare(a);
    });

    return (
      <div className="space-y-3">
        {datasFiltradas.map((dataKey) => {
          const grupo = gruposFiltrados[dataKey];
          // Calcular total 
          // Se tem apenas um tipo (entrada ou saída), mostra o valor absoluto
          // Se tem ambos, mostra o saldo líquido
          const temEntradas = grupo.some(t => t.tipo === "entrada");
          const temSaidas = grupo.some(t => t.tipo === "saida");
          
          let totalGrupo: number;
          let corTotal: string;
          let prefixo: string = "";
          
          if (temEntradas && !temSaidas) {
            // Só entradas - mostrar total positivo em verde
            totalGrupo = grupo.reduce((sum, t) => sum + Number(t.valor), 0);
            corTotal = "text-green-600";
            prefixo = "+";
          } else if (temSaidas && !temEntradas) {
            // Só saídas - mostrar total positivo em vermelho (o contexto já indica que é saída)
            totalGrupo = grupo.reduce((sum, t) => sum + Number(t.valor), 0);
            corTotal = "text-red-600";
            prefixo = "-";
          } else {
            // Misto - mostrar saldo líquido com cor apropriada
            totalGrupo = grupo.reduce(
              (sum, t) => sum + (t.tipo === "entrada" ? Number(t.valor) : -Number(t.valor)),
              0,
            );
            corTotal = totalGrupo >= 0 ? "text-green-600" : "text-red-600";
            prefixo = totalGrupo >= 0 ? "+" : "";
          }
          
          const isExpandido = gruposExpandidos.has(dataKey);

          return (
            <div
              key={dataKey}
              className="border rounded-lg overflow-hidden"
            >
              {/* Header do grupo */}
              <button
                onClick={() => toggleGrupo(dataKey)}
                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpandido ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div className="text-left">
                    <div className="font-semibold text-sm">
                      {dataKey === "sem-data"
                        ? "Sem data"
                        : format(
                            new Date(dataKey + "T00:00:00"),
                            "dd 'de' MMMM 'de' yyyy",
                            { locale: ptBR },
                          )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {grupo.length}{" "}
                      {grupo.length === 1 ? "transação" : "transações"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-base font-bold", corTotal)}>
                    {prefixo}{formatCurrency(Math.abs(totalGrupo))}
                  </div>
                </div>
              </button>

              {/* Lista de transações do grupo */}
              {isExpandido && (
                <div className="divide-y">
                  {grupo.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center justify-between p-3",
                        t.tipo === "entrada"
                          ? "bg-green-50/50 dark:bg-green-950/10"
                          : "bg-red-50/50 dark:bg-red-950/10"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate flex-1">
                            {t.descricao}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(t.id);
                              toast.success("ID copiado!");
                            }}
                            className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors flex-shrink-0"
                            title="Copiar ID"
                          >
                            {t.id.substring(0, 6)}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {t.status && (
                            <Badge className={cn("text-xs", getStatusColor(t))}>
                              {getStatusDisplay(t)}
                            </Badge>
                          )}
                          {(selectedContaIds.length === 0 ||
                            selectedContaIds.length > 1) &&
                            t.contas && (
                              <Badge variant="secondary" className="text-xs">
                                {t.contas.nome}
                              </Badge>
                            )}
                          {t.categorias_financeiras && (
                            <Badge variant="outline" className="text-xs">
                              {t.categorias_financeiras.nome}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <p
                          className={`text-sm font-bold ${
                            t.tipo === "entrada"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {t.tipo === "entrada" ? "+" : "-"}{" "}
                          {formatCurrency(Number(t.valor))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
        {/* Lado Esquerdo: Voltar + Título + HideValues */}
        <div className="flex items-center justify-between gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/financas")}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Contas
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-0.5">
                Gerencie contas bancárias e caixas
              </p>
            </div>
          </div>
          <HideValuesToggle />
        </div>

        {/* Lado Direito: Botões */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={() => setTransferenciaDialogOpen(true)}
            size="sm"
            className="flex-1 md:flex-none"
          >
            <ArrowRightLeft className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline text-xs">Transferir</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/financas/transferencias")}
            size="sm"
            className="flex-1 md:flex-none"
          >
            <List className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline text-xs">Histórico</span>
          </Button>
          <Button
            className="bg-gradient-primary shadow-soft whitespace-nowrap flex-1 md:flex-none"
            onClick={() => {
              setSelectedConta(null);
              setContaDialogOpen(true);
            }}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline text-xs">Nova Conta</span>
            <span className="sm:hidden text-xs">Nova</span>
          </Button>
        </div>
      </div>

      {/* Filtro de Período Global */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="gap-1.5">
          <Calendar className="w-3 h-3" />
          {customRange
            ? `${format(customRange.from, "dd/MM/yyyy")} - ${format(
                customRange.to,
                "dd/MM/yyyy"
              )}`
            : format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </Badge>
        <MonthPicker
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
        />
      </div>

      {/* Cards de Contas */}
      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Carregando contas...
            </p>
          </CardContent>
        </Card>
      ) : contas && contas.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contas.map((conta) => {
            const isSelected = selectedContaIds.includes(conta.id);
            const contaTotais = totaisPorConta[conta.id] || {
              entradas: 0,
              saidas: 0,
            };
            const saldoContaPeriodo = contaTotais.entradas - contaTotais.saidas;

            return (
              <Card
                key={conta.id}
                className={cn(
                  "shadow-soft cursor-pointer transition-all hover:shadow-md relative",
                  isSelected && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => toggleContaSelection(conta.id)}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getTipoIcon(conta.tipo)}
                      <span className="text-sm font-medium truncate">
                        {conta.nome}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Botão de teste de conexão - só aparece se tiver integração */}
                      {hasIntegration((conta as { cnpj_banco?: string | null }).cnpj_banco) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestConnection(conta as {
                              id: string;
                              cnpj_banco?: string | null;
                              agencia?: string | null;
                              conta_numero?: string | null;
                            });
                          }}
                          disabled={testingContaId === conta.id}
                          title="Testar conexão bancária"
                        >
                          {testingContaId === conta.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <TestTube2 className="w-3.5 h-3.5 text-blue-500" />
                          )}
                        </Button>
                        )}
                        {/* Botão Ver Extrato */}
                        {hasIntegration((conta as { cnpj_banco?: string | null }).cnpj_banco) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              const santanderIntegracao = integracoes?.find(
                                (i) => i.provedor === "santander" && i.status === "ativo"
                              );
                              if (santanderIntegracao) {
                                setExtratoContaData({
                                  id: conta.id,
                                  nome: conta.nome,
                                  integracaoId: santanderIntegracao.id,
                                  agencia: (conta as { agencia?: string }).agencia,
                                  contaNumero: (conta as { conta_numero?: string }).conta_numero,
                                  cnpjBanco: (conta as { cnpj_banco?: string }).cnpj_banco,
                                });
                                setExtratoDialogOpen(true);
                              }
                            }}
                            title="Ver extrato bancário"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedConta(conta);
                            setAjusteSaldoDialogOpen(true);
                          }}
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConta(conta);
                          setContaDialogOpen(true);
                        }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Saldo Atual
                        </p>
                        <p
                          className={cn(
                            "text-lg font-bold",
                            conta.saldo_atual >= 0
                              ? "text-foreground"
                              : "text-destructive"
                          )}
                        >
                          {formatCurrency(conta.saldo_atual)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {getTipoLabel(conta.tipo)}
                      </Badge>
                    </div>

                    {/* Totais do período */}
                    <div className="grid grid-cols-3 gap-1 pt-2 border-t">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">
                          Entradas
                        </p>
                        <p className="text-xs font-semibold text-green-600">
                          {formatCurrency(contaTotais.entradas)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">
                          Saídas
                        </p>
                        <p className="text-xs font-semibold text-red-600">
                          {formatCurrency(contaTotais.saidas)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">
                          Saldo
                        </p>
                        <p
                          className={cn(
                            "text-xs font-semibold",
                            saldoContaPeriodo >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          )}
                        >
                          {formatCurrency(saldoContaPeriodo)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {conta.banco && (
                    <p className="text-xs text-muted-foreground mt-2 truncate">
                      {conta.banco} {conta.agencia && `| Ag: ${conta.agencia}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Nenhuma conta cadastrada
            </p>
          </CardContent>
        </Card>
      )}

      {/* Seção de Lançamentos */}
      <Card className="shadow-soft">
        <CardContent className="p-4 md:p-6">
          {/* Header com filtros ativos */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Lançamentos</h2>
              {selectedContaIds.length > 0 && (
                <>
                  <Badge variant="secondary" className="text-xs">
                    {selectedContaIds.length} conta
                    {selectedContaIds.length > 1 ? "s" : ""} selecionada
                    {selectedContaIds.length > 1 ? "s" : ""}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={clearSelection}
                  >
                    Limpar
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Totalizador */}
          {transacoes && transacoes.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Entradas</p>
                <p className="text-sm font-bold text-green-600">
                  {formatCurrency(totalEntradas)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Saídas</p>
                <p className="text-sm font-bold text-red-600">
                  {formatCurrency(totalSaidas)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                <p
                  className={cn(
                    "text-sm font-bold",
                    saldoPeriodo >= 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {formatCurrency(saldoPeriodo)}
                </p>
              </div>
            </div>
          )}

          {/* Botão de Agrupamento, Filtro de Status e Tabs */}
          <Tabs defaultValue="todos" className="w-full">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
              <TabsList className="grid w-full grid-cols-3 flex-1 md:w-auto">
                <TabsTrigger value="todos" className="text-xs">
                  <List className="w-3 h-3 mr-1" />
                  Todos
                </TabsTrigger>
                <TabsTrigger value="entradas" className="text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Entradas
                </TabsTrigger>
                <TabsTrigger value="saidas" className="text-xs">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  Saídas
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(value: "all" | "pago" | "pendente") => setStatusFilter(value)}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pago">✅ Pago</SelectItem>
                    <SelectItem value="pendente">⏳ Pendente</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAgruparPorData(!agruparPorData);
                    if (!agruparPorData) {
                      setGruposExpandidos(
                        new Set(Object.keys(transacoesAgrupadas)),
                      );
                    }
                  }}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {agruparPorData ? "Visão Lista" : "Agrupar por Data"}
                </Button>
              </div>
            </div>

            <TabsContent
              value="todos"
              className="max-h-[500px] overflow-y-auto"
            >
              {agruparPorData
                ? renderTransactionListGrouped(transacoesFiltradas || [])
                : renderTransactionList(transacoesFiltradas || [])}
            </TabsContent>

            <TabsContent
              value="entradas"
              className="max-h-[500px] overflow-y-auto"
            >
              {agruparPorData
                ? renderTransactionListGrouped(
                    transacoesFiltradas?.filter((t) => t.tipo === "entrada") || []
                  )
                : renderTransactionList(
                    transacoesFiltradas?.filter((t) => t.tipo === "entrada") || []
                  )}
            </TabsContent>

            <TabsContent
              value="saidas"
              className="max-h-[500px] overflow-y-auto"
            >
              {agruparPorData
                ? renderTransactionListGrouped(
                    transacoesFiltradas?.filter((t) => t.tipo === "saida") || []
                  )
                : renderTransactionList(
                    transacoesFiltradas?.filter((t) => t.tipo === "saida") || []
                  )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ContaDialog
        open={contaDialogOpen}
        onOpenChange={setContaDialogOpen}
        conta={
          selectedConta as
            | {
                id: string;
                nome: string;
                tipo: "bancaria" | "fisica" | "virtual";
                saldo_inicial?: number;
                banco?: string;
                agencia?: string;
                conta_numero?: string;
                observacoes?: string;
              }
            | undefined
        }
      />

      <AjusteSaldoDialog
        open={ajusteSaldoDialogOpen}
        onOpenChange={setAjusteSaldoDialogOpen}
        conta={selectedConta}
      />

      {extratoContaData && (
        <ExtratoPreviewDialog
          open={extratoDialogOpen}
          onOpenChange={setExtratoDialogOpen}
          contaId={extratoContaData.id}
          contaNome={extratoContaData.nome}
          integracaoId={extratoContaData.integracaoId}
          agencia={extratoContaData.agencia}
          contaNumero={extratoContaData.contaNumero}
          cnpjBanco={extratoContaData.cnpjBanco}
        />
      )}

      <TransferenciaDialog
        open={transferenciaDialogOpen}
        onOpenChange={setTransferenciaDialogOpen}
      />
    </div>
  );
}
