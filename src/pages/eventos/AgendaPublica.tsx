import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  ChevronLeft, 
  ChevronRight,
  Users,
  Ticket,
  CalendarDays,
  Sparkles
} from "lucide-react";
import { format, isSameDay, isAfter, startOfDay, addMonths, subMonths, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContextProvider";

interface Evento {
  id: string;
  tipo: "CULTO" | "EVENTO" | "OUTRO" | "RELOGIO" | "TAREFA";
  titulo: string;
  descricao: string | null;
  data_evento: string;
  duracao_minutos: number | null;
  local: string | null;
  endereco: string | null;
  status: string;
  requer_inscricao: boolean | null;
  vagas_limite: number | null;
}

const TIPO_ICONS: Record<string, React.ReactNode> = {
  CULTO: <Sparkles className="h-4 w-4" />,
  EVENTO: <CalendarDays className="h-4 w-4" />,
  RELOGIO: <Clock className="h-4 w-4" />,
  TAREFA: <Users className="h-4 w-4" />,
  OUTRO: <CalendarIcon className="h-4 w-4" />,
};

const TIPO_LABELS: Record<string, string> = {
  CULTO: "Culto",
  EVENTO: "Evento",
  RELOGIO: "Relógio de Oração",
  TAREFA: "Tarefa",
  OUTRO: "Outro",
};

export default function AgendaPublica() {
  const navigate = useNavigate();
  const { igrejaId, filialId, isAllFiliais } = useAuthContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["agenda-publica", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      let query = supabase
        .from("eventos")
        .select("id, tipo, titulo, descricao, data_evento, duracao_minutos, local, endereco, status, requer_inscricao, vagas_limite")
        .in("status", ["planejado", "confirmado"])
        .gte("data_evento", new Date().toISOString())
        .order("data_evento", { ascending: true });

      if (igrejaId) {
        query = query.eq("igreja_id", igrejaId);
      }
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Evento[];
    },
    enabled: !!igrejaId,
  });

  // Group events by date
  const eventosPorDia = useMemo(() => {
    const map: Record<string, Evento[]> = {};
    eventos.forEach((evento) => {
      const key = format(parseISO(evento.data_evento), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(evento);
    });
    return map;
  }, [eventos]);

  // Get upcoming events (next 7 days)
  const proximosEventos = useMemo(() => {
    const today = startOfDay(new Date());
    return eventos.filter((e) => {
      const eventDate = parseISO(e.data_evento);
      const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });
  }, [eventos]);

  // Filter events for selected date or current month
  const eventosExibidos = useMemo(() => {
    if (selectedDate) {
      const key = format(selectedDate, "yyyy-MM-dd");
      return eventosPorDia[key] || [];
    }
    return eventos.filter((e) => isSameMonth(parseISO(e.data_evento), currentMonth));
  }, [selectedDate, eventosPorDia, eventos, currentMonth]);

  const handleEventClick = (evento: Evento) => {
    navigate(`/eventos/${evento.id}`);
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <CalendarDays className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground">Próximos eventos da nossa igreja</p>
        </div>
      </div>

      {/* Próximos Eventos Destaque */}
      {proximosEventos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Próximos 7 dias
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {proximosEventos.slice(0, 5).map((evento) => {
              const dataEvento = parseISO(evento.data_evento);
              const isToday = isSameDay(dataEvento, new Date());
              
              return (
                <button
                  key={evento.id}
                  onClick={() => handleEventClick(evento)}
                  className={cn(
                    "flex-shrink-0 w-36 p-3 rounded-xl text-left transition-all",
                    "border bg-card hover:bg-accent/50 hover:border-primary/50",
                    isToday && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "text-2xl font-bold",
                      isToday ? "text-primary" : "text-foreground"
                    )}>
                      {format(dataEvento, "dd")}
                    </span>
                    <div className="text-xs text-muted-foreground leading-tight">
                      <div className="font-medium">{format(dataEvento, "EEE", { locale: ptBR })}</div>
                      <div>{format(dataEvento, "MMM", { locale: ptBR })}</div>
                    </div>
                  </div>
                  <p className="text-sm font-medium truncate">{evento.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(dataEvento, "HH:mm")}
                  </p>
                  {isToday && (
                    <Badge variant="default" className="mt-2 text-[10px]">
                      Hoje
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Navegação do Mês */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setCurrentMonth(subMonths(currentMonth, 1));
              setSelectedDate(null);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => {
              setCurrentMonth(new Date());
              setSelectedDate(null);
            }}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setCurrentMonth(addMonths(currentMonth, 1));
              setSelectedDate(null);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mini Calendário Visual */}
      <MiniCalendario
        currentMonth={currentMonth}
        eventosPorDia={eventosPorDia}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {/* Lista de Eventos */}
      <div className="space-y-3">
        {selectedDate && (
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setSelectedDate(null)}
            >
              Ver todos
            </Button>
          </div>
        )}

        {eventosExibidos.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {selectedDate
                  ? "Nenhum evento nesta data"
                  : "Nenhum evento programado para este mês"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {eventosExibidos.map((evento) => (
              <EventoCard
                key={evento.id}
                evento={evento}
                onClick={() => handleEventClick(evento)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Mini Calendário Component
function MiniCalendario({
  currentMonth,
  eventosPorDia,
  selectedDate,
  onSelectDate,
}: {
  currentMonth: Date;
  eventosPorDia: Record<string, Evento[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}) {
  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];
  
  const days = useMemo(() => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDay = start.getDay();
    const daysInMonth = end.getDate();
    
    const result: (Date | null)[] = [];
    
    // Empty slots before first day
    for (let i = 0; i < startDay; i++) {
      result.push(null);
    }
    
    // Days of month
    for (let i = 1; i <= daysInMonth; i++) {
      result.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }
    
    return result;
  }, [currentMonth]);

  return (
    <div className="bg-card rounded-xl border p-3">
      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day, i) => (
          <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>
      
      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }
          
          const dateKey = format(day, "yyyy-MM-dd");
          const hasEvents = !!eventosPorDia[dateKey]?.length;
          const eventCount = eventosPorDia[dateKey]?.length || 0;
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isPast = day < startOfDay(new Date());
          
          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(isSelected ? null : day)}
              disabled={isPast && !hasEvents}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all relative",
                isPast && !hasEvents && "text-muted-foreground/40 cursor-not-allowed",
                !isPast && "hover:bg-accent",
                isToday && "font-bold",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                hasEvents && !isSelected && "font-semibold"
              )}
            >
              <span className={cn(
                isToday && !isSelected && "text-primary"
              )}>
                {format(day, "d")}
              </span>
              {hasEvents && (
                <div className={cn(
                  "flex gap-0.5 mt-0.5",
                  isSelected && "opacity-80"
                )}>
                  {Array.from({ length: Math.min(eventCount, 3) }).map((_, j) => (
                    <div
                      key={j}
                      className={cn(
                        "w-1 h-1 rounded-full",
                        isSelected ? "bg-primary-foreground" : "bg-primary"
                      )}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Evento Card Component
function EventoCard({ evento, onClick }: { evento: Evento; onClick: () => void }) {
  const dataEvento = parseISO(evento.data_evento);
  const isToday = isSameDay(dataEvento, new Date());

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
        isToday && "border-primary/50 bg-primary/5"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Date Badge */}
          <div className={cn(
            "flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center",
            isToday ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <span className="text-lg font-bold leading-none">
              {format(dataEvento, "dd")}
            </span>
            <span className="text-[10px] uppercase mt-0.5">
              {format(dataEvento, "MMM", { locale: ptBR })}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{evento.titulo}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{format(dataEvento, "HH:mm")}</span>
                  {evento.duracao_minutos && (
                    <span className="text-xs">({evento.duracao_minutos}min)</span>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="flex-shrink-0 gap-1">
                {TIPO_ICONS[evento.tipo]}
                <span className="hidden sm:inline">{TIPO_LABELS[evento.tipo]}</span>
              </Badge>
            </div>

            {evento.local && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{evento.local}</span>
              </div>
            )}

            {evento.requer_inscricao && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs gap-1">
                  <Ticket className="h-3 w-3" />
                  Inscrição necessária
                  {evento.vagas_limite && ` • ${evento.vagas_limite} vagas`}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
