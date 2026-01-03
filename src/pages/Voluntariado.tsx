import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MinhaInscricaoCard from "@/components/voluntariado/MinhaInscricaoCard";
import MinisterioCard from "@/components/voluntario/MinisterioCard";
import InscricaoModal from "@/components/voluntario/InscricaoModal";
import StatusTimeline from "@/components/voluntario/StatusTimeline";
import { Loader2, Heart, Users, Zap, Target } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ministryOptions = [
  {
    id: "recepcao",
    nome: "Recepção",
    descricao: "Acolha visitantes com um sorriso caloroso na entrada",
    cor: "bg-blue-500",
    vagas: 5,
    dificuldade: "fácil" as const,
    requisitos: ["Simpatia", "Pontualidade", "Disponibilidade nos cultos"],
  },
  {
    id: "louvor",
    nome: "Louvor",
    descricao: "Ministrar através da música e adoração",
    cor: "bg-purple-500",
    vagas: 3,
    dificuldade: "avançado" as const,
    requisitos: ["Habilidades musicais", "Comprometimento semanal", "Experiência em louvor"],
  },
  {
    id: "midia",
    nome: "Mídia",
    descricao: "Gerenciar projetor, áudio e transmissão ao vivo",
    cor: "bg-green-500",
    vagas: 4,
    dificuldade: "médio" as const,
    requisitos: ["Conhecimento técnico básico", "Responsabilidade", "Pontualidade"],
  },
  {
    id: "kids",
    nome: "Kids",
    descricao: "Cuidar e ensinar crianças durante os cultos",
    cor: "bg-pink-500",
    vagas: 6,
    dificuldade: "médio" as const,
    requisitos: ["Paciência", "Afinidade com crianças", "Capacidade de liderança"],
  },
  {
    id: "intercessao",
    nome: "Intercessão",
    descricao: "Orar e interceder pelos ministérios e membros",
    cor: "bg-red-500",
    vagas: 8,
    dificuldade: "fácil" as const,
    requisitos: ["Vida de oração", "Sensibilidade espiritual", "Disponibilidade flexível"],
  },
  {
    id: "acao-social",
    nome: "Ação Social",
    descricao: "Ajudar pessoas em situação de vulnerabilidade",
    cor: "bg-orange-500",
    vagas: 10,
    dificuldade: "médio" as const,
    requisitos: ["Compaixão", "Organização", "Disponibilidade eventual"],
  },
  {
    id: "eventos",
    nome: "Eventos",
    descricao: "Organizar e coordenar eventos da igreja",
    cor: "bg-cyan-500",
    vagas: 5,
    dificuldade: "avançado" as const,
    requisitos: ["Liderança", "Criatividade", "Disponibilidade variável"],
  },
];

type VolunteerFormData = {
  ministerio_id: string;
  disponibilidade: string;
  experiencia: string;
  observacoes: string;
  telefone?: string;
  email?: string;
};

interface Candidatura {
  id: string;
  ministerio: string;
  disponibilidade: string;
  experiencia: string;
  status: string;
  created_at: string;
}

const STATUS_BLOQUEANTES = ["pendente", "em_analise", "aprovado", "em_trilha"];

