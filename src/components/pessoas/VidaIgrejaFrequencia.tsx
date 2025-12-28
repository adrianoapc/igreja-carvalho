import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  pessoaId: string;
}

interface Presenca {
  evento_id: string;
  created_at: string;
}

export function VidaIgrejaFrequencia({ pessoaId }: Props) {
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [totalCultos, setTotalCultos] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [pessoaId]);

  const loadData = async () => {
    try {
      const sixMonthsAgo = subMonths(new Date(), 6);

      // Buscar presenças do membro nos últimos 6 meses
      const { data: presencasData } = await supabase
        .from("presencas_culto")
        .select("evento_id, created_at")
        .eq("pessoa_id", pessoaId)
        .gte("created_at", sixMonthsAgo.toISOString());

      // Buscar total de cultos realizados nos últimos 6 meses
      const { count: cultosCount } = await supabase
        .from("eventos")
        .select("id", { count: "exact", head: true })
        .gte("data_evento", sixMonthsAgo.toISOString())
        .lte("data_evento", new Date().toISOString())
        .in("status", ["confirmado", "realizado"]);

      setPresencas(presencasData || []);
      setTotalCultos(cultosCount || 0);
    } catch (error) {
      console.error("Erro ao carregar frequência:", error);
    } finally {
      setLoading(false);
    }
  };

  const frequenciaPercentual = totalCultos > 0 
    ? Math.round((presencas.length / totalCultos) * 100) 
    : 0;

  // Gerar dados para o heatmap (últimos 6 meses)
  const generateHeatmapData = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const days = eachDayOfInterval({ start, end });

      const monthData = {
        month: format(monthDate, "MMM", { locale: ptBR }),
        year: format(monthDate, "yyyy"),
        days: days.map(day => {
          const hasPresenca = presencas.some(p => 
            isSameDay(new Date(p.created_at), day)
          );
          return {
            date: day,
            hasPresenca,
            dayOfWeek: getDay(day),
          };
        }),
      };
      months.push(monthData);
    }
    return months;
  };

  const heatmapData = generateHeatmapData();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Presenças</p>
                <p className="text-xl sm:text-2xl font-bold">{presencas.length}</p>
              </div>
              <CalendarDays className="w-7 h-7 sm:w-8 sm:h-8 text-primary/50 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Total de Cultos</p>
                <p className="text-xl sm:text-2xl font-bold">{totalCultos}</p>
              </div>
              <CalendarDays className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground/50 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-1">
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Frequência</p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <p className="text-xl sm:text-2xl font-bold">{frequenciaPercentual}%</p>
                  <Badge 
                    variant={frequenciaPercentual >= 70 ? "default" : frequenciaPercentual >= 50 ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {frequenciaPercentual >= 70 ? "Ótimo" : frequenciaPercentual >= 50 ? "Regular" : "Baixo"}
                  </Badge>
                </div>
              </div>
              {frequenciaPercentual >= 50 ? (
                <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-green-500/50 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-7 h-7 sm:w-8 sm:h-8 text-red-500/50 flex-shrink-0" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="text-sm sm:text-base">Histórico de Presenças (6 meses)</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0 overflow-x-auto pb-2">
          <div className="space-y-2 sm:space-y-3">
            {heatmapData.map((monthData, idx) => (
              <div key={idx} className="min-w-fit">
                <p className="text-xs font-medium text-muted-foreground mb-1.5 sm:mb-2 capitalize">
                  {monthData.month} {monthData.year}
                </p>
                <div className="flex gap-0.5 sm:gap-1 flex-wrap">
                  {monthData.days.map((day, dayIdx) => (
                    <div
                      key={dayIdx}
                      title={format(day.date, "dd/MM/yyyy")}
                      className={`w-3 h-3 sm:w-4 sm:h-4 rounded-sm transition-colors ${
                        day.hasPresenca
                          ? "bg-green-500 hover:bg-green-600"
                          : day.dayOfWeek === 0 // Domingo
                          ? "bg-muted hover:bg-muted/80 border border-dashed border-muted-foreground/30"
                          : "bg-muted/50"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-4 mt-3 sm:mt-4 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-green-500" />
              <span>Presente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-muted border border-dashed border-muted-foreground/30" />
              <span>Domingo</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-muted/50" />
              <span>Outros dias</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
