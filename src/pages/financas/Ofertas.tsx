import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft, Calendar, TrendingUp, Heart, DollarSign, Download } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, formatDateForExport, formatCurrencyForExport } from "@/lib/exportUtils";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { TransacaoDialog } from "@/components/financas/TransacaoDialog";
import { MonthPicker } from "@/components/financas/MonthPicker";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Ofertas() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<any>(null);
  
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);

  const getDateRange = () => {
    if (customRange) {
      return { inicio: startOfDay(customRange.from), fim: endOfDay(customRange.to) };
    }
    return { inicio: startOfMonth(selectedMonth), fim: endOfMonth(selectedMonth) };
  };

  const dateRange = getDateRange();

  // Buscar ofertas (entradas) com categorias relacionadas a ofertas/dízimos
  const { data: transacoes, isLoading, refetch } = useQuery({
    queryKey: ['ofertas', selectedMonth, customRange],
    queryFn: async () => {
      const dateRange = getDateRange();
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select(`
          *,
          conta:conta_id(nome, id),
          categoria:categoria_id(nome, cor, id),
          subcategoria:subcategoria_id(nome)
        `)
        .eq('tipo', 'entrada')
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

  const totalOfertas = transacoes?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalRecebido = transacoes?.filter(t => t.status === 'pago').reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPendente = transacoes?.filter(t => t.status === 'pendente').reduce((sum, t) => sum + Number(t.valor), 0) || 0;

  const getStatusDisplay = (transacao: any) => {
    if (transacao.status === 'pago') return 'Recebido';
    if (transacao.status === 'pendente') {
      const hoje = new Date();
      const vencimento = new Date(transacao.data_vencimento);
      if (vencimento < hoje) return 'Atrasado';
      return 'Pendente';
    }
    return 'Atrasado';
  };

  const getStatusColor = (transacao: any) => {
    if (transacao.status === 'pago') {
      return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    }
    if (transacao.status === 'pendente') {
      const hoje = new Date();
      const vencimento = new Date(transacao.data_vencimento);
      if (vencimento < hoje) {
        return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
      }
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
    }
    return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
  };

  const handleExportar = () => {
    try {
      if (!transacoes || transacoes.length === 0) {
        toast.error("Não há dados para exportar");
        return;
      }

      const dadosExportacao = transacoes.map(t => ({
        'Descrição': t.descricao,
        'Valor': formatCurrencyForExport(t.valor),
        'Status': getStatusDisplay(t),
        'Data Vencimento': formatDateForExport(t.data_vencimento),
        'Data Recebimento': formatDateForExport(t.data_pagamento),
        'Conta': t.conta?.nome || '',
        'Categoria': t.categoria?.nome || '',
      }));

      exportToExcel(dadosExportacao, 'Ofertas', 'Ofertas');
      toast.success("Dados exportados com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar dados");
    }
  };

  const handleEdit = (transacao: any) => {
    setEditingTransacao(transacao);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTransacao(null);
    refetch();
  };

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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gestão de Ofertas</h1>
              <p className="text-sm text-muted-foreground">Dízimos e ofertas da igreja</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={handleExportar}
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button 
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Oferta
            </Button>
          </div>
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-3">
          <MonthPicker
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
          />
          <Badge variant="outline" className="gap-1.5">
            <Calendar className="w-3 h-3" />
            {customRange 
              ? `${format(customRange.from, "dd/MM/yyyy")} - ${format(customRange.to, "dd/MM/yyyy")}`
              : format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })
            }
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card className="shadow-soft border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Previsto</p>
                <p className="text-lg font-bold">{formatCurrency(totalOfertas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totalRecebido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-lg font-bold text-yellow-600">{formatCurrency(totalPendente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Heart className="w-5 h-5 text-emerald-500" />
            Ofertas e Dízimos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Carregando ofertas...</p>
            </div>
          ) : transacoes && transacoes.length > 0 ? (
            <div className="space-y-3">
              {transacoes.map((transacao) => (
                <Card 
                  key={transacao.id} 
                  className="border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleEdit(transacao)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">{transacao.descricao}</h3>
                          <Badge className={`text-xs ${getStatusColor(transacao)}`}>
                            {getStatusDisplay(transacao)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {transacao.categoria && (
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: transacao.categoria.cor || '#666' }} />
                              <span>{transacao.categoria.nome}</span>
                            </div>
                          )}
                          <span>•</span>
                          <span>{format(new Date(transacao.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}</span>
                          {transacao.conta && (
                            <>
                              <span>•</span>
                              <span>{transacao.conta.nome}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{formatCurrency(transacao.valor)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-1">Nenhuma oferta encontrada</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Não há ofertas registradas neste período.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Registrar Oferta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TransacaoDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        tipo="entrada"
        transacao={editingTransacao}
      />
    </div>
  );
}