export default function Voluntariado() {
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const [minhasCandidaturas, setMinhasCandidaturas] = useState<Candidatura[]>([]);
  const [loadingCandidatura, setLoadingCandidatura] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ministerioSelecionado, setMinisterioSelecionado] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preencher dados do perfil se logado
  useEffect(() => {
    if (profile) {
      // dados carregados do perfil
    }
  }, [profile]);

  // Verificar candidaturas existentes
  useEffect(() => {
    const fetchMinhasCandidaturas = async () => {
      if (!profile?.id) {
        setLoadingCandidatura(false);
        return;
      }

      const { data, error } = await supabase
        .from("candidatos_voluntario")
        .select("id, ministerio, disponibilidade, experiencia, status, created_at")
        .eq("pessoa_id", profile.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setMinhasCandidaturas(data);
      }
      setLoadingCandidatura(false);
    };

    if (!authLoading) {
      fetchMinhasCandidaturas();
    }
  }, [profile?.id, authLoading]);

  // Ministérios em que já tem candidatura ativa (não pode duplicar)
  const ministeriosBloqueados = minhasCandidaturas
    .filter(c => STATUS_BLOQUEANTES.includes(c.status))
    .map(c => c.ministerio);

  const handleAbrir = (ministerioId: string) => {
    setMinisterioSelecionado(ministerioId);
    setModalOpen(true);
  };

  const handleInscricao = async (data: {
    disponibilidade: string;
    experiencia: string;
    observacoes: string;
    telefone?: string;
    email?: string;
  }) => {
    if (!ministerioSelecionado) return;

    const ministerio = ministryOptions.find(m => m.id === ministerioSelecionado)?.nome || ministerioSelecionado;

    setIsSubmitting(true);
    try {
      const { data: result, error } = await supabase
        .from("candidatos_voluntario")
        .insert({
          pessoa_id: profile?.id || null,
          nome_contato: profile?.nome || "Visitante",
          telefone_contato: data.telefone || profile?.telefone || null,
          email_contato: data.email || profile?.email || null,
          ministerio: ministerio,
          disponibilidade: data.disponibilidade,
          experiencia: data.experiencia,
          observacoes: data.observacoes || null,
          status: "pendente",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Candidatura enviada! 🎉",
        description: `Sua inscrição para ${ministerio} foi recebida. Entraremos em contato em breve!`,
      });

      if (result) {
        setMinhasCandidaturas(prev => [{
          id: result.id,
          ministerio: result.ministerio,
          disponibilidade: result.disponibilidade,
          experiencia: result.experiencia,
          status: result.status,
          created_at: result.created_at,
        }, ...prev]);
      }

      setModalOpen(false);
      setMinisterioSelecionado(null);
    } catch (error: unknown) {
      console.error("Erro ao enviar inscrição:", error);
      toast({
        title: "Não foi possível enviar",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || loadingCandidatura) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const candidaturasAtivas = minhasCandidaturas.filter(c => c.status !== "rejeitado");

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-transparent to-transparent">
      <div className="space-y-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent" />
          <div className="relative space-y-4 py-12">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Heart className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold">Voluntariado</h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                  Toda pessoa tem um chamado único. Descubra como você pode servir e fazer diferença em nossa comunidade.
                </p>
              </div>
            </div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-3 gap-4 mt-8"
            >
              {[
                { icon: Zap, label: "Ministérios", value: ministryOptions.length },
                { icon: Users, label: "Voluntários", value: "200+" },
                { icon: Target, label: "Impacto", value: "Alto" },
              ].map((stat, idx) => (
                <motion.div
                  key={idx}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className="p-4 rounded-lg bg-card border"
                >
                  <stat.icon className="w-5 h-5 text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* Abas */}
        <Tabs defaultValue="ministerios" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="ministerios">Ministérios</TabsTrigger>
            {candidaturasAtivas.length > 0 && (
              <TabsTrigger value="minhas-inscricoes">
                Minhas Inscrições ({candidaturasAtivas.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tab: Ministérios */}
          <TabsContent value="ministerios" className="space-y-6 mt-6">
            <motion.div
              layout
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {ministryOptions.map((ministerio, idx) => (
                <MinisterioCard
                  key={ministerio.id}
                  nome={ministerio.nome}
                  descricao={ministerio.descricao}
                  icone={Heart}
                  cor={ministerio.cor}
                  vagas={ministerio.vagas}
                  dificuldade={ministerio.dificuldade}
                  requisitos={ministerio.requisitos}
                  desabilitado={ministeriosBloqueados.includes(ministerio.nome)}
                  motivo={
                    ministeriosBloqueados.includes(ministerio.nome)
                      ? "Você já tem uma candidatura ativa neste ministério"
                      : undefined
                  }
                  onSelect={() => handleAbrir(ministerio.id)}
                />
              ))}
            </motion.div>
          </TabsContent>

          {/* Tab: Minhas Inscrições */}
          {candidaturasAtivas.length > 0 && (
            <TabsContent value="minhas-inscricoes" className="space-y-6 mt-6">
              <motion.div
                layout
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {candidaturasAtivas.map((candidatura) => (
                  <motion.div
                    key={candidatura.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <MinhaInscricaoCard candidatura={candidatura} />
                  </motion.div>
                ))}
              </motion.div>

              {ministeriosBloqueados.length < ministryOptions.length && (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      💡 Você pode se candidatar a outros ministérios. Volte à aba "Ministérios" para explorar mais oportunidades.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* Modal de Inscrição */}
        {ministerioSelecionado && (
          <InscricaoModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            ministerio={
              ministryOptions.find(m => m.id === ministerioSelecionado)?.nome || "Ministério"
            }
            perfil={
              profile
                ? {
                    nome: profile.nome || "",
                    telefone: profile.telefone || "",
                    email: profile.email || "",
                  }
                : undefined
            }
            onSubmit={handleInscricao}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Footer CTA */}
        {candidaturasAtivas.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="py-8 text-center"
          >
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-8">
                <p className="text-base text-muted-foreground mb-4">
                  Quer saber mais sobre o processo de integração?
                </p>
                <Button variant="outline" asChild>
                  <a href="#como-funciona">Ver processo</a>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
