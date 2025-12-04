import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Check, 
  Play, 
  Lock, 
  Video, 
  FileText, 
  Calendar,
  MapPin,
  CheckCircle2,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Etapa {
  id: string;
  titulo: string;
  ordem: number;
  tipo_conteudo: string | null;
  conteudo_url: string | null;
  conteudo_texto: string | null;
  aula_vinculada_id: string | null;
  concluida: boolean;
  data_conclusao?: string;
}

interface Jornada {
  id: string;
  titulo: string;
  descricao: string | null;
  cor_tema: string | null;
}

interface AulaVinculada {
  id: string;
  data_inicio: string;
  sala: { nome: string } | null;
}

export default function CursoPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [etapaSelecionada, setEtapaSelecionada] = useState<Etapa | null>(null);
  const [aulaVinculada, setAulaVinculada] = useState<AulaVinculada | null>(null);
  const [loading, setLoading] = useState(true);
  const [marcandoConcluido, setMarcandoConcluido] = useState(false);
  const [sidebarAberta, setSidebarAberta] = useState(true);

  useEffect(() => {
    if (id && profile?.id) {
      fetchDados();
    }
  }, [id, profile?.id]);

  useEffect(() => {
    if (etapaSelecionada?.aula_vinculada_id) {
      fetchAulaVinculada(etapaSelecionada.aula_vinculada_id);
    } else {
      setAulaVinculada(null);
    }
  }, [etapaSelecionada]);

  const fetchDados = async () => {
    if (!id || !profile?.id) return;

    try {
      // Buscar jornada
      const { data: jornadaData, error: jornadaError } = await supabase
        .from("jornadas")
        .select("id, titulo, descricao, cor_tema")
        .eq("id", id)
        .single();

      if (jornadaError) throw jornadaError;
      setJornada(jornadaData);

      // Buscar etapas
      const { data: etapasData, error: etapasError } = await supabase
        .from("etapas_jornada")
        .select("id, titulo, ordem, tipo_conteudo, conteudo_url, conteudo_texto, aula_vinculada_id")
        .eq("jornada_id", id)
        .order("ordem");

      if (etapasError) throw etapasError;

      // Buscar conclusões do aluno
      const etapaIds = etapasData?.map(e => e.id) || [];
      const { data: presencasData } = await supabase
        .from("presencas_aula")
        .select("etapa_id, created_at")
        .eq("aluno_id", profile.id)
        .in("etapa_id", etapaIds)
        .eq("status", "concluido");

      const conclusoesMap = new Map(
        presencasData?.map(p => [p.etapa_id, p.created_at]) || []
      );

      const etapasComStatus: Etapa[] = (etapasData || []).map(etapa => ({
        ...etapa,
        concluida: conclusoesMap.has(etapa.id),
        data_conclusao: conclusoesMap.get(etapa.id),
      }));

      setEtapas(etapasComStatus);

      // Selecionar primeira etapa não concluída ou a primeira
      const primeiraIncompleta = etapasComStatus.find(e => !e.concluida);
      setEtapaSelecionada(primeiraIncompleta || etapasComStatus[0] || null);

    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar curso");
    } finally {
      setLoading(false);
    }
  };

  const fetchAulaVinculada = async (aulaId: string) => {
    const { data } = await supabase
      .from("aulas")
      .select("id, data_inicio, sala:salas(nome)")
      .eq("id", aulaId)
      .single();

    if (data) {
      setAulaVinculada({
        ...data,
        sala: Array.isArray(data.sala) ? data.sala[0] : data.sala
      });
    }
  };

  const marcarConcluido = async () => {
    if (!etapaSelecionada || !profile?.id) return;

    setMarcandoConcluido(true);
    try {
      const { error } = await supabase
        .from("presencas_aula")
        .upsert({
          aluno_id: profile.id,
          etapa_id: etapaSelecionada.id,
          status: "concluido",
          checkin_at: new Date().toISOString(),
        }, {
          onConflict: "etapa_id,aluno_id"
        });

      if (error) throw error;

      toast.success("🎉 Etapa concluída!", {
        description: "Parabéns pelo progresso!"
      });

      // Atualizar estado local
      setEtapas(prev => prev.map(e => 
        e.id === etapaSelecionada.id 
          ? { ...e, concluida: true, data_conclusao: new Date().toISOString() }
          : e
      ));
      setEtapaSelecionada(prev => prev ? { ...prev, concluida: true } : null);

      // Avançar para próxima etapa
      const indexAtual = etapas.findIndex(e => e.id === etapaSelecionada.id);
      if (indexAtual < etapas.length - 1) {
        setTimeout(() => {
          setEtapaSelecionada(etapas[indexAtual + 1]);
        }, 1500);
      }

    } catch (error) {
      console.error("Erro ao marcar como concluído:", error);
      toast.error("Erro ao salvar progresso");
    } finally {
      setMarcandoConcluido(false);
    }
  };

  const getIconeEtapa = (etapa: Etapa) => {
    if (etapa.concluida) {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (etapa.id === etapaSelecionada?.id) {
      return <Play className="h-4 w-4 text-primary" />;
    }
    return <Lock className="h-4 w-4 text-muted-foreground/50" />;
  };

  const getIconeConteudo = (tipo: string | null) => {
    switch (tipo) {
      case "video":
        return <Video className="h-5 w-5" />;
      case "texto":
        return <FileText className="h-5 w-5" />;
      case "aula_presencial":
      case "evento":
        return <Calendar className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const renderConteudo = () => {
    if (!etapaSelecionada) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Selecione uma etapa para começar
        </div>
      );
    }

    const { tipo_conteudo, conteudo_url, conteudo_texto } = etapaSelecionada;

    switch (tipo_conteudo) {
      case "video":
        // Converter URL do YouTube para embed
        let embedUrl = conteudo_url || "";
        if (embedUrl.includes("youtube.com/watch")) {
          const videoId = new URL(embedUrl).searchParams.get("v");
          embedUrl = `https://www.youtube.com/embed/${videoId}`;
        } else if (embedUrl.includes("youtu.be/")) {
          const videoId = embedUrl.split("youtu.be/")[1]?.split("?")[0];
          embedUrl = `https://www.youtube.com/embed/${videoId}`;
        }

        return (
          <div className="space-y-4">
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
            <h2 className="text-xl font-semibold">{etapaSelecionada.titulo}</h2>
          </div>
        );

      case "texto":
        return (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h2 className="text-xl font-semibold mb-4">{etapaSelecionada.titulo}</h2>
            <div 
              className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: conteudo_texto || "" }}
            />
          </div>
        );

      case "aula_presencial":
      case "evento":
        return (
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <Calendar className="h-8 w-8" />
                <h2 className="text-xl font-semibold">{etapaSelecionada.titulo}</h2>
              </div>
              
              <p className="text-muted-foreground">
                Esta etapa é uma aula presencial.
              </p>

              {aulaVinculada && (
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(aulaVinculada.data_inicio), "PPP 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {aulaVinculada.sala && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4" />
                      <span>{aulaVinculada.sala.nome}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Compareça à aula para ter sua presença registrada.
              </p>
            </CardContent>
          </Card>
        );

      default:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">{etapaSelecionada.titulo}</h2>
            {conteudo_texto && (
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {conteudo_texto}
              </div>
            )}
            {conteudo_url && (
              <a 
                href={conteudo_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Acessar conteúdo externo
              </a>
            )}
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex">
        <Skeleton className="w-72 h-full" />
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="aspect-video w-full" />
        </div>
      </div>
    );
  }

  const corTema = jornada?.cor_tema || "#3b82f6";

  return (
    <div className="h-screen flex flex-col">
      {/* Header Fixo - Sempre visível */}
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/cursos")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Meus Cursos</span>
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <h1 className="font-medium text-sm truncate hidden sm:block">
            {jornada?.titulo}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {etapas.filter(e => e.concluida).length}/{etapas.length} etapas
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSidebarAberta(!sidebarAberta)}
            className="lg:hidden"
          >
            {sidebarAberta ? "Ver Conteúdo" : "Ver Índice"}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar - Índice */}
        <div className={`
          ${sidebarAberta ? 'flex' : 'hidden'} 
          lg:flex w-full lg:w-80 border-r bg-muted/30 flex-shrink-0 flex-col
        `}>
          <div className="p-4 border-b bg-background lg:block hidden">
            <h2 className="font-semibold line-clamp-2">{jornada?.titulo}</h2>
            {jornada?.descricao && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {jornada.descricao}
              </p>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {etapas.map((etapa, index) => (
                <button
                  key={etapa.id}
                  onClick={() => {
                    setEtapaSelecionada(etapa);
                    setSidebarAberta(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors
                    ${etapa.id === etapaSelecionada?.id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted'}
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${etapa.concluida ? 'bg-green-500/10' : 'bg-muted'}
                  `}>
                    {getIconeEtapa(etapa)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium line-clamp-2 ${etapa.concluida ? 'text-muted-foreground' : ''}`}>
                      {index + 1}. {etapa.titulo}
                    </p>
                    {etapa.concluida && etapa.data_conclusao && (
                      <p className="text-xs text-muted-foreground">
                        Concluído em {format(new Date(etapa.data_conclusao), "dd/MM")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Área Principal */}
        <div className={`flex-1 flex flex-col min-w-0 ${sidebarAberta ? 'hidden lg:flex' : 'flex'}`}>
          {/* Conteúdo */}
          <ScrollArea className="flex-1 p-4 lg:p-6">
            <div className="max-w-4xl mx-auto">
              {renderConteudo()}
            </div>
          </ScrollArea>

          {/* Barra de Ação */}
          {etapaSelecionada && (
            <div 
              className="border-t p-4 bg-background"
              style={{ borderTopColor: corTema }}
            >
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {getIconeConteudo(etapaSelecionada.tipo_conteudo)}
                  <span className="hidden sm:inline">
                    Etapa {etapas.findIndex(e => e.id === etapaSelecionada.id) + 1} de {etapas.length}
                  </span>
                </div>

                {etapaSelecionada.concluida ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Concluído
                      {etapaSelecionada.data_conclusao && (
                        <span className="text-muted-foreground ml-1">
                          em {format(new Date(etapaSelecionada.data_conclusao), "dd/MM/yyyy")}
                        </span>
                      )}
                    </span>
                  </div>
                ) : (
                  <Button 
                    onClick={marcarConcluido}
                    disabled={marcandoConcluido}
                    className="gap-2"
                  >
                    {marcandoConcluido ? (
                      "Salvando..."
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Marcar como Concluído
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
