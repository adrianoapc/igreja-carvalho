import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  format,
  isAfter,
  isBefore,
  startOfMonth,
  endOfMonth,
  addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  List,
  CalendarDays,
  ExternalLink,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  CalendarCheck,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import EventoDialog from "@/components/cultos/EventoDialog";
import CalendarioMensal from "@/components/cultos/CalendarioMensal";

interface Evento {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  duracao_minutos: number | null;
  local: string | null;
  endereco: string | null;
  pregador: string | null;
  tema: string | null;
  status: string;
  created_at: string;
}

const STATUS_CONFIG = {
  planejado: {
    label: "Planejado",
    color:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  confirmado: {
    label: "Confirmado",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  },
  realizado: {
    label: "Realizado",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  },
  cancelado: {
    label: "Cancelado",
    color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  },
};

const TIPO_CONFIG = {
  CULTO: {
    label: "Culto",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  },
  EVENTO: {
    label: "Evento",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  },
  RELOGIO: {
    label: "Relógio",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  },
  TAREFA: {
    label: "Tarefa",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
  },
  OUTRO: {
    label: "Outro",
    color:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  },
};

export default function Eventos() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventoDialogOpen, setEventoDialogOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(undefined);

  // KPIs
  const [kpis, setKpis] = useState({
    eventosMes: 0,
    proximoEvento: null as Evento | null,
    escalasPendentes: 0,
  });

  useEffect(() => {
    loadEventos();
    loadKPIs();
  }, []);

  const loadEventos = async () => {
    try {
      const { data, error } = await supabase
        .from("eventos")
        .select("*")
        .order("data_evento", { ascending: true });

      if (error) throw error;

      setEventos((data || []) as Evento[]);
    } catch (error: unknown) {
      toast.error("Erro ao carregar eventos", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    try {
      const now = new Date();
      const startOfCurrentMonth = startOfMonth(now);
      const endOfCurrentMonth = endOfMonth(now);

      // Eventos do mês
      const { count: eventosMes } = await supabase
        .from("eventos")
        .select("*", { count: "exact", head: true })
        .gte("data_evento", startOfCurrentMonth.toISOString())
        .lte("data_evento", endOfCurrentMonth.toISOString());

      // Próximo evento
      const { data: proximoEvento } = await supabase
        .from("eventos")
        .select("*")
        .gte("data_evento", now.toISOString())
        .order("data_evento", { ascending: true })
        .limit(1)
        .single();

      // Escalas pendentes (simplificado - eventos sem escalas completas)
      const { count: escalasPendentes } = await supabase
        .from("eventos")
        .select("*", { count: "exact", head: true })
        .eq("status", "planejado");

      setKpis({
        eventosMes: eventosMes || 0,
        proximoEvento: proximoEvento || null,
        escalasPendentes: escalasPendentes || 0,
      });
    } catch (error) {
      console.error("Erro ao carregar KPIs:", error);
    }
  };

  const filteredEventos = eventos.filter((evento) => {
    const matchesSearch =
      evento.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evento.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evento.local?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo = tipoFilter === "todos" || evento.tipo === tipoFilter;
    const matchesStatus =
      statusFilter === "todos" || evento.status === statusFilter;

    const matchesDate =
      (!dateRange.from ||
        !isBefore(new Date(evento.data_evento), dateRange.from)) &&
      (!dateRange.to || !isAfter(new Date(evento.data_evento), dateRange.to));

    return matchesSearch && matchesTipo && matchesStatus && matchesDate;
  });

  const handleNovoEvento = () => {
    setEditingEvento(null);
    setEventoDialogOpen(true);
  };

  const handleEditarEvento = (evento: Evento) => {
    setEditingEvento(evento);
    setEventoDialogOpen(true);
  };

  const handleExcluirEvento = async (evento: Evento) => {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;

    try {
      const { error } = await supabase
        .from("eventos")
        .delete()
        .eq("id", evento.id);

      if (error) throw error;

      toast.success("Evento excluído com sucesso");
      loadEventos();
      loadKPIs();
    } catch (error: unknown) {
      toast.error("Erro ao excluir evento", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleAbrirEvento = (evento: Evento) => {
    navigate(`/eventos/${evento.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Eventos</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Eventos
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie cultos e eventos programados
          </p>
        </div>
        <Button
          className="bg-gradient-primary shadow-soft w-full sm:w-auto"
          onClick={handleNovoEvento}
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Novo Evento</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Eventos no Mês
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.eventosMes}</div>
            <p className="text-xs text-muted-foreground">
              Eventos programados para este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximo Evento
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpis.proximoEvento ? (
              <div>
                <div className="text-2xl font-bold">
                  {kpis.proximoEvento.titulo}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(
                    new Date(kpis.proximoEvento.data_evento),
                    "dd/MM/yyyy",
                    { locale: ptBR }
                  )}
                </p>
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">
                Nenhum
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Escalas Pendentes
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.escalasPendentes}</div>
            <p className="text-xs text-muted-foreground">
              Eventos aguardando escalas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar eventos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="CULTO">Culto</SelectItem>
                  <SelectItem value="EVENTO">Evento</SelectItem>
                  <SelectItem value="RELOGIO">Relógio</SelectItem>
                  <SelectItem value="TAREFA">Tarefa</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="planejado">Planejado</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yy")} -{" "}
                          {format(dateRange.to, "dd/MM/yy")}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      "Data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range as { from: Date; to: Date } | undefined)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Lista</span>
          </TabsTrigger>
          <TabsTrigger value="calendario" className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Calendário</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4">
          {isMobile ? (
            // Mobile List
            <div className="space-y-3">
              {filteredEventos.map((evento) => {
                const dataEvento = new Date(evento.data_evento);
                const statusConfig =
                  STATUS_CONFIG[evento.status as keyof typeof STATUS_CONFIG] ||
                  STATUS_CONFIG.planejado;
                const tipoConfig =
                  TIPO_CONFIG[evento.tipo as keyof typeof TIPO_CONFIG] ||
                  TIPO_CONFIG.OUTRO;

                return (
                  <Card key={evento.id} className="shadow-soft">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">
                            {evento.titulo}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={tipoConfig.color}>
                              {tipoConfig.label}
                            </Badge>
                            <Badge className={statusConfig.color}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleAbrirEvento(evento)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditarEvento(evento)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExcluirEvento(evento)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {format(dataEvento, "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {format(dataEvento, "HH:mm")}
                          {evento.duracao_minutos &&
                            ` (${evento.duracao_minutos} min)`}
                        </div>
                        {evento.local && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span className="truncate">{evento.local}</span>
                          </div>
                        )}
                      </div>

                      {evento.descricao && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                          {evento.descricao}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            // Desktop DataTable
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="w-[70px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEventos.map((evento) => {
                    const dataEvento = new Date(evento.data_evento);
                    const statusConfig =
                      STATUS_CONFIG[
                        evento.status as keyof typeof STATUS_CONFIG
                      ] || STATUS_CONFIG.planejado;
                    const tipoConfig =
                      TIPO_CONFIG[evento.tipo as keyof typeof TIPO_CONFIG] ||
                      TIPO_CONFIG.OUTRO;

                    return (
                      <TableRow
                        key={evento.id}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell>
                          {format(dataEvento, "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {format(dataEvento, "HH:mm")}
                          {evento.duracao_minutos && (
                            <span className="text-muted-foreground ml-1">
                              ({evento.duracao_minutos}min)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {evento.titulo}
                        </TableCell>
                        <TableCell>
                          <Badge className={tipoConfig.color}>
                            {tipoConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="truncate max-w-[200px]">
                          {evento.local || "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleAbrirEvento(evento)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditarEvento(evento)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleExcluirEvento(evento)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {filteredEventos.length === 0 && (
                <div className="text-center py-8">
                  <CalendarIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Nenhum evento encontrado
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Tente ajustar os filtros ou crie um novo evento.
                  </p>
                  <Button onClick={handleNovoEvento}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Evento
                  </Button>
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <CalendarioMensal
            cultos={filteredEventos as any}
            escalasCount={{}}
            onCultoClick={(e) => handleAbrirEvento(e as any)}
          />
        </TabsContent>
      </Tabs>

      <EventoDialog
        open={eventoDialogOpen}
        onOpenChange={setEventoDialogOpen}
        evento={editingEvento as any}
        onSuccess={() => {
          loadEventos();
          loadKPIs();
        }}
      />
    </div>
  );
}
