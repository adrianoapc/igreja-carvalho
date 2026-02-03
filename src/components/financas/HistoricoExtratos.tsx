import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MonthPicker } from "./MonthPicker";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  Link2,
  Link2Off,
  Eye,
  RotateCcw,
  Ban,
  Loader2,
  FileText,
  ChevronDown,
  Layers,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/utils/dateUtils";
import { VincularTransacaoDialog } from "./VincularTransacaoDialog";
import { TransacaoVinculadaDialog } from "./TransacaoVinculadaDialog";
import { anonymizePixDescription } from "@/utils/anonymization";

interface ExtratoItem {
  id: string;
  conta_id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  reconciliado: boolean;
  transacao_vinculada_id: string | null;
  origem: string | null;
  external_id: string | null;
  conta?: {
    nome: string;
    banco: string | null;
  };
}

const ITEMS_PER_PAGE = 20;

type GroupByOption = "none" | "status" | "tipo" | "origem" | "conta";

export function HistoricoExtratos() {
  const { igrejaId, filialId } = useAuthContext();
  const queryClient = useQueryClient();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [contaSelecionada, setContaSelecionada] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");
  const [origemFiltro, setOrigemFiltro] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Grouping
  const [groupBy, setGroupBy] = useState<GroupByOption>("none");

  // Dialogs
  const [extratoParaVincular, setExtratoParaVincular] = useState<ExtratoItem | null>(null);
  const [transacaoParaVisualizar, setTransacaoParaVisualizar] = useState<string | null>(null);

  // Loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch contas
  const { data: contas = [] } = useQuery({
    queryKey: ["contas-extrato", igrejaId, filialId],
    queryFn: async () => {
      const query = supabase
        .from("contas")
        .select("id, nome, banco")
        .eq("ativo", true)
        .order("nome");

      if (filialId) {
        query.eq("filial_id", filialId);
      } else if (igrejaId) {
        query.eq("igreja_id", igrejaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!igrejaId,
  });

  // Fetch all extratos
  const { data: extratos = [], isLoading } = useQuery({
    queryKey: ["extratos-historico", igrejaId, filialId, contaSelecionada, selectedMonth, customRange],
    queryFn: async () => {
      // Calcular datas baseado no MonthPicker
      let dataInicio: Date;
      let dataFim: Date;
      
      if (customRange) {
        dataInicio = customRange.from;
        dataFim = customRange.to;
      } else {
        // Mês selecionado: primeiro e último dia
        dataInicio = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        dataFim = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      }
      
      let query = supabase
        .from("extratos_bancarios")
        .select(`
          id,
          conta_id,
          data_transacao,
          descricao,
          valor,
          tipo,
          reconciliado,
          transacao_vinculada_id,
          origem,
          external_id,
          conta:contas(nome, banco)
        `)
        .eq("igreja_id", igrejaId)
        .order("data_transacao", { ascending: false });

      if (filialId) {
        query = query.eq("filial_id", filialId);
      }

      if (contaSelecionada && contaSelecionada !== "all") {
        query = query.eq("conta_id", contaSelecionada);
      }

      query = query.gte("data_transacao", formatLocalDate(dataInicio));
      query = query.lte("data_transacao", formatLocalDate(dataFim));

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ExtratoItem[];
    },
    enabled: !!igrejaId,
  });

  // Fetch transações for linking
  const { data: transacoes = [] } = useQuery({
    queryKey: ["transacoes-para-vincular", igrejaId, filialId],
    queryFn: async () => {
      const query = supabase
        .from("transacoes_financeiras")
        .select(`
          id,
          descricao,
          valor,
          tipo,
          data_pagamento,
          categoria:categorias_financeiras(nome)
        `)
        .order("data_pagamento", { ascending: false })
        .limit(500);

      if (filialId) {
        query.eq("filial_id", filialId);
      } else if (igrejaId) {
        query.eq("igreja_id", igrejaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!igrejaId,
  });

  // Filter extratos
  const extratosFiltrados = useMemo(() => {
    return extratos.filter((extrato) => {
      // Filter out CONTAMAX internal transactions
      if (extrato.descricao?.toUpperCase().includes("CONTAMAX")) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        if (!extrato.descricao?.toLowerCase().includes(termo)) {
          return false;
        }
      }

      // Status filter
      if (statusFiltro !== "all") {
        if (statusFiltro === "pendente") {
          if (extrato.reconciliado || extrato.transacao_vinculada_id) return false;
        } else if (statusFiltro === "conciliado") {
          if (!extrato.transacao_vinculada_id) return false;
        } else if (statusFiltro === "ignorado") {
          if (!extrato.reconciliado || extrato.transacao_vinculada_id) return false;
        }
      }

      // Tipo filter
      if (tipoFiltro !== "all") {
        if (extrato.tipo !== tipoFiltro) return false;
      }

      // Origem filter
      if (origemFiltro !== "all") {
        if (extrato.origem !== origemFiltro) return false;
      }

      return true;
    });
  }, [extratos, searchTerm, statusFiltro, tipoFiltro, origemFiltro]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFiltro, tipoFiltro, origemFiltro, contaSelecionada, selectedMonth, customRange]);

  // Pagination
  const totalPages = Math.ceil(extratosFiltrados.length / ITEMS_PER_PAGE);
  const paginatedExtratos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return extratosFiltrados.slice(start, start + ITEMS_PER_PAGE);
  }, [extratosFiltrados, currentPage]);

  // Grouping logic
  const getStatusKey = (extrato: ExtratoItem) => {
    if (extrato.transacao_vinculada_id) return "conciliado";
    if (extrato.reconciliado) return "ignorado";
    return "pendente";
  };

  const groupedExtratos = useMemo(() => {
    if (groupBy === "none") return null;

    const groups: Record<string, ExtratoItem[]> = {};
    
    paginatedExtratos.forEach((extrato) => {
      let key = "";
      switch (groupBy) {
        case "status":
          key = getStatusKey(extrato);
          break;
        case "tipo":
          key = extrato.tipo || "sem_tipo";
          break;
        case "origem":
          key = extrato.origem || "sem_origem";
          break;
        case "conta":
          key = extrato.conta?.nome || "sem_conta";
          break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(extrato);
    });

    return groups;
  }, [paginatedExtratos, groupBy]);

  const getGroupLabel = (key: string) => {
    switch (groupBy) {
      case "status":
        return key === "conciliado" ? "Conciliados" : key === "ignorado" ? "Ignorados" : "Pendentes";
      case "tipo":
        return key === "credito" ? "Crédito" : key === "debito" ? "Débito" : key;
      case "origem":
        return key === "api_santander" ? "API Santander" : key === "manual" ? "Manual" : key === "sem_origem" ? "Sem Origem" : key;
      case "conta":
        return key === "sem_conta" ? "Sem Conta" : key;
      default:
        return key;
    }
  };

  // Get status info
  const getStatusInfo = (extrato: ExtratoItem) => {
    if (extrato.transacao_vinculada_id) {
      return { label: "Conciliado", color: "bg-green-500/10 text-green-600 border-green-200" };
    }
    if (extrato.reconciliado) {
      return { label: "Ignorado", color: "bg-muted text-muted-foreground border-muted" };
    }
    return { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" };
  };

  // Actions
  const handleIgnorar = async (extrato: ExtratoItem) => {
    setActionLoading(extrato.id);
    try {
      const { error } = await supabase
        .from("extratos_bancarios")
        .update({ reconciliado: true })
        .eq("id", extrato.id);

      if (error) throw error;

      toast.success("Extrato marcado como ignorado");
      queryClient.invalidateQueries({ queryKey: ["extratos-historico"] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao ignorar extrato");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReativar = async (extrato: ExtratoItem) => {
    setActionLoading(extrato.id);
    try {
      const { error } = await supabase
        .from("extratos_bancarios")
        .update({ reconciliado: false })
        .eq("id", extrato.id);

      if (error) throw error;

      toast.success("Extrato reativado para conciliação");
      queryClient.invalidateQueries({ queryKey: ["extratos-historico"] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao reativar extrato");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDesvincular = async (extrato: ExtratoItem) => {
    setActionLoading(extrato.id);
    try {
      const { error } = await supabase
        .from("extratos_bancarios")
        .update({ transacao_vinculada_id: null, reconciliado: false })
        .eq("id", extrato.id);

      if (error) throw error;

      toast.success("Vínculo removido");
      queryClient.invalidateQueries({ queryKey: ["extratos-historico"] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao desvincular");
    } finally {
      setActionLoading(null);
    }
  };

  const handleVinculado = () => {
    setExtratoParaVincular(null);
    queryClient.invalidateQueries({ queryKey: ["extratos-historico"] });
  };

  // Stats
  const stats = useMemo(() => {
    const total = extratos.length;
    const pendentes = extratos.filter(e => !e.reconciliado && !e.transacao_vinculada_id).length;
    const conciliados = extratos.filter(e => !!e.transacao_vinculada_id).length;
    const ignorados = extratos.filter(e => e.reconciliado && !e.transacao_vinculada_id).length;
    return { total, pendentes, conciliados, ignorados };
  }, [extratos]);

  // Render single extrato item
  const renderExtratoItem = (extrato: ExtratoItem) => {
    const status = getStatusInfo(extrato);
    const isLoadingItem = actionLoading === extrato.id;

    return (
      <div
        key={extrato.id}
        className={cn(
          "flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-lg border transition-colors",
          extrato.tipo === "credito" || extrato.tipo === "CREDIT"
            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/30"
            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/30"
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{anonymizePixDescription(extrato.descricao)}</span>
            <Badge variant="outline" className={cn("text-xs", status.color)}>
              {status.label}
            </Badge>
            {extrato.origem && (
              <Badge variant="secondary" className="text-xs">
                {extrato.origem === "api_santander" ? "API Santander" : "Manual"}
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>{format(parseISO(extrato.data_transacao), "dd/MM/yyyy", { locale: ptBR })}</span>
            <span>•</span>
            <span>{extrato.conta?.nome || "Conta não identificada"}</span>
            {extrato.conta?.banco && (
              <>
                <span>•</span>
                <span>{extrato.conta.banco}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "font-semibold whitespace-nowrap",
              extrato.tipo === "credito" || extrato.tipo === "CREDIT" ? "text-green-600" : "text-red-600"
            )}
          >
            {extrato.tipo === "credito" || extrato.tipo === "CREDIT" ? "+" : "-"}
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(Math.abs(extrato.valor))}
          </span>

          <div className="flex items-center gap-1">
            {/* Pendente actions */}
            {!extrato.reconciliado && !extrato.transacao_vinculada_id && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExtratoParaVincular(extrato)}
                  disabled={isLoadingItem}
                >
                  <Link2 className="w-4 h-4 mr-1" />
                  Vincular
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleIgnorar(extrato)}
                  disabled={isLoadingItem}
                >
                  {isLoadingItem ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                </Button>
              </>
            )}

            {/* Conciliado actions */}
            {extrato.transacao_vinculada_id && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTransacaoParaVisualizar(extrato.transacao_vinculada_id)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Ver
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDesvincular(extrato)}
                  disabled={isLoadingItem}
                >
                  {isLoadingItem ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2Off className="w-4 h-4" />
                  )}
                </Button>
              </>
            )}

            {/* Ignorado actions */}
            {extrato.reconciliado && !extrato.transacao_vinculada_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReativar(extrato)}
                disabled={isLoadingItem}
              >
                {isLoadingItem ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reativar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-sm text-yellow-600">Pendentes</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pendentes}</div>
        </Card>
        <Card className="p-3">
          <div className="text-sm text-green-600">Conciliados</div>
          <div className="text-2xl font-bold text-green-600">{stats.conciliados}</div>
        </Card>
        <Card className="p-3">
          <div className="text-sm text-muted-foreground">Ignorados</div>
          <div className="text-2xl font-bold text-muted-foreground">{stats.ignorados}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Histórico de Extratos Importados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {contas.map((conta) => (
                  <SelectItem key={conta.id} value={conta.id}>
                    {conta.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="conciliado">Conciliado</SelectItem>
                <SelectItem value="ignorado">Ignorado</SelectItem>
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

            <MonthPicker
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />

            {/* Grouping selector */}
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
              <SelectTrigger className="w-[160px]">
                <Layers className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Agrupar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem agrupamento</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="tipo">Tipo</SelectItem>
                <SelectItem value="origem">Origem</SelectItem>
                <SelectItem value="conta">Conta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : extratosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum extrato encontrado</p>
              <p className="text-sm">Importe extratos via integração bancária ou manualmente</p>
            </div>
          ) : groupBy !== "none" && groupedExtratos ? (
            // Grouped view
            <div className="space-y-4">
              {Object.entries(groupedExtratos).map(([groupKey, items]) => (
                <Collapsible key={groupKey} defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <ChevronDown className="w-4 h-4 transition-transform [&[data-state=open]]:rotate-180" />
                    <span className="font-medium">{getGroupLabel(groupKey)}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {items.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {items.map((extrato) => renderExtratoItem(extrato))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            // Flat list view
            <div className="space-y-2">
              {paginatedExtratos.map((extrato) => renderExtratoItem(extrato))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, extratosFiltrados.length)} de {extratosFiltrados.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
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
        </CardContent>
      </Card>

      {/* Vincular Dialog */}
      {extratoParaVincular && (
        <VincularTransacaoDialog
          open={!!extratoParaVincular}
          onOpenChange={(open) => !open && setExtratoParaVincular(null)}
          extrato={{
            id: extratoParaVincular.id,
            descricao: extratoParaVincular.descricao,
            valor: extratoParaVincular.valor,
            tipo: extratoParaVincular.tipo,
            data_transacao: extratoParaVincular.data_transacao,
            reconciliado: extratoParaVincular.reconciliado,
            transacao_vinculada_id: extratoParaVincular.transacao_vinculada_id,
          }}
          onVinculado={handleVinculado}
        />
      )}

      {/* Transacao Vinculada Dialog */}
      <TransacaoVinculadaDialog
        open={!!transacaoParaVisualizar}
        onOpenChange={(open) => !open && setTransacaoParaVisualizar(null)}
        transacaoId={transacaoParaVisualizar}
      />
    </div>
  );
}
