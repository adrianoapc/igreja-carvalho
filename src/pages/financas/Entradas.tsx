import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft, Calendar, TrendingUp, Building2, FileText, Upload, Paperclip, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { TransacaoDialog } from "@/components/financas/TransacaoDialog";
import { ImportarExcelDialog } from "@/components/financas/ImportarExcelDialog";
import { TransacaoActionsMenu } from "@/components/financas/TransacaoActionsMenu";
import { FiltrosSheet } from "@/components/financas/FiltrosSheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Entradas() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<any>(null);
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes' | 'ano' | 'customizado'>('mes');
  
  // Range de data customizado
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  
  // Estados dos filtros
  const [busca, setBusca] = useState("");
  const [contaFilter, setContaFilter] = useState("all");
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Calcular datas de início e fim baseado no período selecionado
  const getDateRange = () => {
    const now = new Date();
    
    if (periodo === 'customizado' && dataInicio && dataFim) {
      return { inicio: startOfDay(dataInicio), fim: endOfDay(dataFim) };
    }
    
    switch (periodo) {
      case 'hoje':
        return { inicio: startOfDay(now), fim: endOfDay(now) };
      case 'semana':
        return { inicio: startOfWeek(now, { weekStartsOn: 0 }), fim: endOfWeek(now, { weekStartsOn: 0 }) };
      case 'mes':
        return { inicio: startOfMonth(now), fim: endOfMonth(now) };
      case 'ano':
        return { inicio: startOfYear(now), fim: endOfYear(now) };
      default:
        return { inicio: startOfMonth(now), fim: endOfMonth(now) };
    }
  };

  const dateRange = getDateRange();

  const { data: transacoes, isLoading, refetch } = useQuery({
    queryKey: ['entradas', periodo, dataInicio, dataFim],
    queryFn: async () => {
      const dateRange = getDateRange();
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select(`
          *,
          conta:conta_id(nome, id),
          categoria:categoria_id(nome, cor, id),
          subcategoria:subcategoria_id(nome),
          base_ministerial:base_ministerial_id(titulo),
          centro_custo:centro_custo_id(nome),
          fornecedor:fornecedor_id(nome)
        `)
        .eq('tipo', 'entrada')
        .gte('data_vencimento', dateRange.inicio.toISOString().split('T')[0])
        .lte('data_vencimento', dateRange.fim.toISOString().split('T')[0])
        .order('data_vencimento', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Buscar contas e categorias para os filtros
  const { data: contas } = useQuery({
    queryKey: ['contas-filtro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias-filtro-entrada'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('id, nome')
        .eq('ativo', true)
        .eq('tipo', 'entrada')
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  // Aplicar filtros
  const transacoesFiltradas = useMemo(() => {
    if (!transacoes) return [];
    
    return transacoes.filter(t => {
      // Filtro de busca por descrição
      if (busca && !t.descricao.toLowerCase().includes(busca.toLowerCase())) {
        return false;
      }
      
      // Filtro de conta
      if (contaFilter !== "all" && t.conta_id !== contaFilter) {
        return false;
      }
      
      // Filtro de categoria
      if (categoriaFilter !== "all" && t.categoria_id !== categoriaFilter) {
        return false;
      }
      
      // Filtro de status
      if (statusFilter !== "all" && t.status !== statusFilter) {
        return false;
      }
      
      return true;
    });
  }, [transacoes, busca, contaFilter, categoriaFilter, statusFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalEntradas = transacoesFiltradas?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPago = transacoesFiltradas?.filter(t => t.status === 'pago').reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPendente = transacoesFiltradas?.filter(t => t.status === 'pendente').reduce((sum, t) => sum + Number(t.valor), 0) || 0;

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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Entradas</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie os recebimentos da igreja</p>
          </div>
          <div className="flex gap-2">
            <FiltrosSheet
              periodo={periodo}
              setPeriodo={setPeriodo}
              dataInicio={dataInicio}
              setDataInicio={setDataInicio}
              dataFim={dataFim}
              setDataFim={setDataFim}
              busca={busca}
              setBusca={setBusca}
              contaId={contaFilter}
              setContaId={setContaFilter}
              categoriaId={categoriaFilter}
              setCategoriaId={setCategoriaFilter}
              status={statusFilter}
              setStatus={setStatusFilter}
              contas={contas || []}
              categorias={categorias || []}
              onLimpar={() => {
                setBusca("");
                setContaFilter("all");
                setCategoriaFilter("all");
                setStatusFilter("all");
                setPeriodo("mes");
                setDataInicio(undefined);
                setDataFim(undefined);
              }}
              onAplicar={() => refetch()}
            />
            <Button 
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button 
              className="bg-gradient-primary shadow-soft"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Nova Entrada</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        {(periodo !== 'mes' || busca || contaFilter !== 'all' || categoriaFilter !== 'all' || statusFilter !== 'all') && (
          <div className="flex flex-wrap gap-2 mt-3">
            {periodo !== 'mes' && (
              <Badge variant="secondary" className="gap-1.5 pr-1">
                Período: {periodo === 'hoje' ? 'Hoje' : periodo === 'semana' ? 'Semana' : periodo === 'ano' ? 'Ano' : 'Customizado'}
                <button 
                  onClick={() => setPeriodo('mes')} 
                  className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {busca && (
              <Badge variant="secondary" className="gap-1.5 pr-1">
                Busca: {busca}
                <button 
                  onClick={() => setBusca('')} 
                  className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {contaFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1.5 pr-1">
                Conta: {contas?.find(c => c.id === contaFilter)?.nome}
                <button 
                  onClick={() => setContaFilter('all')} 
                  className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {categoriaFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1.5 pr-1">
                Categoria: {categorias?.find(c => c.id === categoriaFilter)?.nome}
                <button 
                  onClick={() => setCategoriaFilter('all')} 
                  className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1.5 pr-1">
                Status: {statusFilter === 'pendente' ? 'Pendente' : statusFilter === 'pago' ? 'Pago' : 'Atrasado'}
                <button 
                  onClick={() => setStatusFilter('all')} 
                  className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{formatCurrency(totalEntradas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
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
          <CardTitle className="text-lg md:text-xl">Lista de Entradas</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : transacoesFiltradas && transacoesFiltradas.length > 0 ? (
            <div className="space-y-3">
              {transacoesFiltradas.map((transacao) => (
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
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Venc: {format(new Date(transacao.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            {transacao.data_pagamento && (
                              <span> • Pago: {format(new Date(transacao.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })}</span>
                            )}
                          </div>
                          {transacao.anexo_url && (
                            <div className="flex items-center gap-1 mt-1">
                              <Paperclip className="w-3 h-3" />
                              <a 
                                href={transacao.anexo_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Ver anexo
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-green-600">{formatCurrency(Number(transacao.valor))}</p>
                          <Badge className={`text-xs mt-1 ${getStatusColor(transacao.status)}`}>
                            {transacao.status === 'pago' ? 'Pago' : transacao.status === 'pendente' ? 'Pendente' : 'Atrasado'}
                          </Badge>
                        </div>
                        <TransacaoActionsMenu
                          transacaoId={transacao.id}
                          status={transacao.status}
                          tipo="entrada"
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
              Nenhuma entrada encontrada para o período selecionado.
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
        tipo="entrada"
        transacao={editingTransacao}
      />

      <ImportarExcelDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        tipo="entrada"
      />
    </div>
  );
}
