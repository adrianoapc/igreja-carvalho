import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLiturgiaInteligente } from "@/hooks/useLiturgiaInteligente";
import { VisitantesSlide } from "@/components/oracao/VisitantesSlide";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Pause,
  Music,
  BookOpen,
  ListChecks,
  Quote,
  AlertCircle,
  ThumbsUp,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format, addMinutes, differenceInSeconds } from "date-fns";

// --- Tipos Locais ---
interface LiturgiaItem {
  id: string;
  tipo:
    | "VIDEO"
    | "VERSICULO"
    | "PEDIDOS"
    | "AVISO"
    | "TIMER"
    | "CUSTOM_TESTEMUNHO"
    | "CUSTOM_SENTIMENTO"
    | "CUSTOM_VISITANTES";
  titulo: string;
  conteudo?: string | null; // URL do video, Texto do versículo, JSON stringificado, etc.
  duracao_sugerida_min?: number;
  ordem: number;
}

interface LiturgiaData {
  id: string;
  tipo?: string;
  titulo?: string;
  descricao?: string;
  duracao_minutos?: number;
  ordem: number;
}

interface Pedido {
  id: string;
  pedido: string;
  tipo: string;
  status: string;
  data_criacao: string;
  nome_solicitante?: string;
}

interface EscalaInfo {
  id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  evento: {
    id: string;
    titulo: string;
  };
  pessoa: {
    nome: string;
  };
}

