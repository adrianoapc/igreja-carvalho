import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Play, ChevronRight } from "lucide-react";

interface InscricaoComProgresso {
  id: string;
  jornada_id: string;
  etapa_atual_id: string | null;
  concluido: boolean;
  jornada: {
    id: string;
    titulo: string;
    descricao: string | null;
    cor_tema: string | null;
  };
  totalEtapas: number;
  etapasConcluidas: number;
}

export default function MeusCursos() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [inscricoes, setInscricoes] = useState<InscricaoComProgresso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchInscricoes();
    }
  }, [profile?.id]);

  const fetchInscricoes = async () => {
    if (!profile?.id) return;

    try {
      // Buscar inscrições do aluno
      const { data: inscricoesData, error } = await supabase
        .from("inscricoes_jornada")
        .select(`
          id,
          jornada_id,
          etapa_atual_id,
          concluido,
          jornada:jornadas(id, titulo, descricao, cor_tema)
        `)
        .eq("pessoa_id", profile.id)
        .eq("concluido", false);

      if (error) throw error;

      // Para cada inscrição, calcular progresso
      const inscricoesComProgresso: InscricaoComProgresso[] = [];

      for (const inscricao of inscricoesData || []) {
        // Buscar total de etapas
        const { count: totalEtapas } = await supabase
          .from("etapas_jornada")
          .select("*", { count: "exact", head: true })
          .eq("jornada_id", inscricao.jornada_id);

        // Buscar etapas concluídas (presencas_aula com etapa_id desta jornada)
        const { data: etapasJornada } = await supabase
          .from("etapas_jornada")
          .select("id")
          .eq("jornada_id", inscricao.jornada_id);

        const etapaIds = etapasJornada?.map(e => e.id) || [];
        
        let etapasConcluidas = 0;
        if (etapaIds.length > 0) {
          const { count } = await supabase
            .from("presencas_aula")
            .select("*", { count: "exact", head: true })
            .eq("aluno_id", profile.id)
            .in("etapa_id", etapaIds)
            .eq("status", "concluido");
          etapasConcluidas = count || 0;
        }

        inscricoesComProgresso.push({
          ...inscricao,
          jornada: Array.isArray(inscricao.jornada) ? inscricao.jornada[0] : inscricao.jornada,
          totalEtapas: totalEtapas || 0,
          etapasConcluidas,
        });
      }

      setInscricoes(inscricoesComProgresso);
    } catch (error) {
      console.error("Erro ao buscar inscrições:", error);
    } finally {
      setLoading(false);
    }
  };

  const calcularProgresso = (inscricao: InscricaoComProgresso) => {
    if (inscricao.totalEtapas === 0) return 0;
    return Math.round((inscricao.etapasConcluidas / inscricao.totalEtapas) * 100);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Meus Cursos</h1>
      </div>

      {inscricoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum curso encontrado</h3>
            <p className="text-muted-foreground text-sm">
              Você ainda não está inscrito em nenhuma jornada de ensino.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {inscricoes.map((inscricao) => {
            const progresso = calcularProgresso(inscricao);
            const corTema = inscricao.jornada?.cor_tema || "#3b82f6";
            
            return (
              <Card 
                key={inscricao.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/cursos/${inscricao.jornada_id}`)}
              >
                <div 
                  className="h-2" 
                  style={{ backgroundColor: corTema }}
                />
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-2">
                    {inscricao.jornada?.titulo}
                  </CardTitle>
                  {inscricao.jornada?.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {inscricao.jornada.descricao}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{progresso}%</span>
                    </div>
                    <Progress value={progresso} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {inscricao.etapasConcluidas} de {inscricao.totalEtapas} etapas concluídas
                    </p>
                  </div>
                  
                  <Button className="w-full" size="sm">
                    {progresso === 0 ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Iniciar
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-4 w-4 mr-2" />
                        Continuar
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
