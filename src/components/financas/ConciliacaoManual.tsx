import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { VincularTransacaoDialog } from "./VincularTransacaoDialog";
import { ConciliacaoLoteDialog } from "./ConciliacaoLoteDialog";
import { anonymizePixDescription } from "@/utils/anonymization";
import {
  Search,
  Link2,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Layers,
  FileText,
  ArrowRightLeft,
} from "lucide-react";

const ITEMS_PER_PAGE = 15;

interface ExtratoItem {
  id: string;
  conta_id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  reconciliado: boolean;
  transacao_vinculada_id?: string | null;
  origem?: string | null;
  contas?: { nome: string } | null;
}

interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_pagamento: string;
  categorias_financeiras?: { nome: string } | null;
  conta_id?: string | null;
}

export function ConciliacaoManual() {
  const { formatValue } = useHideValues();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState<string>("extrato");

  // Extrato tab state
  const [selectedContaId, setSelectedContaId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");
  const [origemFiltro, setOrigemFiltro] = useState<string>("all");
  const [selectedExtrato, setSelectedExtrato] = useState<ExtratoItem | null>(null);
  const [vincularDialogOpen, setVincularDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Transacao tab state
  const [transacaoSearchTerm, setTransacaoSearchTerm] = useState("");
  const [selectedTransacao, setSelectedTransacao] = useState<Transacao | null>(null);
  const [loteDialogOpen, setLoteDialogOpen] = useState(false);
  const [transacaoPage, setTransacaoPage] = useState(1);

  // Fetch accounts
  const { data: contas } = useQuery({
    queryKey: ["contas-conciliacao", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch pending statements
  const {
    data: extratos,
    isLoading: loadingExtratos,
    refetch: refetchExtratos,
  } = useQuery({
    queryKey: [
      "extratos-pendentes",
      igrejaId,
      filialId,
      isAllFiliais,
      selectedContaId,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("extratos_bancarios")
        .select("*, contas(nome)")
        .eq("igreja_id", igrejaId)
        .eq("reconciliado", false)
        .is("transacao_vinculada_id", null)
        .order("data_transacao", { ascending: false })
        .limit(100);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      if (selectedContaId !== "all") {
        query = query.eq("conta_id", selectedContaId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as ExtratoItem[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch transactions for linking
  const { data: transacoes, isLoading: loadingTransacoes } = useQuery({
    queryKey: ["transacoes-conciliacao", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      const dataInicio = format(subDays(new Date(), 90), "yyyy-MM-dd");
      let query = supabase
        .from("transacoes_financeiras")
        .select("id, descricao, valor, tipo, data_pagamento, conta_id, categorias_financeiras(nome)")
        .eq("igreja_id", igrejaId)
        .eq("status", "pago")
        .gte("data_pagamento", dataInicio)
        .order("data_pagamento", { ascending: false })
        .limit(500);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Transacao[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Filter statements
  const extratosFiltrados = useMemo(() => {
    if (!extratos) return [];
    
    return extratos.filter((e) => {
      if (e.descricao?.toUpperCase().includes("CONTAMAX")) return false;
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !e.descricao.toLowerCase().includes(search) &&
          !e.contas?.nome.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      
      if (tipoFiltro !== "all") {
        const tipoNormalizado = e.tipo?.toLowerCase() === "credit" ? "credito" : e.tipo?.toLowerCase() === "debit" ? "debito" : e.tipo?.toLowerCase();
        if (tipoNormalizado !== tipoFiltro) return false;
      }
      
      if (origemFiltro !== "all") {
        if (e.origem !== origemFiltro) return false;
      }
      
      return true;
    });
  }, [extratos, searchTerm, tipoFiltro, origemFiltro]);

  // Filter transactions (those not yet fully reconciled via batch)
  const transacoesPendentes = useMemo(() => {
    if (!transacoes) return [];
    
    return transacoes.filter((t) => {
      if (transacaoSearchTerm) {
        const search = transacaoSearchTerm.toLowerCase();
        if (
          !t.descricao.toLowerCase().includes(search) &&
          !t.categorias_financeiras?.nome.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [transacoes, transacaoSearchTerm]);

  // Reset pages on filter change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedContaId, tipoFiltro, origemFiltro]);

  useMemo(() => {
    setTransacaoPage(1);
  }, [transacaoSearchTerm]);

  // Pagination
  const totalPages = Math.ceil(extratosFiltrados.length / ITEMS_PER_PAGE);
  const paginatedExtratos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return extratosFiltrados.slice(start, start + ITEMS_PER_PAGE);
  }, [extratosFiltrados, currentPage]);

  const transacaoTotalPages = Math.ceil(transacoesPendentes.length / ITEMS_PER_PAGE);
  const paginatedTransacoes = useMemo(() => {
    const start = (transacaoPage - 1) * ITEMS_PER_PAGE;
    return transacoesPendentes.slice(start, start + ITEMS_PER_PAGE);
  }, [transacoesPendentes, transacaoPage]);

  const handleIgnorar = async (extratoId: string) => {
    try {
      const { error } = await supabase
        .from("extratos_bancarios")
        .update({ reconciliado: true })
        .eq("id", extratoId);

      if (error) {
        console.error("Erro ao ignorar:", error);
        toast.error("Erro ao ignorar extrato");
        return;
      }

      toast.success("Extrato marcado como ignorado");
      refetchExtratos();
    } catch (err) {
      console.error("Exceção ao ignorar:", err);
      toast.error("Erro ao ignorar extrato");
    }
  };

  const handleReconciliarAutomatico = async () => {
    if (!extratos || extratos.length === 0) {
      toast.info("Nenhum extrato pendente para reconciliar");
      return;
    }

    const contaIds = [...new Set(extratos.map((e) => e.conta_id))];
    let totalReconciliados = 0;

    try {
      for (const contaId of contaIds) {
        const { data, error } = await supabase.rpc("reconciliar_transacoes", {
          p_conta_id: contaId,
        });

        if (error) {
          console.error("Erro na reconciliação automática:", error);
          continue;
        }
        totalReconciliados += data?.length || 0;
      }

      if (totalReconciliados === 0) {
        toast.info("Nenhuma correspondência encontrada automaticamente");
        return;
      }

      toast.success(`Reconciliação automática concluída`, {
        description: `${totalReconciliados} transação(ões) reconciliada(s)`,
      });
      refetchExtratos();
      queryClient.invalidateQueries({ queryKey: ["transacoes-conciliacao"] });
    } catch (err) {
      console.error("Exceção na reconciliação:", err);
      toast.error("Erro na reconciliação automática");
    }
  };

  const handleVincular = (extrato: ExtratoItem) => {
    setSelectedExtrato(extrato);
    setVincularDialogOpen(true);
  };

  const handleConciliarLote = (transacao: Transacao) => {
    setSelectedTransacao(transacao);
    setLoteDialogOpen(true);
  };

  const handleVinculado = () => {
    refetchExtratos();
    queryClient.invalidateQueries({ queryKey: ["transacoes-conciliacao"] });
  };

  const handleLoteConciliado = () => {
    refetchExtratos();
    queryClient.invalidateQueries({ queryKey: ["transacoes-conciliacao"] });
  };

  const pendentes = extratosFiltrados.length;

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Conciliação Manual</CardTitle>
            {pendentes > 0 && (
              <Badge variant="secondary">{pendentes} pendente(s)</Badge>
            )}
          </div>
          <Button onClick={handleReconciliarAutomatico} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reconciliar Automático
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="extrato" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Por Extrato
            </TabsTrigger>
            <TabsTrigger value="transacao" className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Por Transação
            </TabsTrigger>
          </TabsList>

          {/* Tab: Por Extrato */}
          <TabsContent value="extrato" className="space-y-4 mt-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedContaId} onValueChange={setSelectedContaId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {contas?.map((conta) => (
                    <SelectItem key={conta.id} value={conta.id}>
                      {conta.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                </SelectContent>
              </Select>
              <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="api_santander">API Santander</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            {pendentes === 0 && !loadingExtratos && (
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-green-900 dark:text-green-300">
                  Todos os extratos estão conciliados
                </p>
              </div>
            )}

            {/* Statements List */}
            {loadingExtratos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {paginatedExtratos.map((extrato) => (
                      <div
                        key={extrato.id}
                        className={`p-4 rounded-lg border ${
                          extrato.tipo === "credito" || extrato.tipo === "CREDIT"
                            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">
                                {anonymizePixDescription(extrato.descricao)}
                              </p>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {extrato.tipo === "credito" || extrato.tipo === "CREDIT"
                                  ? "Crédito"
                                  : "Débito"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {format(parseISO(extrato.data_transacao), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                              </span>
                              {extrato.contas && (
                                <>
                                  <span>•</span>
                                  <span>{extrato.contas.nome}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={`font-bold ${
                                extrato.tipo === "credito" || extrato.tipo === "CREDIT"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {extrato.tipo === "credito" || extrato.tipo === "CREDIT" ? "+" : "-"}
                              {formatValue(Math.abs(extrato.valor))}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleVincular(extrato)}
                          >
                            <Link2 className="w-3 h-3 mr-1" />
                            Vincular
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleIgnorar(extrato.id)}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Ignorar
                          </Button>
                        </div>
                      </div>
                    ))}

                    {extratosFiltrados.length === 0 && !loadingExtratos && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum extrato pendente de conciliação
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Importe extratos na página de Contas para iniciar a conciliação
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t mt-3">
                    <p className="text-xs text-muted-foreground">
                      {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                      {Math.min(currentPage * ITEMS_PER_PAGE, extratosFiltrados.length)} de{" "}
                      {extratosFiltrados.length}
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                          let page: number;
                          if (totalPages <= 3) {
                            page = i + 1;
                          } else if (currentPage === 1) {
                            page = i + 1;
                          } else if (currentPage === totalPages) {
                            page = totalPages - 2 + i;
                          } else {
                            page = currentPage - 1 + i;
                          }
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Tab: Por Transação */}
          <TabsContent value="transacao" className="space-y-4 mt-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Layers className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    Conciliação em Lote (N:1)
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Selecione uma transação do sistema para vincular múltiplos registros do extrato bancário.
                    Ideal para ofertas PIX consolidadas.
                  </p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transação por descrição ou categoria..."
                value={transacaoSearchTerm}
                onChange={(e) => setTransacaoSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Transactions List */}
            {loadingTransacoes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {paginatedTransacoes.map((transacao) => (
                      <div
                        key={transacao.id}
                        className={`p-4 rounded-lg border ${
                          transacao.tipo === "entrada"
                            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">
                                {transacao.descricao}
                              </p>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {transacao.tipo === "entrada" ? "Entrada" : "Saída"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {format(parseISO(transacao.data_pagamento), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                              </span>
                              {transacao.categorias_financeiras && (
                                <>
                                  <span>•</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {transacao.categorias_financeiras.nome}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={`font-bold ${
                                transacao.tipo === "entrada"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatValue(Math.abs(Number(transacao.valor)))}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleConciliarLote(transacao)}
                          >
                            <Layers className="w-3 h-3 mr-1" />
                            Conciliar em Lote
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Create a fake extrato to use the 1:1 dialog in reverse
                              // For now, just open the lote dialog
                              handleConciliarLote(transacao);
                            }}
                          >
                            <Link2 className="w-3 h-3 mr-1" />
                            Vincular 1:1
                          </Button>
                        </div>
                      </div>
                    ))}

                    {transacoesPendentes.length === 0 && !loadingTransacoes && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Nenhuma transação encontrada
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ajuste os filtros ou verifique se há transações pagas nos últimos 90 dias
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Pagination */}
                {transacaoTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t mt-3">
                    <p className="text-xs text-muted-foreground">
                      {(transacaoPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                      {Math.min(transacaoPage * ITEMS_PER_PAGE, transacoesPendentes.length)} de{" "}
                      {transacoesPendentes.length}
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setTransacaoPage(Math.max(1, transacaoPage - 1))}
                            disabled={transacaoPage === 1}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(3, transacaoTotalPages) }, (_, i) => {
                          let page: number;
                          if (transacaoTotalPages <= 3) {
                            page = i + 1;
                          } else if (transacaoPage === 1) {
                            page = i + 1;
                          } else if (transacaoPage === transacaoTotalPages) {
                            page = transacaoTotalPages - 2 + i;
                          } else {
                            page = transacaoPage - 1 + i;
                          }
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setTransacaoPage(page)}
                                isActive={transacaoPage === page}
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setTransacaoPage(Math.min(transacaoTotalPages, transacaoPage + 1))
                            }
                            disabled={transacaoPage === transacaoTotalPages}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialog de Vinculação 1:1 */}
      {selectedExtrato && (
        <VincularTransacaoDialog
          open={vincularDialogOpen}
          onOpenChange={setVincularDialogOpen}
          extrato={selectedExtrato}
          transacoesDisponiveis={transacoes || []}
          onVinculado={handleVinculado}
        />
      )}

      {/* Dialog de Conciliação em Lote */}
      {selectedTransacao && (
        <ConciliacaoLoteDialog
          open={loteDialogOpen}
          onOpenChange={setLoteDialogOpen}
          transacao={selectedTransacao}
          onConciliado={handleLoteConciliado}
        />
      )}
    </Card>
  );
}