export default function PrayerPlayer() {
  const { escalaId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [escala, setEscala] = useState<EscalaInfo | null>(null);
  const [eventoId, setEventoId] = useState<string | undefined>(undefined);
  const [slides, setSlides] = useState<LiturgiaItem[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pedidosOrados, setPedidosOrados] = useState<Set<string>>(new Set()); // Rastreia pedidos que orou

  // Hook para carregar playlist inteligente (passa evento_id quando disponível)
  const {
    alertaEspiritual,
    testemunhos,
    visitantes,
    broadcast,
    pessoais,
    slides: slidesFromEdge,
    loading: loadingSmart,
  } = useLiturgiaInteligente(eventoId);

  // Carregar Dados
  useEffect(() => {
    async function loadData() {
      if (!escalaId) {
        console.error("❌ escalaId não encontrado");
        setError("ID da escala não encontrado");
        toast.error("ID da escala não encontrado");
        setLoading(false);
        return;
      }

      console.log("🔍 Carregando escala:", escalaId);

      try {
        // 1. Buscar Detalhes da Escala
        const { data: escalaData, error: errEscala } = await supabase
          .from("escalas")
          .select(
            `
            id, 
            data_hora_inicio, 
            data_hora_fim,
            evento_id,
            pessoa_id,
            eventos!inner (
              id, 
              titulo
            ),
            profiles!inner (
              nome
            )
          `
          )
          .eq("id", escalaId)
          .single();

        console.log("📦 Dados da escala:", escalaData);
        console.log("⚠️ Erro da escala:", errEscala);

        if (errEscala) {
          console.error("Erro ao buscar escala:", errEscala);
          throw errEscala;
        }

        if (!escalaData) {
          throw new Error("Escala não encontrada");
        }

        // Type casting seguro
        const escalaFormatada: EscalaInfo = {
          id: escalaData.id,
          data_hora_inicio:
            escalaData.data_hora_inicio || new Date().toISOString(),
          data_hora_fim:
            escalaData.data_hora_fim ||
            addMinutes(new Date(), 60).toISOString(),
          evento: {
            id: escalaData.eventos.id,
            titulo: escalaData.eventos.titulo,
          },
          pessoa: {
            nome: escalaData.profiles.nome,
          },
        };

        console.log("✅ Escala formatada:", escalaFormatada);
        setEscala(escalaFormatada);
        setEventoId(escalaFormatada.evento.id); // Define evento_id para o hook

        // 2. Buscar Liturgia (Roteiro)
        const { data: liturgiaData, error: liturgiaError } = await supabase
          .from("liturgias")
          .select("*")
          .eq("evento_id", escalaFormatada.evento.id)
          .order("ordem");

        console.log("📋 Liturgia encontrada:", liturgiaData);
        console.log("⚠️ Erro liturgia:", liturgiaError);

        if (liturgiaData && liturgiaData.length > 0) {
          // Caso contrário, constrói o roteiro manualmente
          // Mapear para o formato local
          const items: LiturgiaItem[] = liturgiaData.map((l: LiturgiaData) => ({
            id: l.id,
            tipo: (l.tipo || "AVISO") as LiturgiaItem["tipo"],
            titulo: l.titulo || "Momento de Oração",
            conteudo: l.descricao || "",
            duracao_sugerida_min: l.duracao_minutos || 5,
            ordem: l.ordem,
          }));

          // Construir roteiro final com slides inteligentes
          const roteiroFinal = [...items];

          // A. BLOCO DE GRATIDÃO (Testemunhos)
          if (testemunhos && testemunhos.length > 0 && !loadingSmart) {
            console.log("📖 Adicionando slide de Testemunhos");
            roteiroFinal.push({
              id: "gratidao-auto",
              tipo: "CUSTOM_TESTEMUNHO",
              titulo: "Tempo de Gratidão",
              conteudo: JSON.stringify(testemunhos),
              duracao_sugerida_min: 3,
              ordem: 1.1,
            });
          }

          // B. BLOCO DE ALERTA (Sentimentos Críticos)
          if (
            alertaEspiritual &&
            alertaEspiritual.length > 0 &&
            !loadingSmart
          ) {
            console.log("📖 Adicionando slide de Alerta Espiritual");
            roteiroFinal.push({
              id: "insight-auto",
              tipo: "CUSTOM_SENTIMENTO",
              titulo: "Termômetro Espiritual",
              conteudo: JSON.stringify(alertaEspiritual),
              duracao_sugerida_min: 2,
              ordem: 1.2,
            });
          }

          // C. BLOCO DE VIDAS (Visitantes)
          if (visitantes && visitantes.length > 0 && !loadingSmart) {
            console.log("📖 Adicionando slide de Visitantes");
            roteiroFinal.push({
              id: "visitantes-auto",
              tipo: "CUSTOM_VISITANTES",
              titulo: "Vidas Novas",
              conteudo: JSON.stringify(visitantes),
              duracao_sugerida_min: 3,
              ordem: 1.3,
            });
          }

          // D. PEDIDOS BROADCAST
          if (broadcast && broadcast.length > 0 && !loadingSmart) {
            console.log("📖 Adicionando slide de Broadcast");
            roteiroFinal.push({
              id: "broadcast-auto",
              tipo: "PEDIDOS",
              titulo: "Prioridades do Reino",
              conteudo: JSON.stringify(broadcast),
              duracao_sugerida_min: 5,
              ordem: 1.4,
            });
          }

          // E. PEDIDOS PESSOAIS
          if (pessoais && pessoais.length > 0 && !loadingSmart) {
            console.log("📖 Adicionando slide de Pedidos Pessoais");
            roteiroFinal.push({
              id: "pessoais-auto",
              tipo: "PEDIDOS",
              titulo: "Carga de Intercessão",
              conteudo: JSON.stringify(pessoais),
              duracao_sugerida_min: 10,
              ordem: 1.5,
            });
          }

          // Reordenar por ordem
          roteiroFinal.sort((a, b) => a.ordem - b.ordem);

          console.log(
            "✅ Roteiro final com slides inteligentes:",
            roteiroFinal
          );
          setSlides(roteiroFinal);
        } else {
          console.log("⚠️ Sem liturgia, usando fallback");
          // Fallback se não tiver roteiro
          setSlides([
            {
              id: "1",
              tipo: "AVISO",
              titulo: "Bem-vindo ao Turno",
              conteudo: "Prepare o seu coração para ouvir a Deus.",
              duracao_sugerida_min: 5,
              ordem: 1,
            },
            {
              id: "2",
              tipo: "VERSICULO",
              titulo: "Palavra do Dia",
              conteudo: "Orai sem cessar. (1 Tessalonicenses 5:17)",
              duracao_sugerida_min: 10,
              ordem: 2,
            },
            {
              id: "3",
              tipo: "TIMER",
              titulo: "Intercessão Livre",
              conteudo: "Ore pela igreja e liderança.",
              duracao_sugerida_min: 30,
              ordem: 3,
            },
            {
              id: "4",
              tipo: "AVISO",
              titulo: "Encerramento",
              conteudo: "Obrigado por guardar o turno!",
              duracao_sugerida_min: 5,
              ordem: 4,
            },
          ]);
        }

        console.log("✅ Slides carregados:", slides.length);
      } catch (error) {
        console.error("❌ Erro ao carregar player:", error);
        const errorMsg =
          error instanceof Error ? error.message : "Erro ao carregar roteiro.";
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        console.log("🏁 Loading finalizado");
        setLoading(false);
      }
    }
    loadData();
  }, [escalaId]);

  // Atualizar slides quando o Edge Function retornar dados
  useEffect(() => {
    if (slidesFromEdge && slidesFromEdge.length > 0) {
      console.log(
        "🎯 Atualizando slides com dados da Edge Function:",
        slidesFromEdge
      );
      setSlides(slidesFromEdge as LiturgiaItem[]);
      setLoading(false);
    }
  }, [slidesFromEdge]);

  // Carregar pedidos que o usuário já orou
  useEffect(() => {
    async function carregarPedidosOrados() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Busca pedidos que o usuário é intercessor e estão em oração
        const { data: pedidosOrados, error } = await supabase
          .from("pedidos_oracao")
          .select("id")
          .eq("intercessor_id", user.id)
          .eq("status", "em_oracao");

        if (error) {
          console.error("❌ Erro ao carregar pedidos orados:", error);
          return;
        }

        // Popula o set com os IDs dos pedidos orados
        if (pedidosOrados && pedidosOrados.length > 0) {
          const ids = new Set(pedidosOrados.map((p) => p.id));
          setPedidosOrados(ids);
          console.log(`✅ Carregados ${ids.size} pedidos orados pelo usuário`);
        }
      } catch (error) {
        console.error(
          "❌ Erro ao carregar histórico de pedidos orados:",
          error
        );
      }
    }

    carregarPedidosOrados();
  }, []);

  // Timer do Turno Geral
  useEffect(() => {
    if (!escala) return;

    const tick = () => {
      const now = new Date();
      const end = new Date(escala.data_hora_fim);
      const diff = differenceInSeconds(end, now);
      setTimeLeft(diff > 0 ? diff : 0);
    };

    tick(); // Inicial
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [escala]);

  // Navegação
  const nextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
    } else {
      toast.success("Turno finalizado! Deus abençoe.");
      navigate("/");
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
    }
  };

  // Marcar pedido como orado
  const marcarComoOrado = async (pedidoId: string) => {
    try {
      // Marca visualmente imediatamente (otimista)
      setPedidosOrados((prev) => new Set([...prev, pedidoId]));

      // Obtém usuário atual
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Atualiza status do pedido no banco
      const { error: updateError } = await supabase
        .from("pedidos_oracao")
        .update({
          status: "em_oracao",
          intercessor_id: user.id,
          data_alocacao: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (updateError) throw updateError;

      // Notifica ao usuário
      toast.success("✅ Obrigado pela oração!", {
        description: "Sua intercessão foi registrada no sistema.",
      });

      console.log(`✅ Pedido ${pedidoId} marcado como em oração`);
    } catch (error) {
      console.error("❌ Erro ao marcar como orado:", error);
      toast.error("Erro ao registrar a oração", {
        description: error instanceof Error ? error.message : "Tente novamente",
      });
      // Reverte a mudança visual em caso de erro
      setPedidosOrados((prev) => {
        const next = new Set(prev);
        next.delete(pedidoId);
        return next;
      });
    }
  };

  // Formatar tempo restante (MM:SS)
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading)
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Carregando turno...</p>
        </div>
      </div>
    );

  if (error || !escala) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 mb-4">
            <X className="h-16 w-16 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Erro</h2>
          <p className="text-gray-400 mb-6">
            {error || "Escala não encontrada"}
          </p>
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="text-white border-white"
          >
            Voltar ao Início
          </Button>
        </div>
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];

  return (
    <div className="h-screen w-full bg-black text-white flex flex-col relative overflow-hidden">
      {/* --- HEADER --- */}
      <div className="absolute top-0 left-0 w-full z-50 p-4 bg-gradient-to-b from-black/80 to-transparent">
        {/* Barra de Progresso Segmentada */}
        <div className="flex gap-1 mb-4">
          {slides.map((_, idx) => (
            <div
              key={idx}
              className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden"
            >
              <div
                className={`h-full bg-white transition-all duration-300 ${
                  idx <= currentSlideIndex ? "w-full" : "w-0"
                }`}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => navigate("/")}
          >
            <X className="h-6 w-6" />
          </Button>

          <div className="flex flex-col items-center">
            <span className="text-xs font-medium uppercase tracking-widest opacity-70">
              {escala?.evento.titulo}
            </span>
            <span className="font-bold text-sm">{currentSlide.titulo}</span>
          </div>

          <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full backdrop-blur-md">
            <Clock className="h-3 w-3 text-red-400 animate-pulse" />
            <span className="text-xs font-mono font-bold">
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </div>

      {/* --- CONTEÚDO CENTRAL (SLIDE) --- */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative">
        {/* Renderização Condicional baseada no TIPO */}
        {currentSlide.tipo === "VERSICULO" && (
          <div className="animate-in fade-in zoom-in duration-500 max-w-md">
            <BookOpen className="h-12 w-12 mx-auto mb-6 text-amber-400 opacity-80" />
            <h2 className="text-2xl md:text-4xl font-serif italic leading-relaxed">
              "{currentSlide.conteudo}"
            </h2>
          </div>
        )}

        {currentSlide.tipo === "VIDEO" && (
          <div className="w-full max-w-2xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
            {/* Aqui iria um Iframe do YouTube. Usando placeholder por enquanto */}
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <Play className="h-16 w-16 mx-auto mb-4 text-white opacity-50" />
                <p className="text-sm text-gray-400">
                  Vídeo: {currentSlide.conteudo}
                </p>
              </div>
            </div>
          </div>
        )}

        {currentSlide.tipo === "PEDIDOS" && (
          <div className="w-full max-w-md h-[60vh] overflow-y-auto space-y-3 text-left p-2">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <ListChecks className="h-5 w-5" />
              <h3 className="font-bold uppercase tracking-wide">
                Pedidos de Oração
              </h3>
            </div>
            {/* Renderiza pedidos reais do conteúdo */}
            {currentSlide.conteudo ? (
              (() => {
                try {
                  const pedidos = JSON.parse(currentSlide.conteudo);
                  return Array.isArray(pedidos) && pedidos.length > 0 ? (
                    pedidos.map((pedido: Pedido) => {
                      const orou = pedidosOrados.has(pedido.id);
                      return (
                        <div
                          key={pedido.id}
                          className={`p-4 rounded-lg border transition-all duration-300 cursor-pointer group ${
                            orou
                              ? "bg-green-500/10 border-green-400/50 shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                              : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm line-clamp-2">
                                {pedido.pedido}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>
                                  {pedido.nome_solicitante
                                    ? `Por: ${pedido.nome_solicitante}`
                                    : "Anônimo"}
                                </span>
                                {pedido.tipo && <span>• {pedido.tipo}</span>}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={orou ? "default" : "ghost"}
                              className={`flex-shrink-0 transition-all ${
                                orou
                                  ? "bg-green-600 hover:bg-green-700 text-white shadow-[0_0_12px_rgba(34,197,94,0.4)]"
                                  : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                              }`}
                              onClick={() => marcarComoOrado(pedido.id)}
                            >
                              {orou ? (
                                <ThumbsUp className="w-4 h-4" />
                              ) : (
                                <Heart className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Nenhum pedido disponível</p>
                    </div>
                  );
                } catch (e) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Erro ao carregar pedidos</p>
                    </div>
                  );
                }
              })()
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Nenhum pedido disponível</p>
              </div>
            )}
          </div>
        )}

        {(currentSlide.tipo === "AVISO" || currentSlide.tipo === "TIMER") && (
          <div className="animate-in slide-in-from-bottom duration-500">
            <h2 className="text-3xl font-bold mb-4">{currentSlide.titulo}</h2>
            <p className="text-lg text-gray-300 max-w-prose mx-auto">
              {currentSlide.conteudo}
            </p>
            {currentSlide.tipo === "TIMER" && (
              <div className="mt-8 text-6xl font-mono font-thin opacity-50">
                {currentSlide.duracao_sugerida_min}:00
              </div>
            )}
          </div>
        )}

        {currentSlide.tipo === "CUSTOM_VISITANTES" && (
          <VisitantesSlide
            visitantes={
              currentSlide.conteudo ? JSON.parse(currentSlide.conteudo) : []
            }
          />
        )}

        {currentSlide.tipo === "CUSTOM_TESTEMUNHO" && (
          <div className="w-full max-w-2xl animate-in slide-in-from-right duration-500">
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl p-8 border border-amber-400/30">
              <div className="flex items-center gap-3 mb-6">
                <Quote className="h-6 w-6 text-amber-400 flex-shrink-0" />
                <h3 className="text-lg font-semibold text-amber-100">
                  Testemunho
                </h3>
              </div>
              <p className="text-base leading-relaxed text-white/90 italic">
                "{currentSlide.conteudo}"
              </p>
            </div>
          </div>
        )}

        {currentSlide.tipo === "CUSTOM_SENTIMENTO" && (
          <div className="w-full max-w-2xl animate-in slide-in-from-bottom duration-500">
            <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-2xl p-8 border border-red-400/30">
              <div className="flex items-center gap-3 mb-6">
                <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
                <h3 className="text-lg font-semibold text-red-100">
                  Alerta Espiritual
                </h3>
              </div>
              <p className="text-base leading-relaxed text-white/90">
                {currentSlide.conteudo}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* --- RODAPÉ / NAVEGAÇÃO --- */}
      <div className="absolute bottom-0 left-0 w-full p-8 z-50 flex justify-between items-center bg-gradient-to-t from-black via-black/50 to-transparent h-32">
        <Button
          variant="ghost"
          className="text-white/50 hover:text-white hover:bg-white/10 h-14 w-14 rounded-full"
          onClick={prevSlide}
          disabled={currentSlideIndex === 0}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>

        <span className="text-xs text-white/30 uppercase tracking-widest">
          {currentSlideIndex + 1} / {slides.length}
        </span>

        <Button
          variant="default"
          className="bg-white text-black hover:bg-gray-200 h-14 w-14 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-transform active:scale-95"
          onClick={nextSlide}
        >
          {currentSlideIndex === slides.length - 1 ? (
            <div className="h-4 w-4 bg-black rounded-sm" /> // Stop Icon logic
          ) : (
            <ChevronRight className="h-8 w-8" />
          )}
        </Button>
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-radial from-blue-900/20 to-transparent pointer-events-none" />
    </div>
  );
}
