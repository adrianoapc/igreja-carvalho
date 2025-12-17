import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, FileText, Users, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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

interface EtapaContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  etapa: {
    id?: string;
    titulo: string;
    tipo_conteudo?: string | null;
    conteudo_url?: string | null;
    conteudo_texto?: string | null;
    quiz_config?: QuizConfig | null;
    check_automatico?: boolean | null;
  } | null;
  jornadaId: string;
  onSuccess: () => void;
}

const TIPOS_CONTEUDO = [
  { value: "texto", label: "📄 Texto/Leitura", icon: FileText },
  { value: "video", label: "🎥 Vídeo Aula", icon: Play },
  { value: "quiz", label: "📝 Quiz/Prova", icon: CheckCircle2 },
  { value: "reuniao", label: "🤝 Reunião/Tarefa", icon: Users },
];

export default function EtapaContentDialog({
  open,
  onOpenChange,
  etapa,
  jornadaId,
  onSuccess,
}: EtapaContentDialogProps) {
  const queryClient = useQueryClient();
  
  // Estados principais
  const [tipoConteudo, setTipoConteudo] = useState<string>("texto");
  const [conteudoUrl, setConteudoUrl] = useState("");
  const [conteudoTexto, setConteudoTexto] = useState("");
  const [bloqueioVideo, setBloqueioVideo] = useState(false);
  
  // Estados do Quiz
  const [notaMinima, setNotaMinima] = useState(70);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([
    {
      id: "1",
      texto: "",
      alternativas: ["", "", "", ""],
      respostaCorreta: 0,
    },
  ]);

  useEffect(() => {
    if (open && etapa) {
      setTipoConteudo(etapa.tipo_conteudo || "texto");
      setConteudoUrl(etapa.conteudo_url || "");
      setConteudoTexto(etapa.conteudo_texto || "");
      setBloqueioVideo(etapa.check_automatico ?? false);
      
      if (etapa.quiz_config) {
        setNotaMinima(etapa.quiz_config.notaMinima || 70);
        setPerguntas(etapa.quiz_config.perguntas || []);
      } else {
        setNotaMinima(70);
        setPerguntas([
          {
            id: "1",
            texto: "",
            alternativas: ["", "", "", ""],
            respostaCorreta: 0,
          },
        ]);
      }
    }
  }, [open, etapa]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!etapa?.id) throw new Error("Etapa não encontrada");

      // Validações baseadas no tipo
      if (tipoConteudo === "video" && !conteudoUrl.trim()) {
        throw new Error("Informe a URL do vídeo");
      }
      if (tipoConteudo === "texto" && !conteudoTexto.trim()) {
        throw new Error("Informe o conteúdo do texto");
      }
      if (tipoConteudo === "quiz") {
        const perguntasValidas = perguntas.every(
          (p) =>
            p.texto.trim() &&
            p.alternativas.every((a) => a.trim()) &&
            p.respostaCorreta >= 0 &&
            p.respostaCorreta < p.alternativas.length
        );
        if (!perguntasValidas) {
          throw new Error(
            "Complete todas as perguntas e indique a resposta correta"
          );
        }
      }

      // Preparar payload
      const payload: any = {
        tipo_conteudo: tipoConteudo,
        conteudo_url: tipoConteudo === "video" ? conteudoUrl : null,
        conteudo_texto: tipoConteudo === "texto" ? conteudoTexto : null,
        quiz_config:
          tipoConteudo === "quiz"
            ? { notaMinima, perguntas }
            : null,
        check_automatico:
          tipoConteudo === "video" ? bloqueioVideo : null,
      };

      const { error } = await supabase
        .from("etapas_jornada")
        .update(payload)
        .eq("id", etapa.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conteúdo salvo!");
      queryClient.invalidateQueries({
        queryKey: ["etapas-jornada-edit", jornadaId],
      });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating etapa content:", error);
      toast.error((error as Error).message || "Erro ao salvar conteúdo");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  const addPergunta = () => {
    const novoId = Math.random().toString();
    setPerguntas([
      ...perguntas,
      {
        id: novoId,
        texto: "",
        alternativas: ["", "", "", ""],
        respostaCorreta: 0,
      },
    ]);
  };

  const removePergunta = (id: string) => {
    if (perguntas.length > 1) {
      setPerguntas(perguntas.filter((p) => p.id !== id));
    }
  };

  const updatePergunta = (id: string, campo: string, valor: any) => {
    setPerguntas(
      perguntas.map((p) =>
        p.id === id ? { ...p, [campo]: valor } : p
      )
    );
  };

  const updateAlternativa = (
    perguntaId: string,
    index: number,
    valor: string
  ) => {
    setPerguntas(
      perguntas.map((p) =>
        p.id === perguntaId
          ? {
              ...p,
              alternativas: p.alternativas.map((alt, i) =>
                i === index ? valor : alt
              ),
            }
          : p
      )
    );
  };

  const TipoIcon = TIPOS_CONTEUDO.find((t) => t.value === tipoConteudo)?.icon || FileText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TipoIcon className="w-5 h-5" />
            Configurar Conteúdo
          </SheetTitle>
          <SheetDescription>{etapa?.titulo}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Tipo de Conteúdo */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Tipo de Conteúdo *</Label>
            <Select value={tipoConteudo} onValueChange={setTipoConteudo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CONTEUDO.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* === TEXTO === */}
          {tipoConteudo === "texto" && (
            <div className="space-y-2">
              <Label htmlFor="texto-conteudo">Conteúdo da Leitura *</Label>
              <Textarea
                id="texto-conteudo"
                placeholder="Digite o conteúdo da aula aqui... Você pode usar formatação básica."
                value={conteudoTexto}
                onChange={(e) => setConteudoTexto(e.target.value)}
                rows={10}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Suporta texto simples. O aluno verá este conteúdo no player.
              </p>
            </div>
          )}

          {/* === VÍDEO === */}
          {tipoConteudo === "video" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-url">URL do Vídeo *</Label>
                <Input
                  id="video-url"
                  type="url"
                  placeholder="https://youtube.com/watch?v=dQw4w9WgXcQ"
                  value={conteudoUrl}
                  onChange={(e) => setConteudoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Cole o link completo do YouTube, Vimeo ou outra plataforma
                </p>
              </div>

              {/* Preview do Vídeo */}
              {conteudoUrl && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden border">
                    {getVideoEmbed(conteudoUrl)}
                  </div>
                </div>
              )}

              {/* Bloqueio */}
              <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bloqueio-video" className="font-medium">
                    Bloquear avanço até terminar o vídeo?
                  </Label>
                  <Switch
                    id="bloqueio-video"
                    checked={bloqueioVideo}
                    onCheckedChange={setBloqueioVideo}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Se ativado, o aluno só avança para a próxima etapa após assistir
                  o vídeo completo.
                </p>
              </div>
            </div>
          )}

          {/* === QUIZ === */}
          {tipoConteudo === "quiz" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nota-minima">Nota Mínima para Aprovação (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="nota-minima"
                    type="number"
                    min="0"
                    max="100"
                    value={notaMinima}
                    onChange={(e) => setNotaMinima(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">{notaMinima}%</span>
                </div>
              </div>

              {/* Perguntas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Perguntas *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPergunta}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Pergunta
                  </Button>
                </div>

                <div className="space-y-4">
                  {perguntas.map((pergunta, indexPergunta) => (
                    <Card key={pergunta.id} className="overflow-hidden">
                      <CardContent className="pt-4 space-y-3">
                        {/* Header da Pergunta */}
                        <div className="flex items-start justify-between gap-2">
                          <Badge variant="secondary">
                            Pergunta {indexPergunta + 1}
                          </Badge>
                          {perguntas.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePergunta(pergunta.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {/* Texto da Pergunta */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Texto da Pergunta *
                          </Label>
                          <Textarea
                            value={pergunta.texto}
                            onChange={(e) =>
                              updatePergunta(pergunta.id, "texto", e.target.value)
                            }
                            placeholder="Ex: O que é uma jornada educacional?"
                            rows={2}
                            className="text-sm"
                          />
                        </div>

                        {/* Alternativas */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Alternativas *
                          </Label>
                          <div className="space-y-2">
                            {pergunta.alternativas.map((alt, indexAlt) => (
                              <div key={indexAlt} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`resposta-${pergunta.id}`}
                                  checked={
                                    pergunta.respostaCorreta === indexAlt
                                  }
                                  onChange={() =>
                                    updatePergunta(
                                      pergunta.id,
                                      "respostaCorreta",
                                      indexAlt
                                    )
                                  }
                                  className="w-4 h-4"
                                />
                                <Input
                                  value={alt}
                                  onChange={(e) =>
                                    updateAlternativa(
                                      pergunta.id,
                                      indexAlt,
                                      e.target.value
                                    )
                                  }
                                  placeholder={`Alternativa ${String.fromCharCode(65 + indexAlt)}`}
                                  className="text-sm"
                                />
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Selecione o rádio para marcar a resposta correta
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* === REUNIÃO/TAREFA === */}
          {tipoConteudo === "reuniao" && (
            <Alert>
              <Users className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Esta etapa é uma Reunião/Tarefa</p>
                  <p className="text-sm">
                    O aluno precisará comparecer presencialmente ou completar uma
                    tarefa para marcar esta etapa como concluída. O líder fará a
                    confirmação manual no Kanban.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Conteúdo"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}


/**
 * Gera embed do vídeo baseado na URL
 */
function getVideoEmbed(url: string) {
  if (!url) return null;

  // YouTube
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const embedUrl = getYouTubeEmbedUrl(url);
    if (embedUrl) {
      return (
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
  }

  // Vimeo
  if (url.includes("vimeo.com")) {
    const embedUrl = getVimeoEmbedUrl(url);
    if (embedUrl) {
      return (
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }
  }

  // URL genérica
  if (url.startsWith("http")) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm">
        <p>Preview não disponível para esta URL</p>
      </div>
    );
  }

  return null;
}

function getYouTubeEmbedUrl(url: string): string {
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[7].length === 11 ? match[7] : null;
  return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
}

function getVimeoEmbedUrl(url: string): string {
  const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
  const match = url.match(regExp);
  const videoId = match ? match[1] : null;
  return videoId ? `https://player.vimeo.com/video/${videoId}` : "";
}

