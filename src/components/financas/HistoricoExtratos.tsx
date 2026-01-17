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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  CalendarIcon,
  Link2,
  Link2Off,
  Eye,
  RotateCcw,
  Ban,
  Loader2,
  FileText,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VincularTransacaoDialog } from "./VincularTransacaoDialog";
import { TransacaoVinculadaDialog } from "./TransacaoVinculadaDialog";

interface ExtratoItem {
  id: string;
  conta_id: string;
  data: string;
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

export function HistoricoExtratos() {
  const { igrejaId, filialId } = useAuthContext();
  const queryClient = useQueryClient();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [contaSelecionada, setContaSelecionada] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");
  const [origemFiltro, setOrigemFiltro] = useState<string>("all");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

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
    queryKey: ["extratos-historico", igrejaId, filialId, contaSelecionada, dataInicio, dataFim],
    queryFn: async () => {
      let query = supabase
        .from("extratos_bancarios")
        .select(`
          id,
          conta_id,
          data,
          descricao,
          valor,
          tipo,
          reconciliado,
          transacao_vinculada_id,
          origem,
          external_id,
          conta:contas(nome, banco)
        `)
        .order("data", { ascending: false });

      if (contaSelecionada && contaSelecionada !== "all") {
        query = query.eq("conta_id", contaSelecionada);
      }

      if (dataInicio) {
        query = query.gte("data", format(dataInicio, "yyyy-MM-dd"));
      }

      if (dataFim) {
        query = query.lte("data", format(dataFim, "yyyy-MM-dd"));
      }

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

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {dataInicio ? format(dataInicio, "dd/MM") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {dataFim ? format(dataFim, "dd/MM") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFim}
                  onSelect={setDataFim}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            {(dataInicio || dataFim) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDataInicio(undefined);
                  setDataFim(undefined);
                }}
              >
                Limpar datas
              </Button>
            )}
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
          ) : (
            <div className="space-y-2">
              {extratosFiltrados.map((extrato) => {
                const status = getStatusInfo(extrato);
                const isLoading = actionLoading === extrato.id;

                return (
                  <div
                    key={extrato.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{extrato.descricao}</span>
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
                        <span>{format(parseISO(extrato.data), "dd/MM/yyyy", { locale: ptBR })}</span>
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
                          extrato.tipo === "credito" ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {extrato.tipo === "credito" ? "+" : "-"}
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
                              disabled={isLoading}
                            >
                              <Link2 className="w-4 h-4 mr-1" />
                              Vincular
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleIgnorar(extrato)}
                              disabled={isLoading}
                            >
                              {isLoading ? (
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
                              disabled={isLoading}
                            >
                              {isLoading ? (
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
                            disabled={isLoading}
                          >
                            {isLoading ? (
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
              })}
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
            data_transacao: extratoParaVincular.data,
            reconciliado: extratoParaVincular.reconciliado,
            transacao_vinculada_id: extratoParaVincular.transacao_vinculada_id,
          }}
          transacoesDisponiveis={transacoes.map((t: any) => ({
            id: t.id,
            descricao: t.descricao,
            valor: t.valor,
            tipo: t.tipo,
            data_pagamento: t.data_pagamento,
            categorias_financeiras: t.categoria ? { nome: t.categoria.nome } : null,
          }))}
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
