import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameMonth, 
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  planejado: "bg-yellow-500 hover:bg-yellow-600",
  confirmado: "bg-green-500 hover:bg-green-600",
  realizado: "bg-blue-500 hover:bg-blue-600",
  cancelado: "bg-red-400 hover:bg-red-500 opacity-60"
};

interface Culto {
  id: string;
  tipo: string;
  titulo: string;
  data_culto: string;
  status: string;
}

interface CalendarioMensalProps {
  cultos: Culto[];
  escalasCount: Record<string, number>;
  onCultoClick: (culto: Culto) => void;
}

export default function CalendarioMensal({ cultos, escalasCount, onCultoClick }: CalendarioMensalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: ptBR });
    const end = endOfWeek(endOfMonth(currentMonth), { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const cultosPorDia = useMemo(() => {
    const map: Record<string, Culto[]> = {};
    cultos.forEach((culto) => {
      const date = new Date(culto.data_culto);
      const key = format(date, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(culto);
    });
    return map;
  }, [cultos]);

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  return (
    <div className="space-y-4">
      {/* Navegação do Calendário */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg md:text-xl font-semibold">
          {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleToday}
            className="text-xs"
          >
            Hoje
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={handlePreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid do Calendário */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          {/* Cabeçalho com dias da semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div 
                key={day} 
                className="text-center text-xs font-semibold text-muted-foreground p-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayCultos = cultosPorDia[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border rounded-lg",
                    "transition-colors",
                    !isCurrentMonth && "bg-muted/30",
                    isToday && "border-primary bg-primary/5",
                    dayCultos.length > 0 && "cursor-pointer hover:bg-accent/50"
                  )}
                >
                  {/* Número do dia */}
                  <div className={cn(
                    "text-xs font-medium mb-1",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isToday && "text-primary font-bold"
                  )}>
                    {format(day, "d")}
                  </div>

                  {/* Cultos do dia */}
                  <div className="space-y-1">
                    {dayCultos.map((culto) => {
                      const count = escalasCount[culto.id] || 0;
                      const statusColor = STATUS_COLORS[culto.status] || "bg-gray-500";
                      return (
                        <button
                          key={culto.id}
                          onClick={() => onCultoClick(culto)}
                          className={cn(
                            "w-full text-left p-1 rounded text-xs",
                            "text-white",
                            statusColor,
                            "transition-all",
                            "shadow-sm"
                          )}
                        >
                          <div className="font-medium truncate text-[10px] sm:text-xs">
                            {culto.titulo || culto.tipo}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span className="text-[9px] sm:text-[10px]">{count}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border border-primary bg-primary/5" />
          <span>Hoje</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span>Planejado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Confirmado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Realizado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-400 opacity-60" />
          <span>Cancelado</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3" />
          <span>Pessoas escaladas</span>
        </div>
      </div>
    </div>
  );
}
