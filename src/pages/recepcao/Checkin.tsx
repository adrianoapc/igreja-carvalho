import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Camera,
  QrCode,
  AlertCircle,
  Info,
  BookOpen,
  Sparkles,
  Clock,
  ClipboardList,
  Calendar,
} from "lucide-react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckinScanner } from "@/components/eventos/CheckinScanner";
import { CheckinManualSearch } from "@/components/eventos/CheckinManualSearch";
import { CheckinRecentList } from "@/components/eventos/CheckinRecentList";
import { cn } from "@/lib/utils";

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
  tipo: string | null;
  totalInscritos: number;
}

const TIPO_CONFIG: Record<
  string,
  { icon: React.ElementType; bg: string; text: string; label: string }
> = {
  CULTO: {
    icon: BookOpen,
    bg: "bg-blue-500",
    text: "text-blue-700",
    label: "Culto",
  },
  EVENTO: {
    icon: Sparkles,
    bg: "bg-violet-500",
    text: "text-violet-700",
    label: "Evento",
  },
  RELOGIO: {
    icon: Clock,
    bg: "bg-orange-500",
    text: "text-orange-700",
    label: "Agenda",
  },
  TAREFA: {
    icon: ClipboardList,
    bg: "bg-slate-500",
    text: "text-slate-700",
    label: "Tarefa",
  },
  OUTRO: {
    icon: Calendar,
    bg: "bg-gray-500",
    text: "text-gray-700",
    label: "Outro",
  },
};

const getTipoConfig = (tipo: string | null) =>
  TIPO_CONFIG[tipo ?? ""] ?? TIPO_CONFIG.OUTRO;

export default function RecepcaoCheckin() {
  const navigate = useNavigate();
  const { igrejaId, filialId, isAllFiliais } = useAuthContext();
  const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(null);
  const [scannerAberto, setScannerAberto] = useState(false);

  const { data: eventos, isLoading } = useQuery({
    queryKey: ["recepcao-eventos", igrejaId, filialId],
    queryFn: async () => {
      if (!igrejaId) return [];

      const agora = new Date();
      const inicio = new Date(agora);
      inicio.setDate(inicio.getDate() - 14);
      const fim = new Date(agora);
      fim.setDate(fim.getDate() + 30);

      let query = supabase
        .from("eventos")
        .select("id, titulo, data_evento, tipo")
        .eq("igreja_id", igrejaId)
        .gte("data_evento", inicio.toISOString())
        .lte("data_evento", fim.toISOString())
        .order("data_evento", { ascending: false });

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data: todosEventos, error } = await query;
      if (error) throw error;
      if (!todosEventos?.length) return [];

      // Busca contagem de inscrições para esses eventos
      const { data: inscricoes } = await supabase
        .from("inscricoes_eventos")
        .select("evento_id")
        .in("evento_id", todosEventos.map((e) => e.id))
        .is("cancelado_em", null);

      const countMap: Record<string, number> = {};
      inscricoes?.forEach((i) => {
        countMap[i.evento_id] = (countMap[i.evento_id] ?? 0) + 1;
      });

      // Retorna só eventos com ao menos uma inscrição
      return todosEventos
        .filter((e) => (countMap[e.id] ?? 0) > 0)
        .map((e) => ({ ...e, totalInscritos: countMap[e.id] ?? 0 })) as Evento[];
    },
    enabled: !!igrejaId,
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["recepcao-checkin-stats", eventoSelecionado?.id],
    queryFn: async () => {
      if (!eventoSelecionado) return null;
      const [{ count: total }, { count: presentes }] = await Promise.all([
        supabase
          .from("inscricoes_eventos")
          .select("*", { count: "exact", head: true })
          .eq("evento_id", eventoSelecionado.id)
          .is("cancelado_em", null),
        supabase
          .from("inscricoes_eventos")
          .select("*", { count: "exact", head: true })
          .eq("evento_id", eventoSelecionado.id)
          .not("checkin_validado_em", "is", null),
      ]);
      return { total: total ?? 0, presentes: presentes ?? 0 };
    },
    enabled: !!eventoSelecionado,
    refetchInterval: 5000,
  });

  // ── SELETOR DE EVENTO ────────────────────────────────────────────────────
  if (!eventoSelecionado) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/recepcao")}
            className="mb-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Recepção
          </Button>
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Check-in</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione o evento para iniciar
          </p>
        </div>

        <div className="p-4 max-w-sm mx-auto space-y-3">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))
          ) : eventos && eventos.length > 0 ? (
            eventos.map((evento) => {
              const data = new Date(evento.data_evento);
              const ehHoje = isToday(data);
              const cfg = getTipoConfig(evento.tipo);
              const Icon = cfg.icon;

              return (
                <Card
                  key={evento.id}
                  className={cn(
                    "cursor-pointer hover:shadow-md transition-all active:scale-[0.99]",
                    ehHoje && "ring-2 ring-primary/40",
                  )}
                  onClick={() => setEventoSelecionado(evento)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white",
                        cfg.bg,
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-semibold truncate">{evento.titulo}</p>
                        {ehHoje && (
                          <Badge variant="default" className="shrink-0 text-xs">
                            Hoje
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {format(data, "EEEE, d 'de' MMMM · HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn("shrink-0 text-xs font-medium", cfg.text)}
                    >
                      {evento.totalInscritos}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-14 text-muted-foreground">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Nenhum evento com inscrições</p>
              <p className="text-xs mt-1 opacity-70">
                Apenas eventos com pessoas inscritas aparecem aqui
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CONSOLE DE CHECK-IN ──────────────────────────────────────────────────
  const dataEvento = new Date(eventoSelecionado.data_evento);
  const cfg = getTipoConfig(eventoSelecionado.tipo);
  const Icon = cfg.icon;
  const semInscritos =
    stats !== undefined && stats !== null && stats.total === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEventoSelecionado(null)}
          className="mb-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Trocar evento
        </Button>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white",
                cfg.bg,
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">
                {eventoSelecionado.titulo}
              </h1>
              <p className="text-xs text-muted-foreground capitalize">
                {format(dataEvento, "EEEE, d 'de' MMMM · HH:mm", {
                  locale: ptBR,
                })}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setScannerAberto(true)}
            disabled={semInscritos}
          >
            <Camera className="w-4 h-4" />
            Escanear
          </Button>
        </div>
      </div>

      <div className="p-4 max-w-sm mx-auto space-y-4">
        {semInscritos && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex gap-3 items-start">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Nenhuma inscrição cadastrada
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Para registrar presença sem inscrição, use{" "}
                  <button
                    className="underline font-medium"
                    onClick={() => navigate("/recepcao/frequentador")}
                  >
                    Registrar Frequentador
                  </button>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {stats !== null && stats !== undefined && stats.total > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Inscritos</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-green-700">
                  {stats.presentes}
                </p>
                <p className="text-xs text-green-600 mt-0.5">Presentes</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">
                  {stats.total - stats.presentes}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">Pendentes</p>
              </CardContent>
            </Card>
          </div>
        )}

        <CheckinManualSearch
          eventoId={eventoSelecionado.id}
          onCheckinSuccess={() => refetchStats()}
        />

        <CheckinRecentList eventoId={eventoSelecionado.id} />
      </div>

      <CheckinScanner
        open={scannerAberto}
        onClose={() => setScannerAberto(false)}
        eventoId={eventoSelecionado.id}
        onSuccess={() => refetchStats()}
      />
    </div>
  );
}
