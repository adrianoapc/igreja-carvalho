import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Building2, Landmark, Wallet, Edit, Settings, TrendingUp, TrendingDown, List } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { ContaDialog } from "@/components/financas/ContaDialog";
import { AjusteSaldoDialog } from "@/components/financas/AjusteSaldoDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MonthPicker } from "@/components/financas/MonthPicker";

export default function Contas() {
  const navigate = useNavigate();
  const [contaDialogOpen, setContaDialogOpen] = useState(false);
  const [ajusteSaldoDialogOpen, setAjusteSaldoDialogOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<any>(null);
  const [selectedContaId, setSelectedContaId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);

  const { data: contas, isLoading } = useQuery({
    queryKey: ['contas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: transacoes, isLoading: isLoadingTransacoes } = useQuery({
    queryKey: ['transacoes-contas', selectedContaId, selectedMonth, customRange],
    queryFn: async () => {
      const startDate = customRange 
        ? format(customRange.from, 'yyyy-MM-dd')
        : format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = customRange 
        ? format(customRange.to, 'yyyy-MM-dd')
        : format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      let query = supabase
        .from('transacoes_financeiras')
        .select(`
          *,
          categorias_financeiras(nome, cor),
          fornecedores(nome),
          contas(nome)
        `)
        .eq('status', 'pago')
        .gte('data_pagamento', startDate)
        .lte('data_pagamento', endDate)
        .order('data_pagamento', { ascending: false });
      
      if (selectedContaId) {
        query = query.eq('conta_id', selectedContaId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'bancaria': return <Landmark className="w-4 h-4" />;
      case 'fisica': return <Wallet className="w-4 h-4" />;
      case 'virtual': return <Building2 className="w-4 h-4" />;
      default: return <Wallet className="w-4 h-4" />;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'bancaria': return 'Bancária';
      case 'fisica': return 'Física';
      case 'virtual': return 'Virtual';
      default: return tipo;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalEntradas = transacoes?.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalSaidas = transacoes?.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const saldoPeriodo = totalEntradas - totalSaidas;

  const renderTransactionList = (filteredTransacoes: any[]) => (
    <div className="space-y-2">
      {isLoadingTransacoes ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : filteredTransacoes && filteredTransacoes.length > 0 ? (
        filteredTransacoes.map((t) => (
          <div 
            key={t.id} 
            className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              t.tipo === 'entrada' ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t.descricao}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  {t.data_pagamento && format(new Date(t.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                </p>
                {!selectedContaId && t.contas && (
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
              <p className={`text-sm font-bold ${t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                {t.tipo === 'entrada' ? '+' : '-'} {formatCurrency(Number(t.valor))}
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum lançamento encontrado</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/financas')}
          className="w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Contas</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie contas bancárias e caixas</p>
          </div>
          <Button 
            className="bg-gradient-primary shadow-soft"
            onClick={() => {
              setSelectedConta(null);
              setContaDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Conta</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      {/* Cards de Contas */}
      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Carregando contas...</p>
          </CardContent>
        </Card>
      ) : contas && contas.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contas.map((conta) => (
            <Card 
              key={conta.id} 
              className={cn(
                "shadow-soft cursor-pointer transition-all hover:shadow-md",
                selectedContaId === conta.id && "ring-2 ring-primary"
              )}
              onClick={() => setSelectedContaId(selectedContaId === conta.id ? null : conta.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {getTipoIcon(conta.tipo)}
                    <span className="text-sm font-medium truncate">{conta.nome}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo Atual</p>
                    <p className={cn(
                      "text-lg font-bold",
                      conta.saldo_atual >= 0 ? "text-foreground" : "text-destructive"
                    )}>
                      {formatCurrency(conta.saldo_atual)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getTipoLabel(conta.tipo)}
                  </Badge>
                </div>

                {conta.banco && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    {conta.banco} {conta.agencia && `| Ag: ${conta.agencia}`}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Nenhuma conta cadastrada</p>
          </CardContent>
        </Card>
      )}

      {/* Seção de Lançamentos */}
      <Card className="shadow-soft">
        <CardContent className="p-4 md:p-6">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Lançamentos</h2>
              {selectedContaId && (
                <Badge variant="secondary" className="text-xs">
                  {contas?.find(c => c.id === selectedContaId)?.nome}
                  <button 
                    className="ml-1 hover:text-destructive"
                    onClick={() => setSelectedContaId(null)}
                  >
                    ×
                  </button>
                </Badge>
              )}
            </div>
            <MonthPicker
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
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
                <p className={cn(
                  "text-sm font-bold",
                  saldoPeriodo >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(saldoPeriodo)}
                </p>
              </div>
            </div>
          )}

          {/* Tabs de Lançamentos */}
          <Tabs defaultValue="todos" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
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

            <TabsContent value="todos" className="max-h-[500px] overflow-y-auto">
              {renderTransactionList(transacoes || [])}
            </TabsContent>

            <TabsContent value="entradas" className="max-h-[500px] overflow-y-auto">
              {renderTransactionList(transacoes?.filter(t => t.tipo === 'entrada') || [])}
            </TabsContent>

            <TabsContent value="saidas" className="max-h-[500px] overflow-y-auto">
              {renderTransactionList(transacoes?.filter(t => t.tipo === 'saida') || [])}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ContaDialog 
        open={contaDialogOpen}
        onOpenChange={setContaDialogOpen}
        conta={selectedConta}
      />

      <AjusteSaldoDialog
        open={ajusteSaldoDialogOpen}
        onOpenChange={setAjusteSaldoDialogOpen}
        conta={selectedConta}
      />
    </div>
  );
}
