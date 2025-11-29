import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, Building2, Target, FolderTree, UserCog, ArrowRight, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Financas() {
  const navigate = useNavigate();

  const { data: contas } = useQuery({
    queryKey: ['contas-resumo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas')
        .select('saldo_atual')
        .eq('ativo', true);
      
      if (error) throw error;
      return data;
    },
  });

  // Calcular entradas e saídas do mês atual
  const { data: transacoesEntrada } = useQuery({
    queryKey: ['entradas-mes-atual'],
    queryFn: async () => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select('valor')
        .eq('tipo', 'entrada')
        .eq('status', 'pago')
        .gte('data_pagamento', firstDay.toISOString().split('T')[0])
        .lte('data_pagamento', lastDay.toISOString().split('T')[0]);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: transacoesSaida } = useQuery({
    queryKey: ['saidas-mes-atual'],
    queryFn: async () => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select('valor')
        .eq('tipo', 'saida')
        .eq('status', 'pago')
        .gte('data_pagamento', firstDay.toISOString().split('T')[0])
        .lte('data_pagamento', lastDay.toISOString().split('T')[0]);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('id')
        .eq('ativo', true);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('id')
        .eq('ativo', true);
      
      if (error) throw error;
      return data;
    },
  });

  const totalEmCaixa = contas?.reduce((sum, conta) => sum + Number(conta.saldo_atual), 0) || 0;
  const totalEntradasMes = transacoesEntrada?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalSaidasMes = transacoesSaida?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const modules = [
    {
      title: "Entradas",
      description: "Gerencie receitas e dízimos",
      icon: TrendingUp,
      path: "/financas/entradas",
      stats: [
        { label: "Este mês", value: formatCurrency(totalEntradasMes), color: "text-green-600" },
      ],
      color: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600",
    },
    {
      title: "Saídas",
      description: "Controle despesas e pagamentos",
      icon: TrendingDown,
      path: "/financas/saidas",
      stats: [
        { label: "Este mês", value: formatCurrency(totalSaidasMes), color: "text-red-600" },
      ],
      color: "bg-red-100 dark:bg-red-900/20",
      iconColor: "text-red-600",
    },
    {
      title: "Contas",
      description: "Gestão de contas bancárias",
      icon: Building2,
      path: "/financas/contas",
      stats: [
        { label: "Total", value: formatCurrency(totalEmCaixa), color: "text-primary" },
      ],
      color: "bg-primary/10",
      iconColor: "text-primary",
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
      title: "Categorias",
      description: "Classificação de transações",
      icon: FolderTree,
      path: "/financas/categorias",
      stats: [
        { label: "Total", value: categorias?.length || 0, color: "text-accent-foreground" },
      ],
      color: "bg-accent/10",
      iconColor: "text-accent-foreground",
    },
    {
      title: "Fornecedores",
      description: "Cadastro de fornecedores e beneficiários",
      icon: UserCog,
      path: "/financas/fornecedores",
      stats: [
        { label: "Ativos", value: fornecedores?.length || 0, color: "text-orange-600" },
      ],
      color: "bg-orange-100 dark:bg-orange-900/20",
      iconColor: "text-orange-600",
    },
  ];

  const quickActions = [
    {
      title: "Nova Entrada",
      description: "Registrar receita",
      icon: Plus,
      action: () => navigate("/financas/entradas"),
    },
    {
      title: "Nova Saída",
      description: "Registrar despesa",
      icon: Plus,
      action: () => navigate("/financas/saidas"),
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Finanças</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Gestão completa do módulo financeiro
        </p>
      </div>

      {/* Card de Total em Caixa */}
      <Card className="shadow-soft">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total em Caixa</p>
              <p className="text-3xl md:text-4xl font-bold text-foreground">{formatCurrency(totalEmCaixa)}</p>
            </div>
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-primary-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Módulos Principais */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-3">Transações</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Card
                key={module.path}
                className="cursor-pointer transition-all hover:shadow-md hover:scale-105"
                onClick={() => navigate(module.path)}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className={`p-3 rounded-lg ${module.color} flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${module.iconColor}`} />
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </div>
                  <h3 className="font-semibold text-base md:text-lg mb-1">{module.title}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground mb-3">
                    {module.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {module.stats.map((stat) => (
                      <div key={stat.label} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{stat.label}:</span>
                        <Badge variant="outline" className={`text-xs ${stat.color}`}>
                          {stat.value}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Configurações */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-3">Configurações</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
                  <p className="text-xs text-muted-foreground mb-2">
                    {module.description}
                  </p>
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
      </div>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.title}
                  variant="outline"
                  className="h-auto p-4 flex items-start gap-3 text-left"
                  onClick={action.action}
                >
                  <div className="p-2 rounded bg-primary/10 flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{action.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {action.description}
                    </p>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
