import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, isSameMonth, isSameDay, startOfWeek, endOfWeek, addDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PublicHeader } from "@/components/layout/PublicHeader";

interface Culto {
  id: string;
  titulo: string;
  tipo: string;
  data_culto: string;
  local: string | null;
  endereco: string | null;
  tema: string | null;
}

export default function Agenda() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchCultos();
  }, [currentMonth]);

  const fetchCultos = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      const { data, error } = await supabase
        .from("cultos")
        .select("id, titulo, tipo, data_culto, local, endereco, tema")
        .gte("data_culto", start.toISOString())
        .lte("data_culto", end.toISOString())
        .eq("status", "confirmado")
        .order("data_culto", { ascending: true });

      if (error) throw error;
      setCultos(data || []);
    } catch (error) {
      console.error("Error fetching cultos:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "culto_domingo": return "bg-primary text-primary-foreground";
      case "culto_semana": return "bg-accent text-accent-foreground";
      case "evento_especial": return "bg-destructive/80 text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "culto_domingo": return "Dominical";
      case "culto_semana": return "Semana";
      case "evento_especial": return "Especial";
      case "celebracao": return "Celebração";
      default: return tipo;
    }
  };

  const getGoogleMapsUrl = (endereco: string | null, local: string | null) => {
    const searchQuery = endereco || local || "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
  };

  const getCultosForDate = (date: Date) => {
    return cultos.filter(culto => isSameDay(parseISO(culto.data_culto), date));
  };

  const renderCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      const currentDay = day;
      const cultosOfDay = getCultosForDate(currentDay);
      const isCurrentMonth = isSameMonth(currentDay, currentMonth);
      const isSelected = selectedDate && isSameDay(currentDay, selectedDate);
      const isTodayDate = isToday(currentDay);

      days.push(
        <button
          key={currentDay.toISOString()}
          onClick={() => setSelectedDate(currentDay)}
          className={`
            aspect-square p-1 rounded-lg text-sm font-medium transition-all relative
            ${!isCurrentMonth ? "text-muted-foreground/40" : "text-foreground"}
            ${isSelected ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" : "hover:bg-muted"}
            ${isTodayDate && !isSelected ? "bg-accent text-accent-foreground font-bold" : ""}
          `}
        >
          <span>{format(currentDay, "d")}</span>
          {cultosOfDay.length > 0 && (
            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
              {cultosOfDay.slice(0, 3).map((_, i) => (
                <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-primary"}`} />
              ))}
            </div>
          )}
        </button>
      );
      day = addDays(day, 1);
    }

    return days;
  };

  const selectedCultos = selectedDate ? getCultosForDate(selectedDate) : [];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showBackButton title="Agenda" subtitle="Cultos e eventos" />

      <div className="container mx-auto px-4 py-6">
        {/* Calendar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-lg font-semibold capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {renderCalendarDays()}
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Events */}
        {selectedDate && (
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-3 capitalize">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            {selectedCultos.length > 0 ? (
              <div className="space-y-3">
                {selectedCultos.map(culto => (
                  <Card key={culto.id}>
                    <CardContent className="p-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${getTipoColor(culto.tipo)}`}>
                        {getTipoLabel(culto.tipo)}
                      </span>
                      <h4 className="font-semibold text-foreground">{culto.titulo}</h4>
                      {culto.tema && <p className="text-sm text-muted-foreground">{culto.tema}</p>}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(culto.data_culto), "HH:mm")}
                        </div>
                        {culto.local && (
                          <a 
                            href={getGoogleMapsUrl(culto.endereco, culto.local)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <MapPin className="w-3 h-3" />
                            {culto.local}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-6 text-center">
                  <Calendar className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Nenhum evento neste dia</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* All Month Events */}
        <div>
          <h3 className="font-semibold text-foreground mb-3">Eventos do mês</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                    <div className="h-5 bg-muted rounded w-1/2 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : cultos.length > 0 ? (
            <div className="space-y-3">
              {cultos.map(culto => (
                <Card 
                  key={culto.id} 
                  className="overflow-hidden hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedDate(parseISO(culto.data_culto))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="text-center shrink-0 w-14">
                        <p className="text-2xl font-bold text-primary">
                          {format(parseISO(culto.data_culto), "dd")}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {format(parseISO(culto.data_culto), "EEE", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${getTipoColor(culto.tipo)}`}>
                          {getTipoLabel(culto.tipo)}
                        </span>
                        <h4 className="font-semibold text-foreground truncate">{culto.titulo}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(culto.data_culto), "HH:mm")}
                          </div>
                          {culto.local && (
                            <a 
                              href={getGoogleMapsUrl(culto.endereco, culto.local)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 truncate text-primary hover:underline"
                            >
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{culto.local}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-8 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum evento programado para este mês</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
