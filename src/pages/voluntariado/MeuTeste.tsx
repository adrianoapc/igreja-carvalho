import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ClipboardCheck,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface Teste {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: "pratico" | "escrito" | "entrevista" | "hibrido";
  conteudo_json: {
    perguntas?: Array<{
      id: string;
      pergunta: string;
      tipo: "texto" | "multipla" | "sim_nao";
      opcoes?: string[];
      peso: number;
    }>;
    duracao_minutos?: number;
    pontuacao_minima_aprovacao?: number;
  };
  pontuacao_minima_aprovacao: number;
}

export default function MeuTeste() {
  const { testeId } = useParams<{ testeId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [tempoRestante, setTempoRestante] = useState<number | null>(null);
  const [iniciado, setIniciado] = useState(false);

  // Query para buscar teste
  const { data: teste, isLoading } = useQuery({
    queryKey: ["teste-candidato", testeId],
    queryFn: async () => {
      if (!testeId) throw new Error("ID do teste não fornecido");

      // @ts-expect-error - tabela nova, tipos ainda não gerados
      const { data, error } = await supabase
        .from("testes_ministerio")
        .select("*")
        .eq("id", testeId)
        .eq("ativo", true)
        .single();

      if (error) throw error;
      return data as Teste;
    },
    enabled: !!testeId,
  });

  // Query para verificar se já existe resultado
  const { data: resultadoExistente } = useQuery({
    queryKey: ["resultado-teste", testeId, profile?.id],
    queryFn: async () => {
      if (!testeId || !profile?.id) return null;

      // Buscar candidatura do usuário
      const { data: candidatura } = await supabase
        .from("candidatos_voluntario")
        .select("id")
        .eq("pessoa_id", profile.id)
        .maybeSingle();

      if (!candidatura) return null;

      // @ts-expect-error - tabela nova, tipos ainda não gerados
      const { data, error } = await supabase
        .from("resultados_teste")
        .select("*")
        .eq("teste_id", testeId)
        .eq("candidato_id", candidatura.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!testeId && !!profile?.id,
  });

  // Mutation para submeter teste
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!testeId || !profile?.id) throw new Error("Dados incompletos");

      // Buscar candidatura e integração
      const { data: candidatura } = await supabase
        .from("candidatos_voluntario")
        .select("id")
        .eq("pessoa_id", profile.id)
        .single();

      if (!candidatura) throw new Error("Candidatura não encontrada");

      // @ts-expect-error - tabela nova, tipos ainda não gerados
      const { data: integracao } = await supabase
        .from("integracao_voluntario")
        .select("id")
        .eq("candidato_id", candidatura.id)
        .single();

      if (!integracao) throw new Error("Integração não encontrada");

      const respostaJson = {
        respostas: Object.entries(respostas).map(([perguntaId, resposta]) => ({
          pergunta_id: perguntaId,
          resposta,
        })),
      };

      // @ts-expect-error - tabela nova, tipos ainda não gerados
      const { error } = await supabase.from("resultados_teste").insert({
        integracao_id: integracao.id,
        teste_id: testeId,
        candidato_id: candidatura.id,
        resposta_json: respostaJson,
        resultado: "aprovado", // Temporário - será avaliado pelo mentor
        pontuacao_total: 0,
        igreja_id: profile.igreja_id,
        filial_id: profile.filial_id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resultado-teste"] });
      toast({
        title: "Teste enviado com sucesso!",
        description: "Aguarde a avaliação do seu mentor.",
      });
      navigate("/voluntariado");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar teste",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleIniciar = () => {
    setIniciado(true);
    if (teste?.conteudo_json?.duracao_minutos) {
      setTempoRestante(teste.conteudo_json.duracao_minutos * 60);
    }
  };

  const handleResposta = (perguntaId: string, resposta: string) => {
    setRespostas({ ...respostas, [perguntaId]: resposta });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const perguntas = teste?.conteudo_json?.perguntas || [];
    const respostasObrigatorias = perguntas.filter((p) => p.tipo !== "opcional");

    if (Object.keys(respostas).length < respostasObrigatorias.length) {
      toast({
        title: "Responda todas as perguntas",
        description: "Todas as perguntas são obrigatórias.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!teste) {
    return (
      <div className="container mx-auto py-12">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Teste não encontrado ou não disponível.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (resultadoExistente) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              Teste já realizado
            </CardTitle>
            <CardDescription>
              Você já enviou suas respostas para este teste. Aguarde a avaliação do mentor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/voluntariado")}>
              Voltar para Voluntariado
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!iniciado) {
    return (
      <div className="container mx-auto py-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">{teste.titulo}</CardTitle>
            <CardDescription>{teste.descricao}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Tipo</span>
                <span className="text-lg capitalize">{teste.tipo}</span>
              </div>
              {teste.conteudo_json?.duracao_minutos && (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Duração</span>
                  <span className="text-lg">
                    {teste.conteudo_json.duracao_minutos} minutos
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Pontuação Mínima
                </span>
                <span className="text-lg">{teste.pontuacao_minima_aprovacao}%</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Perguntas</span>
                <span className="text-lg">
                  {teste.conteudo_json?.perguntas?.length || 0}
                </span>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Leia com atenção todas as perguntas antes de responder. Uma vez iniciado,
                você não poderá pausar o teste.
              </AlertDescription>
            </Alert>

            <Button onClick={handleIniciar} className="w-full" size="lg">
              <ClipboardCheck className="h-5 w-5 mr-2" />
              Iniciar Teste
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const perguntas = teste.conteudo_json?.perguntas || [];
  const totalPerguntas = perguntas.length;
  const respostasPreenchidas = Object.keys(respostas).length;
  const progresso = totalPerguntas > 0 ? (respostasPreenchidas / totalPerguntas) * 100 : 0;

  return (
    <div className="container mx-auto py-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{teste.titulo}</CardTitle>
              <CardDescription>
                {respostasPreenchidas} de {totalPerguntas} perguntas respondidas
              </CardDescription>
            </div>
            {tempoRestante !== null && (
              <div className="flex items-center gap-2 text-orange-600">
                <Clock className="h-5 w-5" />
                <span className="text-lg font-bold">
                  {Math.floor(tempoRestante / 60)}:{String(tempoRestante % 60).padStart(2, "0")}
                </span>
              </div>
            )}
          </div>
          <Progress value={progresso} className="mt-4" />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {perguntas.map((pergunta, index) => (
              <div key={pergunta.id} className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1 space-y-3">
                    <Label className="text-base">{pergunta.pergunta}</Label>

                    {pergunta.tipo === "texto" && (
                      <Textarea
                        value={respostas[pergunta.id] || ""}
                        onChange={(e) => handleResposta(pergunta.id, e.target.value)}
                        placeholder="Digite sua resposta..."
                        rows={4}
                        required
                      />
                    )}

                    {pergunta.tipo === "multipla" && (
                      <RadioGroup
                        value={respostas[pergunta.id] || ""}
                        onValueChange={(value) => handleResposta(pergunta.id, value)}
                        required
                      >
                        {pergunta.opcoes?.map((opcao, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <RadioGroupItem value={opcao} id={`${pergunta.id}-${idx}`} />
                            <Label htmlFor={`${pergunta.id}-${idx}`}>{opcao}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {pergunta.tipo === "sim_nao" && (
                      <RadioGroup
                        value={respostas[pergunta.id] || ""}
                        onValueChange={(value) => handleResposta(pergunta.id, value)}
                        required
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="sim" id={`${pergunta.id}-sim`} />
                          <Label htmlFor={`${pergunta.id}-sim`}>Sim</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="nao" id={`${pergunta.id}-nao`} />
                          <Label htmlFor={`${pergunta.id}-nao`}>Não</Label>
                        </div>
                      </RadioGroup>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/voluntariado")}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitMutation.isPending}>
                {submitMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Enviar Respostas
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
