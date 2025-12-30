// ARQUIVO: src/pages/eventos/Geral.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRelogioAgora } from "@/hooks/useRelogioAgora";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  CalendarDays,
  Users,
  ArrowRight,
  Clock,
  MapPin,
  CalendarCheck,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Flame,
  User,
  LayoutTemplate,
  Plus,
  Send,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NextEvent {
  id: string;
  titulo: string;
  data_evento: string;
  tipo: string;
  local: string | null;
  hora: string;
}

interface EscalaHealth {
  id: string;
  titulo: string;
  data: string;
  total_vagas: number;
  preenchidas: number;
  status: "kritico" | "atencao" | "ok";
}

export default function EventosGeral() {
  const navigate = useNavigate();
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null);
  const [escalasHealth, setEscalasHealth] = useState<EscalaHealth[]>([]);
  const [stats, setStats] = useState({
    candidatosNovos: 0,
    voluntariosAtivos: 0,
    buracosEscala: 0,
  });

  const {
    ativo: relogioAtivo,
    sentinelaAtual,
    proximoSentinela,
    loading: loadingRelogio,
    eventoId: relogioId,
  } = useRelogioAgora();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date();
      const nowISO = today.toISOString();

      // 1. Próximo Evento
      const { data: nextEvents } = await supabase
        .from("eventos")
        .select("id, titulo, data_evento, tipo, local")
        .gte("data_evento", nowISO)
        .order("data_evento", { ascending: true })
        .limit(1);

      if (nextEvents && nextEvents.length > 0) {
        const evt = nextEvents[0];
        const dateObj = new Date(evt.data_evento);
        setNextEvent({
          ...evt,
          hora: format(dateObj, "HH:mm"),
        });
      }

      // 2. Saúde Escalas (Mock Visual para não quebrar se tabelas faltarem)
      const { data: next3Events } = await supabase
        .from("eventos")
        .select("id, titulo, data_evento")
        .gte("data_evento", nowISO)
        .neq("tipo", "RELOGIO")
        .limit(3);

      const healthMock: EscalaHealth[] = (next3Events || []).map(
        (e, index) => ({
          id: e.id,
          titulo: e.titulo,
          data: format(new Date(e.data_evento), "dd/MM"),
          total_vagas: 15,
          preenchidas: index === 0 ? 12 : 8,
          status: index === 0 ? "ok" : "atencao",
        })
      );
      setEscalasHealth(healthMock);

      // 3. Stats (Contagem simples)
      const { count: countTimes } = await supabase
        .from("times")
        .select("*", { count: "exact", head: true })
        .eq("ativo", true);

      setStats({
        candidatosNovos: 0,
        voluntariosAtivos: countTimes || 0,
        buracosEscala: 5,
      });
    } catch (error) {
      console.error("Erro dashboard:", error);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const renderFriendlyDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "CULTO":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "RELOGIO":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "TAREFA":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Centro de Operações
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão unificada de Eventos, Escalas e Voluntariado.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/eventos/lista")}
            className="w-full sm:w-auto border-dashed"
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Ver Agenda
          </Button>
          <Button
            size="lg"
            onClick={() => navigate("/eventos/lista?novo=true")}
            className="bg-primary shadow-lg w-full sm:w-auto"
          >
            <Plus className="mr-2 h-5 w-5" />
            Novo Evento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* COLUNA ESQUERDA (8/12) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Widget Relógio */}
          {relogioAtivo && !loadingRelogio && (
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 shadow-sm">
              <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5 w-full">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                    <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border-2 border-blue-200">
                      <Flame className="h-7 w-7 fill-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100 flex items-center gap-3">
                      Relógio de Oração
                      <Badge
                        variant="secondary"
                        className="bg-blue-200 text-blue-800 hover:bg-blue-200 px-2"
                      >
                        Ao Vivo
                      </Badge>
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mt-2 text-blue-700 dark:text-blue-300">
                      <div className="flex items-center gap-2 bg-white/50 dark:bg-black/20 px-3 py-1 rounded-full">
                        <span className="font-semibold text-xs uppercase tracking-wide opacity-70">
                          Sentinela
                        </span>
                        {sentinelaAtual ? (
                          <span className="font-bold flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />{" "}
                            {sentinelaAtual.nome}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" /> Vago
                          </span>
                        )}
                      </div>
                      {sentinelaAtual && (
                        <span className="text-xs font-medium opacity-80">
                          até {sentinelaAtual.ate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-blue-200/50">
                  <div className="text-right hidden md:block min-w-[100px]">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-0.5">
                      Próximo
                    </p>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 truncate max-w-[120px]">
                        {proximoSentinela ? proximoSentinela.nome : "—"}
                      </p>
                      {proximoSentinela && (
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          às {proximoSentinela.inicio}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {sentinelaAtual && (
                      <Button
                        variant="outline"
                        className="w-full md:w-auto border-blue-500 text-blue-700 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950"
                        onClick={() =>
                          navigate(`/oracao/player/${sentinelaAtual.escalaId}`)
                        }
                      >
                        <Flame className="h-4 w-4 mr-2" />
                        Abrir Player
                      </Button>
                    )}
                    <Button
                      className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all hover:scale-105"
                      onClick={() =>
                        navigate(`/eventos/${relogioId}?tab=escalas`)
                      }
                    >
                      Ver Grade
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card Próximo Evento */}
          {loadingDashboard ? (
            <Skeleton className="h-[240px] w-full rounded-xl" />
          ) : nextEvent ? (
            <Card
              className="relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-primary bg-card/50"
              onClick={() => navigate(`/eventos/${nextEvent.id}`)}
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                <CalendarCheck className="h-48 w-48 -mr-10 -mt-10" />
              </div>
              <CardHeader className="pb-2 pt-6 px-6">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                  <div className="space-y-3">
                    <Badge
                      className={`${getTipoColor(
                        nextEvent.tipo
                      )} px-3 py-1 text-xs uppercase tracking-wider`}
                    >
                      {nextEvent.tipo}
                    </Badge>
                    <CardTitle className="text-3xl md:text-4xl font-bold leading-tight text-foreground">
                      {nextEvent.titulo}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg border md:flex-col md:items-end md:text-right md:border-0 md:bg-transparent md:p-0">
                    <div className="text-3xl font-bold text-primary">
                      {format(new Date(nextEvent.data_evento), "dd")}
                    </div>
                    <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                      {format(new Date(nextEvent.data_evento), "MMMM", {
                        locale: ptBR,
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-4 text-base text-muted-foreground">
                  <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-md border text-foreground/80">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{nextEvent.hora}</span>
                  </div>
                  {nextEvent.local && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {nextEvent.local}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-4">
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  <Button
                    variant="outline"
                    className="gap-2 h-10 px-6 border-primary/20 hover:border-primary/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/eventos/${nextEvent.id}?tab=escalas`);
                    }}
                  >
                    <Users className="h-4 w-4" /> Ver Escala
                  </Button>
                  {nextEvent.tipo === "EVENTO" && (
                    <Button
                      variant="outline"
                      className="gap-2 h-10 px-6 border-blue-500/20 hover:border-blue-500/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/eventos/${nextEvent.id}?tab=convites`);
                      }}
                    >
                      <Send className="h-4 w-4" /> Gerenciar Convites
                    </Button>
                  )}
                  <Button className="gap-2 h-10 px-6 shadow-sm group-hover:bg-primary/90">
                    Gerenciar Detalhes{" "}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[200px] flex flex-col items-center justify-center text-muted-foreground bg-muted/30 border-dashed">
              <CalendarCheck className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum evento futuro agendado.</p>
              <Button variant="link" onClick={() => navigate("/eventos/lista")}>
                Agendar agora
              </Button>
            </Card>
          )}

          {/* Raio-X Escalas */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Cobertura de Escalas
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/escalas")}
                className="text-muted-foreground hover:text-primary"
              >
                Ver matriz completa <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <div className="grid gap-4">
              {escalasHealth.map((escala) => (
                <Card
                  key={escala.id}
                  className="hover:bg-muted/40 transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-primary group"
                  onClick={() => navigate(`/eventos/${escala.id}`)}
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="flex flex-col items-center justify-center min-w-[50px] bg-muted/50 rounded-md p-2 border">
                        <span className="text-xs font-bold text-muted-foreground uppercase">
                          {escala.data.split("/")[1]}
                        </span>
                        <span className="text-xl font-bold text-foreground">
                          {escala.data.split("/")[0]}
                        </span>
                      </div>
                      <div className="flex-1 sm:w-[200px]">
                        <h4 className="font-semibold text-base group-hover:text-primary transition-colors">
                          {escala.titulo}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Status de preenchimento
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-muted-foreground">
                          Voluntários
                        </span>
                        <span
                          className={`font-bold ${
                            escala.status === "atencao"
                              ? "text-amber-600"
                              : "text-green-600"
                          }`}
                        >
                          {escala.preenchidas}{" "}
                          <span className="text-muted-foreground font-normal">
                            / {escala.total_vagas}
                          </span>
                        </span>
                      </div>
                      <Progress
                        value={(escala.preenchidas / escala.total_vagas) * 100}
                        className={`h-2.5 ${
                          escala.status === "atencao"
                            ? "bg-amber-100"
                            : "bg-green-100"
                        }`}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (4/12) */}
        <div className="lg:col-span-4 space-y-8">
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base font-semibold">
                Saúde do Voluntariado
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                <div className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none">
                        {stats.voluntariosAtivos}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 font-medium uppercase">
                        Times Ativos
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors group cursor-pointer"
                  onClick={() => navigate("/escalas")}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none">
                        {stats.buracosEscala}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 font-medium uppercase">
                        Vagas Críticas
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
              Atalhos de Gestão
            </h3>
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="w-full justify-start h-12 text-base font-normal hover:border-green-300 hover:bg-green-50 group"
                onClick={() => navigate("/eventos/times")}
              >
                <div className="h-8 w-8 rounded-md bg-green-100 text-green-700 flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
                  <Users className="h-4 w-4" />
                </div>{" "}
                Times e Equipes
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-12 text-base font-normal hover:border-orange-300 hover:bg-orange-50 group"
                onClick={() => navigate("/eventos/templates")}
              >
                <div className="h-8 w-8 rounded-md bg-orange-100 text-orange-700 flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
                  <LayoutTemplate className="h-4 w-4" />
                </div>{" "}
                Templates de Evento
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-12 text-base font-normal hover:border-purple-300 hover:bg-purple-50 group"
                onClick={() => navigate("/escalas")}
              >
                <div className="h-8 w-8 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
                  <Clock className="h-4 w-4" />
                </div>{" "}
                Escalas (Matriz)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
