import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  UserPlus,
  ClipboardList,
  Calendar,
  CheckCircle2,
  Cake,
  Phone,
  Heart,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import {
  format,
  addDays,
  isSameDay,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import RegistrarSentimentoDialog from "@/components/sentimentos/RegistrarSentimentoDialog";
import { WelcomeHeader } from "./WelcomeHeader";
import EscalasPendentesWidget from "@/components/dashboard/EscalasPendentesWidget";
import ConvitesPendentesWidget from "@/components/dashboard/ConvitesPendentesWidget";

interface Aniversariante {
  id: string;
  nome: string;
  avatar_url: string | null;
  data_nascimento: string;
}

export default function DashboardLeader() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const firstName = profile?.nome?.split(" ")[0] || "Líder";
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: authLoading,
  } = useAuthContext();

  const [stats, setStats] = useState({
    membrosCelula: 0,
    visitantesPendentes: 0,
    relatoriosAtrasados: 0,
  });
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
  const [sentimentoDialogOpen, setSentimentoDialogOpen] = useState(false);
  const [alreadyRegisteredToday, setAlreadyRegisteredToday] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    fetchStats();
    fetchAniversariantes();
    checkTodaySentimento();
  }, [profile?.id, igrejaId, filialId, isAllFiliais, authLoading]);

  useEffect(() => {
    if (searchParams.get("sentimento") === "true") {
      setSentimentoDialogOpen(true);
      searchParams.delete("sentimento");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const checkTodaySentimento = async () => {
    if (!profile?.id) return;

    const today = new Date();
    const dayStart = startOfDay(today).toISOString();
    const dayEnd = endOfDay(today).toISOString();

    const { data } = await supabase
      .from("sentimentos_membros")
      .select("id")
      .eq("pessoa_id", profile.id)
      .gte("data_registro", dayStart)
      .lte("data_registro", dayEnd)
      .limit(1);

    setAlreadyRegisteredToday(!!data && data.length > 0);
  };

  const fetchStats = async () => {
    // Membros na célula (simplified - count members in teams where user is leader)
    let teamsQuery = supabase
      .from("times")
      .select("id")
      .or(`lider_id.eq.${profile?.id},sublider_id.eq.${profile?.id}`);
    if (igrejaId) teamsQuery = teamsQuery.eq("igreja_id", igrejaId);
    if (!isAllFiliais && filialId)
      teamsQuery = teamsQuery.eq("filial_id", filialId);
    const { data: teams } = await teamsQuery;

    if (teams && teams.length > 0) {
      const teamIds = teams.map((t) => t.id);
      let membrosQuery = supabase
        .from("membros_time")
        .select("*", { count: "exact", head: true })
        .in("time_id", teamIds)
        .eq("ativo", true);
      if (igrejaId) membrosQuery = membrosQuery.eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId)
        membrosQuery = membrosQuery.eq("filial_id", filialId);
      const { count } = await membrosQuery;

      setStats((prev) => ({ ...prev, membrosCelula: count || 0 }));
    }

    // Visitantes pendentes de contato
    let visitantesQuery = supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "visitante")
      .eq("deseja_contato", true);
    if (igrejaId) visitantesQuery = visitantesQuery.eq("igreja_id", igrejaId);
    if (!isAllFiliais && filialId)
      visitantesQuery = visitantesQuery.eq("filial_id", filialId);
    const { count: visitantesCount } = await visitantesQuery;

    setStats((prev) => ({
      ...prev,
      visitantesPendentes: visitantesCount || 0,
    }));
  };

  const fetchAniversariantes = async () => {
    const today = new Date();
    const endOfWeek = addDays(today, 7);

    let aniversQuery = supabase
      .from("profiles")
      .select("id, nome, avatar_url, data_nascimento")
      .not("data_nascimento", "is", null);
    if (igrejaId) aniversQuery = aniversQuery.eq("igreja_id", igrejaId);
    if (!isAllFiliais && filialId)
      aniversQuery = aniversQuery.eq("filial_id", filialId);
    const { data } = await aniversQuery;

    if (data) {
      const aniversariantesSemana = data
        .filter((p) => {
          if (!p.data_nascimento) return false;
          const nascimento = new Date(p.data_nascimento);
          const thisYearBirthday = new Date(
            today.getFullYear(),
            nascimento.getMonth(),
            nascimento.getDate()
          );
          return isWithinInterval(thisYearBirthday, {
            start: today,
            end: endOfWeek,
          });
        })
        .slice(0, 5);

      setAniversariantes(aniversariantesSemana);
    }
  };

  const getInitials = (name: string) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "?"
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Personal Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Área do Líder
          </h1>
          <WelcomeHeader />
          {/*/<p className="text-sm md:text-base text-muted-foreground mt-1">
            Olá, {firstName}! {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p> */}
        </div>
        {!alreadyRegisteredToday && (
          <Button
            onClick={() => setSentimentoDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
          >
            <Heart className="w-4 h-4" />
            <span>Como você está?</span>
          </Button>
        )}
      </div>

      {/* Widget de Monitoramento de Escalas */}
      <EscalasPendentesWidget />

      {/* Convites Pendentes Widget */}
      <ConvitesPendentesWidget />

      <RegistrarSentimentoDialog
        open={sentimentoDialogOpen}
        onOpenChange={(open) => {
          setSentimentoDialogOpen(open);
          if (!open) checkTodaySentimento();
        }}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats.membrosCelula}
              </p>
              <p className="text-sm text-muted-foreground">Membros na Célula</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-amber-500/10">
              <UserPlus className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats.visitantesPendentes}
              </p>
              <p className="text-sm text-muted-foreground">
                Visitantes Pendentes
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-red-500/10">
              <ClipboardList className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats.relatoriosAtrasados}
              </p>
              <p className="text-sm text-muted-foreground">
                Relatórios Atrasados
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          size="lg"
          className="h-24 flex flex-col gap-2"
          onClick={() => navigate("/chamada")}
        >
          <CheckCircle2 className="w-8 h-8" />
          <span>Fazer Chamada</span>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-24 flex flex-col gap-2"
          onClick={() => navigate("/pessoas/visitantes?novo=true")}
        >
          <UserPlus className="w-8 h-8" />
          <span>Novo Visitante</span>
        </Button>
      </div>

      {/* Aniversariantes da Semana */}
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Cake className="w-4 h-4 text-pink-500" />
            Aniversariantes da Semana
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {aniversariantes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum aniversariante esta semana
            </p>
          ) : (
            aniversariantes.map((pessoa) => {
              const nascimento = new Date(pessoa.data_nascimento);
              const today = new Date();
              const thisYearBirthday = new Date(
                today.getFullYear(),
                nascimento.getMonth(),
                nascimento.getDate()
              );
              const isToday = isSameDay(thisYearBirthday, today);

              return (
                <div
                  key={pessoa.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={pessoa.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(pessoa.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {pessoa.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(thisYearBirthday, "d 'de' MMMM", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  {isToday && (
                    <Badge
                      variant="secondary"
                      className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300"
                    >
                      Hoje! 🎉
                    </Badge>
                  )}
                </div>
              );
            })
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => navigate("/pessoas")}
          >
            Ver todos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
