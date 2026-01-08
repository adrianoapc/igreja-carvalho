import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  FolderTree,
  UserCog,
  ArrowRight,
  BarChart3,
  PieChart,
  LineChart,
  TrendingUpIcon,
  FileSpreadsheet,
  FileText,
  Receipt,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHideValues } from "@/hooks/useHideValues";
import { HideValuesToggle } from "@/components/financas/HideValuesToggle";
import { useFilialId } from "@/hooks/useFilialId";

export default function Financas() {
  const navigate = useNavigate();
  const { formatValue } = useHideValues();
  const { igrejaId, filialId, isAllFiliais, loading: filialLoading } = useFilialId();

  const { data: contas } = useQuery({
    queryKey: ["contas-resumo", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase.from("contas").select("saldo_atual").eq("ativo", true).eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId && !filialLoading,
  });

  // Calcular entradas e saídas do mês atual
  const { data: transacoesEntrada } = useQuery({
    queryKey: ["entradas-mes-atual", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      let query = supabase
        .from("transacoes_financeiras")
        .select("valor")
        .eq("tipo", "entrada")
        .eq("status", "pago")
        .gte("data_pagamento", firstDay.toISOString().split("T")[0])
        .lte("data_pagamento", lastDay.toISOString().split("T")[0])
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId && !filialLoading,
  });

  const { data: transacoesSaida } = useQuery({
    queryKey: ["saidas-mes-atual", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      let query = supabase
        .from("transacoes_financeiras")
        .select("valor")
        .eq("tipo", "saida")
        .eq("status", "pago")
        .gte("data_pagamento", firstDay.toISOString().split("T")[0])
        .lte("data_pagamento", lastDay.toISOString().split("T")[0])
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId && !filialLoading,
  });

  const { data: categorias } = useQuery({
    queryKey: ["categorias-count", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase.from("categorias_financeiras").select("id").eq("ativo", true).eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId && !filialLoading,
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-count", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase.from("fornecedores").select("id").eq("ativo", true).eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId && !filialLoading,
  });

  const totalEmCaixa = contas?.reduce((sum, conta) => sum + Number(conta.saldo_atual), 0) || 0;
  const totalEntradasMes = transacoesEntrada?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalSaidasMes = transacoesSaida?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;

  // Contas a pagar da semana (saídas pendentes até +7 dias)
  const { data: contasSemana = [] } = useQuery({
    queryKey: ["contas-semana", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setDate(end.getDate() + 7);

      let query = supabase
        .from("transacoes_financeiras")
        .select("id, valor, data_vencimento")
        .eq("tipo", "saida")
        .eq("status", "pendente")
        .eq("igreja_id", igrejaId)
        .lte("data_vencimento", end.toISOString().split("T")[0]);

      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!igrejaId && !filialLoading,
  });

  const contasSemanaTotal = contasSemana.reduce((sum, c) => sum + Number(c.valor || 0), 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const contasVencidas = contasSemana.filter((c) => new Date(c.data_vencimento) < hoje);

  // Query para reembolsos pendentes
  const { data: reembolsosPendentes } = useQuery({
    queryKey: ["reembolsos-pendentes", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      
      let query = supabase
        .from("solicitacoes_reembolso")
        .select("id")
        .eq("status", "pendente")
        .eq("igreja_id", igrejaId);
      
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId && !filialLoading,
  });

  const formatCurrency = (value: number) => {
    return formatValue(value);
  };

  const modules = [
    {
      title: "Contas a Pagar",
      description: "Vencidas e próximas da semana",
      icon: TrendingDown,
      path: "/financas/saidas?status=pendente&range=semana",
      stats: [{ label: "Saídas mês", value: formatCurrency(totalSaidasMes), color: "text-red-600" }],
      color: "bg-red-100 dark:bg-red-900/20",
      iconColor: "text-red-600",
    },
  ];

  const configModules = [
    {
      title: "Bases Ministeriais",
      description: "Áreas de atuação da igreja",
      icon: Target,
      path: "/financas/bases-ministeriais",
      color: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-600",
    },
    {
      title: "Centros de Custo",
      description: "Departamentos e projetos",
      icon: Target,
      path: "/financas/centros-custo",
      color: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600",
    },
    {
      title: "Plano de Contas",
      description: "Classificação de transações",
      icon: FolderTree,
      path: "/financas/categorias",
      stats: [{ label: "Total", value: categorias?.length || 0, color: "text-accent-foreground" }],
      color: "bg-accent/10",
      iconColor: "text-accent-foreground",
    },
    {
      title: "Fornecedores",
      description: "Cadastro de fornecedores e beneficiários",
      icon: UserCog,
      path: "/financas/fornecedores",
      stats: [{ label: "Ativos", value: fornecedores?.length || 0, color: "text-orange-600" }],
      color: "bg-orange-100 dark:bg-orange-900/20",
      iconColor: "text-orange-600",
    },
    {
      title: "Formas de Pagamento",
      description: "Métodos de pagamento disponíveis",
      icon: DollarSign,
      path: "/financas/formas-pagamento",
      color: "bg-teal-100 dark:bg-teal-900/20",
      iconColor: "text-teal-600",
    },
  ];

  const paineis = [
    {
      title: "Dashboard Geral",
      description: "Visão completa das finanças com análises e indicadores",
      icon: BarChart3,
      path: "/financas/dashboard",
      color: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-600",
      destacado: true,
    },
    {
      title: "Dashboard de Ofertas",
      description: "Análises detalhadas das ofertas e contribuições",
      icon: PieChart,
      path: "/financas/dashboard-ofertas",
      color: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600",
      destacado: true,
    },
    {
      title: "DRE Gerencial",
      description: "Demonstrativo de Resultado do Exercício anual",
      icon: FileSpreadsheet,
      path: "/financas/dre",
      color: "bg-amber-100 dark:bg-amber-900/20",
      iconColor: "text-amber-600",
      destacado: true,
    },
    {
      title: "Projeção Financeira",
      description: "Previsões e planejamento financeiro futuro",
      icon: LineChart,
      path: "/financas/projecao",
      color: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600",
      destacado: false,
    },
    {
      title: "Insights",
      description: "Análises avançadas e recomendações inteligentes",
      icon: TrendingUpIcon,
      path: "/financas/insights",
      color: "bg-orange-100 dark:bg-orange-900/20",
      iconColor: "text-orange-600",
      destacado: false,
    },
  ];

  const [showConfigs, setShowConfigs] = useState(true);

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 p-2 sm:p-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Finanças</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Gestão completa do módulo financeiro</p>
        </div>
        <HideValuesToggle />
      </div>

      {/* Hero Section - Visão Geral Financeira */}
      <Card className="shadow-lg bg-gradient-to-br from-primary/5 via-background to-primary/10 border-primary/20">
        <CardContent className="p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-[2fr_1fr_1fr]">
            {/* Total em Caixa - Destaque Principal */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Total em Caixa</p>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                {formatCurrency(totalEmCaixa)}
              </p>
              <p className="text-xs text-muted-foreground">Saldo consolidado de todas as contas</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/financas/contas")}> 
                Ver contas
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Entradas do Mês */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Entradas</p>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-green-600">
                {formatCurrency(totalEntradasMes)}
              </p>
              <p className="text-xs text-muted-foreground">Este mês</p>
              <Button size="sm" variant="ghost" onClick={() => navigate("/financas/entradas")}>
                Ver entradas
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Saídas do Mês */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Saídas</p>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-red-600">
                {formatCurrency(totalSaidasMes)}
              </p>
              <p className="text-xs text-muted-foreground">Este mês</p>
              <Button size="sm" variant="ghost" onClick={() => navigate("/financas/saidas")}>
                Ver saídas
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações Rápidas */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card
            className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 border-amber-200 dark:border-amber-800"
            onClick={() => navigate("/financas/relatorio-ofertas")}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex-shrink-0">
                  <FileText className="w-6 h-6 text-amber-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
              <h3 className="font-semibold text-base mb-1">Relatório de Ofertas</h3>
              <p className="text-xs text-muted-foreground">
                Registre e envie relatórios para conferência
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 border-blue-200 dark:border-blue-800"
            onClick={() => navigate("/financas/reembolsos")}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex-shrink-0">
                  <Receipt className="w-6 h-6 text-blue-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
              <h3 className="font-semibold text-base mb-1">Reembolsos</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Confira e aprove solicitações pendentes
              </p>
              {reembolsosPendentes && reembolsosPendentes.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {reembolsosPendentes.length} pendente{reembolsosPendentes.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 border-purple-200 dark:border-purple-800"
            onClick={() => navigate("/financas/importar")}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex-shrink-0">
                  <Upload className="w-6 h-6 text-purple-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
              <h3 className="font-semibold text-base mb-1">Importar Transações</h3>
              <p className="text-xs text-muted-foreground">
                Importe entradas e saídas via planilha
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 border-emerald-200 dark:border-emerald-800"
            onClick={() => navigate("/financas/reconciliacao")}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex-shrink-0">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
              <h3 className="font-semibold text-base mb-1">Reconciliação</h3>
              <p className="text-xs text-muted-foreground">
                Acesse a conciliação bancária
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 border-slate-200 dark:border-slate-800"
            onClick={() => navigate("/financas/reclassificacao")}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/20 flex-shrink-0">
                  <FileSpreadsheet className="w-6 h-6 text-slate-700" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
              <h3 className="font-semibold text-base mb-1">Reclassificação</h3>
              <p className="text-xs text-muted-foreground">
                Reclassifique lançamentos rapidamente
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Financeiro Operacional */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-4">Financeiro Operacional</h2>
        <Card
          className={`shadow-soft border ${contasVencidas.length ? "border-destructive/40 bg-destructive/5" : ""}`}
        >
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/20 h-fit">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contas a pagar</p>
                  <p className="text-lg font-bold">{formatCurrency(contasSemanaTotal)}</p>
                  <p className="text-xs text-muted-foreground">
                    {contasSemana.length} vencem nesta semana
                  </p>
                  {contasVencidas.length > 0 && (
                    <p className="text-xs text-destructive mt-1">
                      {contasVencidas.length} vencida{contasVencidas.length !== 1 ? "s" : ""}. Priorize hoje.
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/financas/saidas?status=pendente&range=semana")}> 
                Ver detalhes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configurações e Cadastros */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-semibold">Configurações e Cadastros</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowConfigs((prev) => !prev)}>
            {showConfigs ? "Ocultar" : "Mostrar"}
          </Button>
        </div>
        {showConfigs && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {configModules.map((module) => {
              const Icon = module.icon;
              return (
                <Card
                  key={module.path}
                  className="cursor-pointer transition-all hover:shadow-md hover:scale-105"
                  onClick={() => navigate(module.path)}
                >
                  <CardContent className="p-4">
                    <div className={`p-3 rounded-lg ${module.color} w-fit mb-3`}>
                      <Icon className={`w-6 h-6 ${module.iconColor}`} />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{module.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{module.description}</p>
                    {module.stats && (
                      <div className="flex flex-wrap gap-2">
                        {module.stats.map((stat) => (
                          <div key={stat.label} className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">{stat.label}:</span>
                            <Badge variant="outline" className={`text-xs ${stat.color}`}>
                              {stat.value}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Painéis e Análises */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-4">Painéis e Análises</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paineis.map((painel) => {
            const Icon = painel.icon;
            return (
              <Card
                key={painel.path}
                className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
                  painel.destacado ? "border-2 border-primary/20" : ""
                }`}
                onClick={() => navigate(painel.path)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`p-4 rounded-lg ${painel.color}`}>
                      <Icon className={`w-8 h-8 ${painel.iconColor}`} />
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground ml-auto" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{painel.title}</h3>
                  <p className="text-sm text-muted-foreground">{painel.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
