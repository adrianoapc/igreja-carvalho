import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Building2, Landmark, Wallet, Edit, Settings, ChevronDown, ChevronUp, TrendingUp, TrendingDown, List } from "lucide-react";
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
  const [expandedContaId, setExpandedContaId] = useState<string | null>(null);
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
    queryKey: ['transacoes-conta', expandedContaId, selectedMonth, customRange],
    enabled: !!expandedContaId,
    queryFn: async () => {
      if (!expandedContaId) return [];
      
      const startDate = customRange 
        ? format(customRange.from, 'yyyy-MM-dd')
        : format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = customRange 
        ? format(customRange.to, 'yyyy-MM-dd')
        : format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select(`
          *,
          categorias_financeiras(nome, cor),
          fornecedores(nome)
        `)
        .eq('conta_id', expandedContaId)
        .eq('status', 'pago')
        .gte('data_pagamento', startDate)
        .lte('data_pagamento', endDate)
        .order('data_pagamento', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'bancaria': return <Landmark className="w-5 h-5" />;
      case 'fisica': return <Wallet className="w-5 h-5" />;
      case 'virtual': return <Building2 className="w-5 h-5" />;
      default: return <Wallet className="w-5 h-5" />;
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

  const toggleExpanded = (contaId: string) => {
    setExpandedContaId(expandedContaId === contaId ? null : contaId);
  };

  return (
    <div className="space-y-4 md:space-y-6">
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

      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Carregando contas...</p>
          </CardContent>
        </Card>
      ) : contas && contas.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {contas.map((conta) => (
            <Card key={conta.id} className="shadow-soft">
              <CardHeader className="p-4 md:p-6 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    {getTipoIcon(conta.tipo)}
                    <CardTitle className="text-base md:text-lg">{conta.nome}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {getTipoLabel(conta.tipo)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedConta(conta);
                        setAjusteSaldoDialogOpen(true);
                      }}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedConta(conta);
                        setContaDialogOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(conta.id)}
                    >
                      {expandedContaId === conta.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Saldo Atual</p>
                      <p className="text-xl md:text-2xl font-bold text-foreground">
                        {formatCurrency(conta.saldo_atual)}
                      </p>
                    </div>
                    {conta.banco && (
                      <div className="text-xs text-muted-foreground text-right">
                        <p>{conta.banco}</p>
                        {conta.agencia && conta.conta_numero && (
                          <p>Ag: {conta.agencia} | CC: {conta.conta_numero}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {expandedContaId === conta.id && (
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold">Lançamentos</h3>
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
                              {formatCurrency(
                                transacoes
                                  .filter(t => t.tipo === 'entrada')
                                  .reduce((sum, t) => sum + Number(t.valor), 0)
                              )}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">Saídas</p>
                            <p className="text-sm font-bold text-red-600">
                              {formatCurrency(
                                transacoes
                                  .filter(t => t.tipo === 'saida')
                                  .reduce((sum, t) => sum + Number(t.valor), 0)
                              )}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                            <p className={cn(
                              "text-sm font-bold",
                              (transacoes.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + Number(t.valor), 0) -
                               transacoes.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + Number(t.valor), 0)) >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            )}>
                              {formatCurrency(
                                transacoes
                                  .filter(t => t.tipo === 'entrada')
                                  .reduce((sum, t) => sum + Number(t.valor), 0) -
                                transacoes
                                  .filter(t => t.tipo === 'saida')
                                  .reduce((sum, t) => sum + Number(t.valor), 0)
                              )}
                            </p>
                          </div>
                        </div>
                      )}

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

                        <TabsContent value="todos" className="space-y-2 max-h-96 overflow-y-auto">
                          {isLoadingTransacoes ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
                          ) : transacoes && transacoes.length > 0 ? (
                            transacoes.map((t) => (
                              <div key={t.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{t.descricao}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-muted-foreground">
                                      {t.data_pagamento && format(new Date(t.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                                    </p>
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
                        </TabsContent>

                        <TabsContent value="entradas" className="space-y-2 max-h-96 overflow-y-auto">
                          {isLoadingTransacoes ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
                          ) : transacoes && transacoes.filter(t => t.tipo === 'entrada').length > 0 ? (
                            transacoes.filter(t => t.tipo === 'entrada').map((t) => (
                              <div key={t.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{t.descricao}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-muted-foreground">
                                      {t.data_pagamento && format(new Date(t.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                                    </p>
                                    {t.categorias_financeiras && (
                                      <Badge variant="outline" className="text-xs">
                                        {t.categorias_financeiras.nome}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right ml-2">
                                  <p className="text-sm font-bold text-green-600">
                                    + {formatCurrency(Number(t.valor))}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma entrada encontrada</p>
                          )}
                        </TabsContent>

                        <TabsContent value="saidas" className="space-y-2 max-h-96 overflow-y-auto">
                          {isLoadingTransacoes ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
                          ) : transacoes && transacoes.filter(t => t.tipo === 'saida').length > 0 ? (
                            transacoes.filter(t => t.tipo === 'saida').map((t) => (
                              <div key={t.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{t.descricao}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-muted-foreground">
                                      {t.data_pagamento && format(new Date(t.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                                    </p>
                                    {t.categorias_financeiras && (
                                      <Badge variant="outline" className="text-xs">
                                        {t.categorias_financeiras.nome}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right ml-2">
                                  <p className="text-sm font-bold text-red-600">
                                    - {formatCurrency(Number(t.valor))}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma saída encontrada</p>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-sm md:text-base text-muted-foreground text-center">
              Nenhuma conta cadastrada ainda. Configure contas bancárias, caixas físicos ou virtuais.
            </p>
          </CardContent>
        </Card>
      )}

      <ContaDialog
        open={contaDialogOpen}
        onOpenChange={setContaDialogOpen}
        conta={selectedConta}
      />

      {selectedConta && (
        <AjusteSaldoDialog
          open={ajusteSaldoDialogOpen}
          onOpenChange={setAjusteSaldoDialogOpen}
          conta={selectedConta}
        />
      )}
    </div>
  );
}
