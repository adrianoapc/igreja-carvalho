import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  BookOpen,
  ClipboardCheck,
  Trophy,
  Loader2,
  Calendar,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MinhaIntegracao {
  id: string;
  candidato_id: string;
  status: "entrevista" | "trilha" | "mentoria" | "teste" | "ativo" | "rejeitado";
  percentual_jornada: number;
  data_jornada_iniciada: string | null;
  data_conclusao_esperada: string | null;
  resultado_teste: "aprovado" | "reprovado" | "pendente" | null;
  teste_id: string | null;
  data_teste_agendada: string | null;
  pontuacao_teste: number | null;
  mentor: {
    nome: string;
    telefone: string | null;
    email: string | null;
  } | null;
  jornada: {
    titulo: string;
    descricao: string | null;
  } | null;
  candidato: {
    ministerio: string;
    status: string;
  };
}

export default function MinhaJornada() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [integracaoSelecionadaId, setIntegracaoSelecionadaId] = useState<string | null>(null);

  // Query para buscar minhas integrações de voluntário (não jornadas genéricas)
  const { data: integracoes, isLoading } = useQuery({
    queryKey: ["minha-integracao-voluntario", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      console.log("[MinhaJornada] Buscando integrações para profile:", profile.id);

      // Buscar todas as candidaturas aprovadas ou em processo
      const { data: candidaturas, error: candidaturasError } = await supabase
        .from("candidatos_voluntario")
        .select("id, ministerio, status, created_at")
        .eq("pessoa_id", profile.id)
        .in("status", ["aprovado", "em_trilha"])
        .order("created_at", { ascending: false });

      if (candidaturasError) {
        console.error("[MinhaJornada] Erro ao buscar candidaturas:", candidaturasError);
        throw candidaturasError;
      }

      if (!candidaturas || candidaturas.length === 0) {
        console.log("[MinhaJornada] Nenhuma candidatura aprovada encontrada");
        return null;
      }

      console.log("[MinhaJornada] Candidaturas encontradas:", candidaturas.length);

      const candidaturasIds = candidaturas.map((c) => c.id);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const integracaoQuery = supabase.from("integracao_voluntario");
      
      const { data, error } = await integracaoQuery
        .select(
          `
          id,
          candidato_id,
          status,
          percentual_jornada,
          data_jornada_iniciada,
          data_conclusao_esperada,
          resultado_teste,
          teste_id,
          data_teste_agendada,
          pontuacao_teste,
          mentor:profiles!integracao_voluntario_mentor_id_fkey (nome, telefone, email),
          jornada:jornadas!integracao_voluntario_jornada_id_fkey (titulo, descricao)
        `
        )
        .in("candidato_id", candidaturasIds)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("[MinhaJornada] Erro ao buscar integração:", error);
        // Se a tabela não existe, retornar null ao invés de erro
        if (error.code === "42P01") {
          console.warn("[MinhaJornada] Tabela integracao_voluntario não existe ainda");
          return null;
        }
        throw error;
      }
      
      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.log("[MinhaJornada] Nenhuma integração encontrada. Candidatos:", candidaturasIds);
        return null;
      }

      console.log("[MinhaJornada] ✅ Integrações encontradas:", Array.isArray(data) ? data.length : 1, data);

      const candidaturasMap = new Map(
        candidaturas.map((candidatura) => [candidatura.id, candidatura]),
      );

      const integracoesArray = Array.isArray(data) ? data : [data];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return integracoesArray.map((item: any) => ({
        ...item,
        candidato: candidaturasMap.get(item.candidato_id) || candidaturas[0],
      })) as unknown as MinhaIntegracao[];
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    if (!integracoes || integracoes.length === 0) return;

    setIntegracaoSelecionadaId((current) => {
      if (current && integracoes.some((item) => item.id === current)) {
        return current;
      }
      return integracoes[0].id;
    });
  }, [integracoes]);

  const integracao = useMemo(() => {
    if (!integracoes || integracoes.length === 0) return null;
    if (!integracaoSelecionadaId) return integracoes[0];
    return (
      integracoes.find((item) => item.id === integracaoSelecionadaId) ||
      integracoes[0]
    );
  }, [integracoes, integracaoSelecionadaId]);

  const statusSteps = [
    { key: "entrevista", label: "Entrevista", icon: User },
    { key: "trilha", label: "Trilha de Formação", icon: BookOpen },
    { key: "mentoria", label: "Mentoria", icon: User },
    { key: "teste", label: "Teste de Aptidão", icon: ClipboardCheck },
    { key: "ativo", label: "Membro Ativo", icon: Trophy },
  ];

  const getStepStatus = (
    stepKey: string,
    target: MinhaIntegracao | null,
  ): "completed" | "current" | "pending" => {
    if (!target) return "pending";

    const currentIndex = statusSteps.findIndex((s) => s.key === target.status);
    const stepIndex = statusSteps.findIndex((s) => s.key === stepKey);

    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  const getNextAction = (target: MinhaIntegracao | null) => {
    if (!target) return null;

    switch (target.status) {
      case "entrevista":
        return {
          title: "Aguardando Entrevista",
          description: "Em breve você será contatado para agendar sua entrevista inicial.",
          icon: Clock,
        };
      case "trilha":
        return {
          title: "Complete sua Jornada",
          description: `Você está em ${target.percentual_jornada}% da trilha "${target.jornada?.titulo || 'de formação'}". Continue progredindo!`,
          icon: BookOpen,
          action: () => navigate("/cursos"),
          actionLabel: "Ver Jornada",
        };
      case "mentoria":
        return {
          title: "Mentoria em Andamento",
          description: `Seu mentor ${target.mentor?.nome || "será designado em breve"}. Aproveite esta fase para aprender na prática!`,
          icon: User,
        };
      case "teste":
        if (target.teste_id && !target.resultado_teste) {
          return {
            title: "Teste Disponível",
            description: "Seu teste de aptidão está pronto. Clique abaixo para iniciar.",
            icon: ClipboardCheck,
            action: () => navigate(`/voluntariado/meu-teste/${target.teste_id}`),
            actionLabel: "Fazer Teste",
          };
        }
        if (target.resultado_teste === "pendente") {
          return {
            title: "Aguardando Avaliação",
            description: "Você completou o teste. Aguarde a avaliação do seu mentor.",
            icon: Clock,
          };
        }
        return {
          title: "Aguardando Teste",
          description: "Seu teste de aptidão será disponibilizado em breve.",
          icon: Clock,
        };
      case "ativo":
        return {
          title: "Parabéns! 🎉",
          description: `Você é agora um membro ativo do ministério ${target.candidato.ministerio}!`,
          icon: Trophy,
        };
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!integracao) {
    return (
      <div className="container mx-auto py-12">
        <Alert>
          <AlertDescription>
            Você ainda não está em processo de integração. Candidate-se a um ministério para
            iniciar sua jornada!
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate("/voluntariado")} className="mt-4">
          Ver Oportunidades
        </Button>
      </div>
    );
  }

  const nextAction = getNextAction(integracao);

  const statusLabels: Record<MinhaIntegracao["status"], string> = {
    entrevista: "Entrevista",
    trilha: "Trilha",
    mentoria: "Mentoria",
    teste: "Teste",
    ativo: "Ativo",
    rejeitado: "Rejeitado",
  };

  // Cores por etapa (seguindo paleta do IntegracaoInfoModal)
  const statusStepsWithColors = statusSteps.map((step, idx) => {
    const colorMap = {
      entrevista: { bg: "bg-blue-50", icon: "bg-blue-100 text-blue-700", line: "bg-blue-600" },
      trilha: { bg: "bg-green-50", icon: "bg-green-100 text-green-700", line: "bg-green-600" },
      mentoria: { bg: "bg-purple-50", icon: "bg-purple-100 text-purple-700", line: "bg-purple-600" },
      teste: { bg: "bg-orange-50", icon: "bg-orange-100 text-orange-700", line: "bg-orange-600" },
      ativo: { bg: "bg-yellow-50", icon: "bg-yellow-100 text-yellow-700", line: "bg-yellow-600" },
    };
    return {
      ...step,
      colors: colorMap[step.key as keyof typeof colorMap],
    };
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Minha Jornada de Integração</h1>
        <p className="text-muted-foreground">
          Acompanhe seu progresso no ministério {integracao.candidato.ministerio}
        </p>
      </div>

      {integracoes && integracoes.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Suas Jornadas</CardTitle>
            <CardDescription>
              Você possui {integracoes.length} integrações ativas. Selecione uma para visualizar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {integracoes.map((item) => (
                <Button
                  key={item.id}
                  variant={item.id === integracao.id ? "default" : "outline"}
                  onClick={() => setIntegracaoSelecionadaId(item.id)}
                >
                  {item.candidato.ministerio}
                  <Badge variant="secondary" className="ml-2">
                    {statusLabels[item.status]}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card de Próxima Ação */}
      {nextAction && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <nextAction.icon className="h-5 w-5" />
              {nextAction.title}
            </CardTitle>
            <CardDescription>{nextAction.description}</CardDescription>
          </CardHeader>
          {nextAction.action && (
            <CardContent>
              <Button onClick={nextAction.action}>
                {nextAction.actionLabel}
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {/* Timeline de Progresso */}
      <Card>
        <CardHeader>
          <CardTitle>Progresso da Integração</CardTitle>
          <CardDescription>
            {integracao.status === "ativo"
              ? "Parabéns! Você completou todo o processo de integração."
              : "Acompanhe as etapas da sua jornada"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {statusStepsWithColors.map((step, index) => {
              const status = getStepStatus(step.key, integracao);
              const Icon = step.icon;
              const colors = step.colors;

              return (
                <div key={step.key} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        status === "completed"
                          ? `${colors.icon}`
                          : status === "current"
                            ? `${colors.icon}`
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : status === "current" ? (
                        <Icon className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </div>
                    {index < statusStepsWithColors.length - 1 && (
                      <div
                        className={`h-12 w-0.5 ${
                          status === "completed" ? colors.line : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 pb-8">
                    <h3
                      className={`font-semibold ${
                        status === "current" ? "text-primary" : ""
                      }`}
                    >
                      {step.label}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {status === "completed"
                        ? "Concluído"
                        : status === "current"
                          ? "Em andamento"
                          : "Aguardando"}
                    </p>
                  </div>
                  <div>
                    {status === "completed" && (
                      <Badge variant="default" className={`${colors.icon}`}>
                        Concluído
                      </Badge>
                    )}
                    {status === "current" && (
                      <Badge variant="default" className={`${colors.icon}`}>
                        Em Andamento
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cards de Informação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Jornada */}
        {integracao.jornada && integracao.status !== "entrevista" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Trilha de Formação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">{integracao.jornada.titulo}</p>
                {integracao.jornada.descricao && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {integracao.jornada.descricao}
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progresso</span>
                  <span className="text-sm text-muted-foreground">
                    {integracao.percentual_jornada}%
                  </span>
                </div>
                <Progress value={integracao.percentual_jornada} />
              </div>
              {integracao.data_jornada_iniciada && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Iniciada em{" "}
                  {new Date(integracao.data_jornada_iniciada).toLocaleDateString("pt-BR")}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mentor */}
        {integracao.mentor && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Seu Mentor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-medium">
                {Array.isArray(integracao.mentor)
                  ? integracao.mentor[0]?.nome
                  : integracao.mentor.nome}
              </p>
              {(Array.isArray(integracao.mentor)
                ? integracao.mentor[0]?.telefone
                : integracao.mentor.telefone) && (
                <div className="text-sm text-muted-foreground">
                  📱{" "}
                  {Array.isArray(integracao.mentor)
                    ? integracao.mentor[0]?.telefone
                    : integracao.mentor.telefone}
                </div>
              )}
              {(Array.isArray(integracao.mentor)
                ? integracao.mentor[0]?.email
                : integracao.mentor.email) && (
                <div className="text-sm text-muted-foreground">
                  ✉️{" "}
                  {Array.isArray(integracao.mentor)
                    ? integracao.mentor[0]?.email
                    : integracao.mentor.email}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Prazo */}
        {integracao.data_conclusao_esperada && integracao.status !== "ativo" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Prazo de Conclusão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {new Date(integracao.data_conclusao_esperada).toLocaleDateString("pt-BR")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {Math.ceil(
                  (new Date(integracao.data_conclusao_esperada).getTime() -
                    new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                )}{" "}
                dias restantes
              </p>
            </CardContent>
          </Card>
        )}

        {/* Resultado do Teste */}
        {integracao.resultado_teste && integracao.pontuacao_teste !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Resultado do Teste
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pontuação</span>
                <span className="text-2xl font-bold">{integracao.pontuacao_teste}%</span>
              </div>
              <Badge
                variant="default"
                className={
                  integracao.resultado_teste === "aprovado"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }
              >
                {integracao.resultado_teste === "aprovado" ? "Aprovado" : "Reprovado"}
              </Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
