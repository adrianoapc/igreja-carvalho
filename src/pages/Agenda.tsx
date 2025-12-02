import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, MapPin, ExternalLink, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isSameMonth, addMonths, startOfToday, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { cn } from "@/lib/utils";

interface Culto {
  id: string;
  titulo: string;
  tipo: string;
  data_culto: string;
  local: string | null;
  endereco: string | null;
  tema: string | null;
}

interface CultosGrouped {
  month: Date;
  monthLabel: string;
  cultos: Culto[];
}

export default function Agenda() {
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCultos();
  }, []);

  const fetchCultos = async () => {
    setLoading(true);
    try {
      const today = startOfToday();
      const threeMonthsLater = endOfMonth(addMonths(today, 3));
      
      const { data, error } = await supabase
        .from("cultos")
        .select("id, titulo, tipo, data_culto, local, endereco, tema")
        .gte("data_culto", today.toISOString())
        .lte("data_culto", threeMonthsLater.toISOString())
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
    switch (tipo.toLowerCase()) {
      case "culto de celebração":
      case "culto_domingo":
        return "bg-primary text-primary-foreground";
      case "culto de oração":
      case "culto_oracao":
        return "bg-amber-500 text-white";
      case "culto de ensino":
      case "culto_ensino":
        return "bg-emerald-500 text-white";
      case "culto de jovens":
      case "culto_jovens":
        return "bg-violet-500 text-white";
      case "santa ceia":
        return "bg-rose-500 text-white";
      case "batismo":
        return "bg-sky-500 text-white";
      case "evento especial":
        return "bg-orange-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getGoogleMapsUrl = (endereco: string | null, local: string | null) => {
    const searchQuery = endereco || local || "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
  };

  // Group cultos by month
  const groupedCultos: CultosGrouped[] = cultos.reduce((acc: CultosGrouped[], culto) => {
    const cultoDate = parseISO(culto.data_culto);
    const existingGroup = acc.find(group => isSameMonth(group.month, cultoDate));
    
    if (existingGroup) {
      existingGroup.cultos.push(culto);
    } else {
      acc.push({
        month: cultoDate,
        monthLabel: format(cultoDate, "MMMM 'de' yyyy", { locale: ptBR }),
        cultos: [culto]
      });
    }
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <main className="container max-w-2xl mx-auto px-4 py-8">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-6 bg-muted rounded w-48 mb-4"></div>
                <div className="flex gap-4">
                  <div className="w-14 h-14 bg-muted rounded-full"></div>
                  <div className="flex-1 h-24 bg-muted rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <PublicHeader />
      
      <main className="container max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Agenda de Eventos
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Próximos eventos dos próximos 3 meses
          </p>
        </div>

        {cultos.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum evento agendado</h3>
              <p className="text-muted-foreground text-sm">
                Não há eventos confirmados para os próximos dias.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {groupedCultos.map((group, groupIndex) => (
              <div key={group.monthLabel}>
                {/* Month Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-border"></div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-primary px-3 py-1 bg-primary/10 rounded-full">
                    {group.monthLabel}
                  </h2>
                  <div className="h-px flex-1 bg-border"></div>
                </div>

                {/* Events Timeline */}
                <div className="space-y-4">
                  {group.cultos.map((culto, index) => {
                    const cultoDate = parseISO(culto.data_culto);
                    const day = format(cultoDate, "d");
                    const weekDay = format(cultoDate, "EEEE", { locale: ptBR });
                    const time = format(cultoDate, "HH:mm");

                    return (
                      <div 
                        key={culto.id} 
                        className="flex gap-4 group"
                      >
                        {/* Date Circle */}
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl transition-all duration-300",
                            "bg-primary/10 text-primary border-2 border-primary/20",
                            "group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110"
                          )}>
                            {day}
                          </div>
                          {/* Timeline connector */}
                          {index < group.cultos.length - 1 && (
                            <div className="w-0.5 h-full min-h-[1rem] bg-border mt-2"></div>
                          )}
                        </div>

                        {/* Event Card */}
                        <Card className={cn(
                          "flex-1 overflow-hidden transition-all duration-300",
                          "hover:shadow-lg hover:-translate-y-1 cursor-pointer",
                          "border-l-4",
                          getTipoColor(culto.tipo).includes("primary") ? "border-l-primary" :
                          getTipoColor(culto.tipo).includes("amber") ? "border-l-amber-500" :
                          getTipoColor(culto.tipo).includes("emerald") ? "border-l-emerald-500" :
                          getTipoColor(culto.tipo).includes("violet") ? "border-l-violet-500" :
                          getTipoColor(culto.tipo).includes("rose") ? "border-l-rose-500" :
                          getTipoColor(culto.tipo).includes("sky") ? "border-l-sky-500" :
                          getTipoColor(culto.tipo).includes("orange") ? "border-l-orange-500" :
                          "border-l-muted-foreground"
                        )}>
                          <CardContent className="p-4">
                            {/* Event Title */}
                            <h3 className="font-bold text-lg text-primary mb-1 uppercase tracking-wide">
                              {culto.titulo}
                            </h3>
                            
                            {/* Date and Time */}
                            <p className="text-sm text-muted-foreground mb-3 capitalize">
                              {weekDay}, {format(cultoDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                              <span className="mx-2">•</span>
                              <Clock className="w-3 h-3 inline-block mr-1" />
                              {time}
                            </p>

                            {/* Location */}
                            {(culto.local || culto.endereco) && (
                              <a
                                href={getGoogleMapsUrl(culto.endereco, culto.local)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-primary transition-colors group/link"
                              >
                                <MapPin className="w-4 h-4 text-primary" />
                                <span className="flex flex-col">
                                  {culto.local && (
                                    <span className="font-semibold">{culto.local}</span>
                                  )}
                                  {culto.endereco && (
                                    <span className="text-xs text-muted-foreground group-hover/link:text-primary">
                                      {culto.endereco}
                                    </span>
                                  )}
                                </span>
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                              </a>
                            )}

                            {/* Theme badge if exists */}
                            {culto.tema && (
                              <div className="mt-3 pt-3 border-t border-border">
                                <span className="text-xs text-muted-foreground">Tema: </span>
                                <span className="text-sm font-medium">{culto.tema}</span>
                              </div>
                            )}

                            {/* Arrow indicator */}
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronRight className="w-5 h-5 text-primary" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer info */}
        {cultos.length > 0 && (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              {cultos.length} evento{cultos.length !== 1 ? 's' : ''} nos próximos 3 meses
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
