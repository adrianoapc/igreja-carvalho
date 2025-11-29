import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown, DollarSign, Building2, Target, FolderTree, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function FinancasGeral() {
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

  const totalEmCaixa = contas?.reduce((sum, conta) => sum + Number(conta.saldo_atual), 0) || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Finanças - Geral</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Visão geral do módulo financeiro</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto"
            onClick={() => navigate('/financas/saidas')}
          >
            <TrendingDown className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Saída</span>
            <span className="sm:hidden">Saída</span>
          </Button>
          <Button 
            className="bg-gradient-primary shadow-soft w-full sm:w-auto"
            onClick={() => navigate('/financas/entradas')}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Entrada</span>
            <span className="sm:hidden">Entrada</span>
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total em Caixa
            </CardTitle>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl md:text-3xl font-bold text-foreground">{formatCurrency(totalEmCaixa)}</div>
            <p className="text-xs text-muted-foreground mt-1">Saldo atual</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Entradas do Mês
            </CardTitle>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-700 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl md:text-3xl font-bold text-foreground">R$ 0,00</div>
            <p className="text-xs text-green-700 dark:text-green-400 mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Saídas do Mês
            </CardTitle>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-700 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl md:text-3xl font-bold text-foreground">R$ 0,00</div>
            <p className="text-xs text-red-700 dark:text-red-400 mt-1">Este mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button 
              variant="outline" 
              className="h-auto flex-col gap-2 p-4"
              onClick={() => navigate('/financas/contas')}
            >
              <Building2 className="w-8 h-8" />
              <span className="text-sm">Contas</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto flex-col gap-2 p-4"
              onClick={() => navigate('/financas/bases-ministeriais')}
            >
              <Target className="w-8 h-8" />
              <span className="text-sm">Bases Ministeriais</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto flex-col gap-2 p-4"
              onClick={() => navigate('/financas/categorias')}
            >
              <FolderTree className="w-8 h-8" />
              <span className="text-sm">Categorias</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto flex-col gap-2 p-4"
              onClick={() => navigate('/financas/fornecedores')}
            >
              <Users className="w-8 h-8" />
              <span className="text-sm">Fornecedores</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
