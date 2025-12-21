import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  User,
  Heart,
  Clock,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NovoEventoDialog } from "./NovoEventoDialog";
import { CompromissoDetailsDialog } from "./CompromissoDetailsDialog";

interface AtendimentoCalendar {
  id: string;
  data_agendamento: string;
  motivo_resumo: string | null;
  gravidade: string | null;
  status: string | null;
  pessoa?: { nome: string | null } | null;
  visitante?: { nome: string | null } | null;
}

interface CompromissoCalendar {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  tipo: string | null;
  cor: string | null;
  pastor_id: string;
  pastor?: { nome: string | null } | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  endDate?: Date;
  type: "atendimento" | "compromisso";
  gravidade?: string | null;
  cor?: string | null;
  tipoCompromisso?: string | null;
  raw: AtendimentoCalendar | CompromissoCalendar;
}

const GRAVIDADE_COLORS: Record<string, string> = {
  CRITICA: "border-l-red-500 bg-red-50 dark:bg-red-950/30",
  ALTA: "border-l-orange-500 bg-orange-50 dark:bg-orange-950/30",
  MEDIA: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30",
  BAIXA: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/30",
};

const COMPROMISSO_COLORS: Record<string, string> = {
  blue: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200",
  gray: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
  green: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200",
  red: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
  purple: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200",
};

export function PastoralCalendarView() {
  const { profile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPastorId, setSelectedPastorId] = useState<string | "TODOS">("TODOS");
  const [novoEventoDialogOpen, setNovoEventoDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedCompromisso, setSelectedCompromisso] = useState<CompromissoCalendar | null>(null);

  // Fetch pastores (apenas quem é pastor)
  const { data: pastores = [] } = useQuery({
    queryKey: ["pastores-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("e_pastor", true)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch atendimentos do mês
  const { data: atendimentos = [], isLoading: loadingAtendimentos } = useQuery({
    queryKey: ["atendimentos-calendar", format(currentMonth, "yyyy-MM"), selectedPastorId],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      let query = supabase
        .from("atendimentos_pastorais")
        .select(`
          id, data_agendamento, motivo_resumo, gravidade, status,
          pessoa:profiles!atendimentos_pastorais_pessoa_id_fkey(nome),
          visitante:visitantes_leads!atendimentos_pastorais_visitante_id_fkey(nome)
        `)
        .in("status", ["AGENDADO", "EM_ACOMPANHAMENTO"])
        .gte("data_agendamento", monthStart.toISOString())
        .lte("data_agendamento", monthEnd.toISOString())
        .order("data_agendamento");

      if (selectedPastorId !== "TODOS") {
        query = query.eq("pastor_responsavel_id", selectedPastorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AtendimentoCalendar[];
    },
  });

  // Fetch compromissos do mês
  const { data: compromissos = [], isLoading: loadingCompromissos } = useQuery({
    queryKey: ["compromissos-calendar", format(currentMonth, "yyyy-MM"), selectedPastorId],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      let query = supabase
        .from("agenda_pastoral")
        .select(`
          id, titulo, descricao, data_inicio, data_fim, tipo, cor, pastor_id,
          pastor:profiles!agenda_pastoral_pastor_id_fkey(nome)
        `)
        .gte("data_inicio", monthStart.toISOString())
        .lte("data_inicio", monthEnd.toISOString())
        .order("data_inicio");

      if (selectedPastorId !== "TODOS") {
        query = query.eq("pastor_id", selectedPastorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CompromissoCalendar[];
    },
  });

  // Combina eventos
  const events = useMemo<CalendarEvent[]>(() => {
    const atendimentoEvents: CalendarEvent[] = atendimentos
      .filter((a) => a.data_agendamento)
      .map((a) => ({
        id: a.id,
        title: `Atend: ${a.pessoa?.nome || a.visitante?.nome || "Sem nome"}`,
        date: parseISO(a.data_agendamento),
        type: "atendimento" as const,
        gravidade: a.gravidade,
        raw: a,
      }));

    const compromissoEvents: CalendarEvent[] = compromissos.map((c) => ({
      id: c.id,
      title: c.titulo,
      date: parseISO(c.data_inicio),
      endDate: parseISO(c.data_fim),
      type: "compromisso" as const,
      cor: c.cor,
      tipoCompromisso: c.tipo,
      raw: c,
    }));

    return [...atendimentoEvents, ...compromissoEvents].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, [atendimentos, compromissos]);

  // Gera dias do calendário
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  // Eventos por dia
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = format(event.date, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    });
    return map;
  }, [events]);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setNovoEventoDialogOpen(true);
  }, []);

  const handleCompromissoClick = useCallback((compromisso: CompromissoCalendar) => {
    setSelectedCompromisso(compromisso);
  }, []);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const isLoading = loadingAtendimentos || loadingCompromissos;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[180px] text-center">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} className="ml-2">
            Hoje
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={selectedPastorId}
            onValueChange={setSelectedPastorId}
          >
            <SelectTrigger className="w-[180px]">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar pastor..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os Pastores</SelectItem>
              {pastores.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => {
            setSelectedDate(new Date());
            setNovoEventoDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo
          </Button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-l-4 border-l-red-500 bg-red-50" />
          <span>Crítica</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-l-4 border-l-orange-500 bg-orange-50" />
          <span>Alta</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-100" />
          <span>Compromisso</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-100" />
          <span>Bloqueio</span>
        </div>
      </div>

      {/* Calendário */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Header dias da semana */}
          <div className="grid grid-cols-7 bg-muted">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(dayKey) || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "min-h-[100px] border-t border-r p-1 cursor-pointer hover:bg-muted/50 transition-colors",
                    !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                    isTodayDate && "bg-primary/5"
                  )}
                  onClick={() => handleDayClick(day)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                        isTodayDate && "bg-primary text-primary-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayEvents.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>

                  <ScrollArea className="h-[72px]">
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (event.type === "compromisso") {
                              handleCompromissoClick(event.raw as CompromissoCalendar);
                            }
                          }}
                          className={cn(
                            "text-xs p-1 rounded truncate cursor-pointer",
                            event.type === "atendimento" &&
                              cn(
                                "border-l-4",
                                GRAVIDADE_COLORS[event.gravidade || "BAIXA"]
                              ),
                            event.type === "compromisso" &&
                              COMPROMISSO_COLORS[event.cor || "blue"]
                          )}
                          title={event.title}
                        >
                          <div className="flex items-center gap-1">
                            {event.type === "atendimento" ? (
                              <Heart className="h-3 w-3 shrink-0" />
                            ) : (
                              <Clock className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate">{event.title}</span>
                          </div>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-1">
                          +{dayEvents.length - 3} mais
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <NovoEventoDialog
        open={novoEventoDialogOpen}
        onOpenChange={setNovoEventoDialogOpen}
        selectedDate={selectedDate}
        defaultPastorId={selectedPastorId !== "TODOS" ? selectedPastorId : undefined}
      />

      <CompromissoDetailsDialog
        compromisso={selectedCompromisso}
        open={!!selectedCompromisso}
        onOpenChange={(open) => !open && setSelectedCompromisso(null)}
      />
    </div>
  );
}
