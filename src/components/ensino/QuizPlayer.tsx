import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Trophy, 
  RotateCcw,
  ChevronRight,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Pergunta {
  id: string;
  texto: string;
  alternativas: string[];
  respostaCorreta: number;
}

interface QuizConfig {
  notaMinima: number;
  perguntas: Pergunta[];
}

interface QuizPlayerProps {
  etapa: {
    id: string;
    titulo: string;
    quiz_config: QuizConfig;
  };
  inscricaoId: string;
  onAprovado: () => void;
}

export default function QuizPlayer({ etapa, inscricaoId, onAprovado }: QuizPlayerProps) {
  const { profile } = useAuth();
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{
    nota: number;
    aprovado: boolean;
    tentativa: number;
  } | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [tentativaAtual, setTentativaAtual] = useState(1);
  interface TentativaRecord {
    tentativa_numero?: number | null;
    [key: string]: unknown;
  }
  const [ultimaTentativa, setUltimaTentativa] = useState<TentativaRecord | null>(null);

  const quizConfig = etapa.quiz_config;
  const perguntas = quizConfig?.perguntas || [];
  const notaMinima = quizConfig?.notaMinima || 70;

  useEffect(() => {
    carregarUltimaTentativa();
  }, [carregarUltimaTentativa]);

  const carregarUltimaTentativa = useCallback(async () => {
    if (!inscricaoId) return;

    try {
      const { data, error } = await supabase
        .from("respostas_quiz")
        .select("*")
        .eq("etapa_id", etapa.id)
        .eq("inscricao_id", inscricaoId)
        .order("tentativa_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUltimaTentativa(data);
        setTentativaAtual((data.tentativa_numero || 0) + 1);
      }
    } catch (error) {
      console.error("Erro ao carregar tentativa:", error);
    }
  }, [etapa.id, inscricaoId]);

  const handleSelectResposta = (perguntaId: string, alternativaIndex: number) => {
    if (showFeedback) return; // Não permite mudar após envio
    setRespostas(prev => ({
      ...prev,
      [perguntaId]: alternativaIndex
    }));
  };

  const calcularNota = () => {
    let acertos = 0;
    perguntas.forEach(pergunta => {
      const respostaUsuario = respostas[pergunta.id];
      if (respostaUsuario === pergunta.respostaCorreta) {
        acertos++;
      }
    });
    return Math.round((acertos / perguntas.length) * 100);
  };

  const handleEnviar = async () => {
    // Validar que todas as perguntas foram respondidas
    const todasRespondidas = perguntas.every(p => respostas[p.id] !== undefined);
    if (!todasRespondidas) {
      toast.error("Por favor, responda todas as perguntas antes de enviar");
      return;
    }

    setEnviando(true);
    try {
      const nota = calcularNota();
      const aprovado = nota >= notaMinima;

      // Salvar no banco
      const { error } = await supabase
        .from("respostas_quiz")
        .insert({
          etapa_id: etapa.id,
          inscricao_id: inscricaoId,
          respostas: respostas,
          nota_obtida: nota,
          aprovado,
          tentativa_numero: tentativaAtual,
        });

      if (error) throw error;

      setResultado({ nota, aprovado, tentativa: tentativaAtual });
      setShowFeedback(true);

      if (aprovado) {
        toast.success("🎉 Parabéns! Você foi aprovado!", {
          description: `Nota: ${nota}%`
        });
        // Aguardar 2s antes de chamar callback
        setTimeout(() => {
          onAprovado();
        }, 2000);
      } else {
        toast.error("Não foi dessa vez", {
          description: `Nota: ${nota}%. Necessário: ${notaMinima}%`
        });
      }
    } catch (error) {
      console.error("Erro ao enviar quiz:", error);
      toast.error("Erro ao enviar respostas");
    } finally {
      setEnviando(false);
    }
  };

  const handleTentarNovamente = () => {
    setRespostas({});
    setResultado(null);
    setShowFeedback(false);
    setTentativaAtual(prev => prev + 1);
    toast.info("Nova tentativa iniciada. Boa sorte! 💪");
  };

  const progressoPercentual = useMemo(() => {
    const respondidas = Object.keys(respostas).length;
    return (respondidas / perguntas.length) * 100;
  }, [respostas, perguntas.length]);

  if (perguntas.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Este quiz ainda não possui perguntas configuradas.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header do Quiz */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{etapa.titulo}</CardTitle>
            {ultimaTentativa && !showFeedback && (
              <Badge variant="secondary">
                Última nota: {ultimaTentativa.nota_obtida}%
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{Object.keys(respostas).length} de {perguntas.length} respondidas</span>
              <span>Nota mínima: {notaMinima}%</span>
            </div>
            <Progress value={progressoPercentual} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Resultado (se houver) */}
      {resultado && showFeedback && (
        <Card className={cn(
          "border-2",
          resultado.aprovado ? "border-green-500 bg-green-50/50" : "border-red-500 bg-red-50/50"
        )}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {resultado.aprovado ? (
                <Trophy className="w-12 h-12 text-green-600" />
              ) : (
                <XCircle className="w-12 h-12 text-red-600" />
              )}
              <div className="flex-1">
                <h3 className="text-xl font-bold">
                  {resultado.aprovado ? "Parabéns! 🎉" : "Não foi dessa vez 😔"}
                </h3>
                <p className="text-muted-foreground">
                  Sua nota: <span className="font-bold text-foreground">{resultado.nota}%</span>
                  {resultado.aprovado 
                    ? " - Você foi aprovado!" 
                    : ` - Necessário ${notaMinima}% para aprovação`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tentativa #{resultado.tentativa}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Perguntas */}
      <div className="space-y-6">
        {perguntas.map((pergunta, indexPergunta) => {
          const respostaUsuario = respostas[pergunta.id];
          const respostaCorreta = pergunta.respostaCorreta;
          const acertou = respostaUsuario === respostaCorreta;

          return (
            <Card key={pergunta.id} className={cn(
              "transition-all",
              showFeedback && (acertou ? "border-green-200" : "border-red-200")
            )}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-medium">
                    {indexPergunta + 1}. {pergunta.texto}
                  </CardTitle>
                  {showFeedback && (
                    acertou ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                    )
                  )}
                </div>
                {showFeedback && (
                  <p className={cn(
                    "text-sm font-medium",
                    acertou ? "text-green-600" : "text-red-600"
                  )}>
                    {acertou ? "✓ Resposta Correta!" : "✗ Resposta Errada"}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pergunta.alternativas.map((alternativa, indexAlt) => {
                    const isCorreta = indexAlt === respostaCorreta;
                    const isSelecionada = respostaUsuario === indexAlt;
                    const mostrarFeedback = showFeedback;

                    let borderColor = "border-border";
                    let bgColor = "bg-background";
                    let icon = null;

                    if (mostrarFeedback) {
                      if (isCorreta) {
                        borderColor = "border-green-500";
                        bgColor = "bg-green-50";
                        icon = <CheckCircle2 className="w-4 h-4 text-green-600" />;
                      } else if (isSelecionada && !isCorreta) {
                        borderColor = "border-red-500";
                        bgColor = "bg-red-50";
                        icon = <XCircle className="w-4 h-4 text-red-600" />;
                      }
                    } else if (isSelecionada) {
                      borderColor = "border-primary";
                      bgColor = "bg-primary/5";
                    }

                    return (
                      <button
                        key={indexAlt}
                        onClick={() => handleSelectResposta(pergunta.id, indexAlt)}
                        disabled={showFeedback}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                          borderColor,
                          bgColor,
                          !showFeedback && "hover:border-primary/50 cursor-pointer",
                          showFeedback && "cursor-default"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                          isSelecionada && !mostrarFeedback && "border-primary bg-primary",
                          mostrarFeedback && isCorreta && "border-green-500",
                          mostrarFeedback && isSelecionada && !isCorreta && "border-red-500"
                        )}>
                          {isSelecionada && !mostrarFeedback && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <span className="flex-1">
                          {String.fromCharCode(65 + indexAlt)}. {alternativa}
                        </span>
                        {mostrarFeedback && icon}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-3">
        {!showFeedback ? (
          <>
            <Button
              onClick={handleEnviar}
              disabled={enviando || Object.keys(respostas).length < perguntas.length}
              className="flex-1 gap-2"
              size="lg"
            >
              {enviando ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Enviar Respostas
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {!resultado?.aprovado && (
              <Button
                onClick={handleTentarNovamente}
                variant="outline"
                className="flex-1 gap-2"
                size="lg"
              >
                <RotateCcw className="w-4 h-4" />
                Tentar Novamente
              </Button>
            )}
            {resultado?.aprovado && (
              <Button
                onClick={onAprovado}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <ChevronRight className="w-4 h-4" />
                Continuar Próxima Etapa
              </Button>
            )}
          </>
        )}
      </div>

      {/* Histórico de Tentativas */}
      {ultimaTentativa && !showFeedback && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Histórico:</span> Você já fez {tentativaAtual - 1} tentativa(s). 
            {ultimaTentativa.aprovado 
              ? " Última tentativa foi aprovada!" 
              : " Continue tentando para melhorar sua nota!"}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
