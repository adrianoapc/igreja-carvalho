import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft, Calendar, TrendingDown, Building2, FileText, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { TransacaoDialog } from "@/components/financas/TransacaoDialog";
import { ImportarExcelDialog } from "@/components/financas/ImportarExcelDialog";
import { TransacaoActionsMenu } from "@/components/financas/TransacaoActionsMenu";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Saidas() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<any>(null);
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes' | 'ano'>('mes');

  // Calcular datas de início e fim baseado no período selecionado
  const getDateRange = () => {
    const now = new Date();
    switch (periodo) {
      case 'hoje':
        return { inicio: startOfDay(now), fim: endOfDay(now) };
      case 'semana':
        return { inicio: startOfWeek(now, { weekStartsOn: 0 }), fim: endOfWeek(now, { weekStartsOn: 0 }) };
      case 'mes':
        return { inicio: startOfMonth(now), fim: endOfMonth(now) };
      case 'ano':
        return { inicio: startOfYear(now), fim: endOfYear(now) };
    }
  };

  const dateRange = getDateRange();

  const { data: transacoes, isLoading } = useQuery({
    queryKey: ['saidas', periodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select(`
          *,
          conta:conta_id(nome),
          categoria:categoria_id(nome, cor),
          subcategoria:subcategoria_id(nome),
          base_ministerial:base_ministerial_id(titulo),
          centro_custo:centro_custo_id(nome),
          fornecedor:fornecedor_id(nome)
        `)
        .eq('tipo', 'saida')
        .gte('data_vencimento', dateRange.inicio.toISOString().split('T')[0])
        .lte('data_vencimento', dateRange.fim.toISOString().split('T')[0])
        .order('data_vencimento', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalSaidas = transacoes?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPago = transacoes?.filter(t => t.status === 'pago').reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPendente = transacoes?.filter(t => t.status === 'pendente').reduce((sum, t) => sum + Number(t.valor), 0) || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'atrasado':
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400';
    }
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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Saídas</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie os pagamentos da igreja</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Importar Excel</span>
              <span className="sm:hidden">Importar</span>
            </Button>
            <Button 
              className="bg-gradient-primary shadow-soft"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Nova Saída</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros de Período */}
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="hoje">Hoje</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
              <TabsTrigger value="ano">Ano</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{formatCurrency(totalSaidas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="text-lg font-bold">{formatCurrency(totalPago)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-lg font-bold">{formatCurrency(totalPendente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Transações */}
      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Lista de Saídas</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : transacoes && transacoes.length > 0 ? (
            <div className="space-y-3">
              {transacoes.map((transacao) => (
                <Card key={transacao.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <h3 className="font-semibold text-sm truncate">{transacao.descricao}</h3>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {transacao.conta && (
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              <span>{transacao.conta.nome}</span>
                            </div>
                          )}
                          {transacao.categoria && (
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: transacao.categoria.cor || '#666' }} />
                              <span>{transacao.categoria.nome}</span>
                              {transacao.subcategoria && <span> • {transacao.subcategoria.nome}</span>}
                            </div>
                          )}
                          {transacao.fornecedor && (
                            <div className="flex items-center gap-1">
                              <span>Fornecedor: {transacao.fornecedor.nome}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Venc: {format(new Date(transacao.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            {transacao.data_pagamento && (
                              <span> • Pago: {format(new Date(transacao.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-red-600">{formatCurrency(Number(transacao.valor))}</p>
                          <Badge className={`text-xs mt-1 ${getStatusColor(transacao.status)}`}>
                            {transacao.status}
                          </Badge>
                        </div>
                        <TransacaoActionsMenu
                          transacaoId={transacao.id}
                          status={transacao.status}
                          tipo="saida"
                          onEdit={() => {
                            setEditingTransacao(transacao);
                            setDialogOpen(true);
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm md:text-base text-muted-foreground text-center py-4">
              Nenhuma saída encontrada para o período selecionado.
            </p>
          )}
        </CardContent>
      </Card>

      <TransacaoDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTransacao(null);
        }}
        tipo="saida"
        transacao={editingTransacao}
      />

      <ImportarExcelDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        tipo="saida"
      />
    </div>
  );
}
