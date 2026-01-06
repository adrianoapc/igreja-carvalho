import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useFilialId } from "@/hooks/useFilialId";

interface Ministerio {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  vagas_necessarias: number;
  dificuldade: "fácil" | "médio" | "avançado";
  requisitos?: string[];
}

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
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [minhasCandidaturas, setMinhasCandidaturas] = useState<Candidatura[]>(
    []
  );
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [loadingCandidatura, setLoadingCandidatura] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ministerioSelecionado, setMinisterioSelecionado] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statsHero, setStatsHero] = useState({
    ministerios: 0,
    voluntarios: 0,
    aprovacoesMes: 0,
  });

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
        .select(
          "id, ministerio, disponibilidade, experiencia, status, created_at"
        )
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

  // Carregar estatísticas reais do herói
  useEffect(() => {
    const loadHeroStats = async () => {
      if (!igrejaId) return;

      // Contar times ativos
      let timesQuery = supabase
        .from("times")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);
      // times pode não ter filial_id em todos os ambientes
      if (!isAllFiliais && filialId) {
        try {
          // tenta aplicar filial_id se existir
          timesQuery = (timesQuery as any).eq("filial_id", filialId);
        } catch {}
      }
      const timesRes = await timesQuery;

      // Contar membros de times ativos
      let membrosQuery = supabase
        .from("membros_time")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) membrosQuery = membrosQuery.eq("filial_id", filialId);
      const membrosRes = await membrosQuery;

      // Aprovações no mês
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      let aprovQuery = supabase
        .from("candidatos_voluntario")
        .select("id", { count: "exact" })
        .eq("status", "aprovado")
        .eq("igreja_id", igrejaId)
        .gte("data_avaliacao", startMonth)
        .lt("data_avaliacao", nextMonth);
      if (!isAllFiliais && filialId) aprovQuery = aprovQuery.eq("filial_id", filialId);
      const aprovRes = await aprovQuery;

      setStatsHero({
        ministerios: timesRes.count || 0,
        voluntarios: membrosRes.count || 0,
        aprovacoesMes: aprovRes.count || 0,
      });
    };
    loadHeroStats();
  }, [igrejaId, filialId, isAllFiliais]);

  // Carregar ministérios reais da tabela times
  useEffect(() => {
    const loadMinisterios = async () => {
      if (!igrejaId) return;

      let query = supabase
        .from("times")
        .select("id, nome, descricao, cor, vagas_necessarias, dificuldade, ativo")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query.order("nome");

      if (!error && data) {
        setMinisterios(
          data.map((t: any) => ({
            id: t.id,
            nome: t.nome,
            descricao: t.descricao || "Ministério da igreja",
            cor: t.cor || "bg-blue-500",
            vagas_necessarias: t.vagas_necessarias || 1,
            dificuldade: t.dificuldade || "médio",
          }))
        );
      }
    };
    loadMinisterios();
  }, [igrejaId, filialId, isAllFiliais]);

  // Ministérios em que já tem candidatura ativa (não pode duplicar)
  const ministeriosBloqueados = minhasCandidaturas
    .filter((c) => STATUS_BLOQUEANTES.includes(c.status))
    .map((c) => c.ministerio);

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

    const ministerio =
      ministerios.find((m) => m.id === ministerioSelecionado)?.nome ||
      ministerioSelecionado;


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
        setMinhasCandidaturas((prev) => [
          {
            id: result.id,
            ministerio: result.ministerio,
            disponibilidade: result.disponibilidade,
            experiencia: result.experiencia,
            status: result.status,
            created_at: result.created_at,
          },
          ...prev,
        ]);
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
  };

  if (authLoading || loadingCandidatura) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const candidaturasAtivas = minhasCandidaturas.filter(
    (c) => c.status !== "rejeitado"
  );

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
                  Toda pessoa tem um chamado único. Descubra como você pode
                  servir e fazer diferença em nossa comunidade.
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
                { icon: Zap, label: "Ministérios", value: statsHero.ministerios },
                { icon: Users, label: "Voluntários", value: statsHero.voluntarios },
                { icon: Target, label: "Aprovações no mês", value: statsHero.aprovacoesMes },
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
            {ministerios.length === 0 ? (
              <Card>
                <CardContent className="pt-8 text-center text-muted-foreground">
                  <p>Nenhum ministério cadastrado para essa filial.</p>
                </CardContent>
              </Card>
            ) : (
              <motion.div
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {ministerios.map((ministerio, idx) => (
                  <MinisterioCard
                    key={ministerio.id}
                    nome={ministerio.nome}
                    descricao={ministerio.descricao}
                    icone={Heart}
                    cor={ministerio.cor}
                    vagas={ministerio.vagas_necessarias}
                    dificuldade={ministerio.dificuldade}
                    requisitos={ministerio.requisitos || []}
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
            )}
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

              {ministeriosBloqueados.length < ministerios.length && (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      💡 Você pode se candidatar a outros ministérios. Volte à
                      aba "Ministérios" para explorar mais oportunidades.
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
              ministerios.find((m) => m.id === ministerioSelecionado)
                ?.nome || "Ministério"
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
