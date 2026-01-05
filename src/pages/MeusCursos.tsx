import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookOpen, Play, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useConfiguracaoFinanceiraEnsino } from "@/hooks/useConfiguracaoFinanceiraEnsino";
import { useFilialId } from "@/hooks/useFilialId";

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
    exibir_portal: boolean | null;
    requer_pagamento?: boolean | null;
    valor?: number | null;
  };
  status_pagamento?: "isento" | "pendente" | "pago" | null;
  totalEtapas: number;
  etapasConcluidas: number;
}

interface SupabaseInscricao extends Omit<InscricaoComProgresso, "totalEtapas" | "etapasConcluidas" | "id"> {
  id: string;
}

interface JornadaDisponivel {
  id: string;
  titulo: string;
  descricao: string | null;
  cor_tema: string | null;
  requer_pagamento?: boolean | null;
  valor?: number | null;
}

export default function MeusCursos() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [inscricoes, setInscricoes] = useState<InscricaoComProgresso[]>([]);
  const [jornadasDisponiveis, setJornadasDisponiveis] = useState<JornadaDisponivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDisponiveis, setLoadingDisponiveis] = useState(true);
  const [activeTab, setActiveTab] = useState("inscritos");
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const { categoriaId, baseMinisterialId, contaId } = useConfiguracaoFinanceiraEnsino();
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false);
  const [pagamentoMensagem, setPagamentoMensagem] = useState("");

  const fetchInscricoes = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data: inscricoesData, error } = await supabase
        .from("inscricoes_jornada")
        .select(`
          id,
          jornada_id,
          etapa_atual_id,
          concluido,
          status_pagamento,
          jornada:jornadas!inner(id, titulo, descricao, cor_tema, exibir_portal, requer_pagamento, valor)
        `)
        .eq("pessoa_id", profile.id)
        .eq("concluido", false)
        .eq("jornada.exibir_portal", true);

      if (error) throw error;

      const inscricoesComProgresso: InscricaoComProgresso[] = [];

      for (const inscricao of (inscricoesData || []) as SupabaseInscricao[]) {
        const { count: totalEtapas } = await supabase
          .from("etapas_jornada")
          .select("*", { count: "exact", head: true })
          .eq("jornada_id", inscricao.jornada_id);

        const { data: etapasJornada } = await supabase
          .from("etapas_jornada")
          .select("id")
          .eq("jornada_id", inscricao.jornada_id);

        const etapaIds = etapasJornada?.map((e) => e.id) || [];

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

        const jornadaNormalizada = Array.isArray(inscricao.jornada)
          ? inscricao.jornada[0]
          : inscricao.jornada;

        inscricoesComProgresso.push({
          ...inscricao,
          jornada: jornadaNormalizada,
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
  }, [profile?.id]);

  const fetchDisponiveis = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoadingDisponiveis(true);

      const { data: inscricoesUsuario, error: inscricoesError } = await supabase
        .from("inscricoes_jornada")
        .select("jornada_id, status_pagamento")
        .eq("pessoa_id", profile.id);

      if (inscricoesError) throw inscricoesError;

      const idsInscritos = new Set((inscricoesUsuario || []).map((i) => i.jornada_id));

      const { data: jornadas, error } = await supabase
        .from("jornadas")
        .select("id, titulo, descricao, cor_tema, requer_pagamento, valor, ativo, exibir_portal")
        .eq("ativo", true)
        .eq("exibir_portal", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const filtradas = (jornadas || []).filter((j) => !idsInscritos.has(j.id));
      setJornadasDisponiveis(filtradas);
    } catch (error) {
      console.error("Erro ao buscar jornadas disponíveis:", error);
      toast.error("Não foi possível carregar jornadas disponíveis");
    } finally {
      setLoadingDisponiveis(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      fetchInscricoes();
      fetchDisponiveis();
    }
  }, [profile?.id, fetchInscricoes, fetchDisponiveis]);

  const calcularProgresso = (inscricao: InscricaoComProgresso) => {
    if (inscricao.totalEtapas === 0) return 0;
    return Math.round((inscricao.etapasConcluidas / inscricao.totalEtapas) * 100);
  };

  const handleInscrever = async (jornada: JornadaDisponivel) => {
    if (!profile?.id) return;
    setEnrollingId(jornada.id);

    try {
      if (!jornada.requer_pagamento) {
        const { error } = await supabase.from("inscricoes_jornada").insert({
          jornada_id: jornada.id,
          pessoa_id: profile.id,
          responsavel_id: profile.id,
          status_pagamento: "isento",
        });
        if (error) throw error;
        toast.success("Inscrição realizada com sucesso");
        await Promise.all([fetchInscricoes(), fetchDisponiveis()]);
        navigate(`/cursos/${jornada.id}`);
        return;
      }

      // Curso pago
      if (!contaId) {
        toast.error("Configuração financeira ausente (conta padrão). Configure em Financeiro.");
        return;
      }
      const hoje = new Date();
      const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

      const { data: transacaoCriada, error: txError } = await supabase
        .from("transacoes_financeiras")
        .insert({
          descricao: `Inscrição Jornada: ${jornada.titulo}`,
          valor: Number(jornada.valor || 0),
          tipo: "entrada",
          tipo_lancamento: "unico",
          status: "pendente",
          data_vencimento: data,
          data_competencia: data,
          conta_id: contaId,
          categoria_id: categoriaId,
          base_ministerial_id: baseMinisterialId,
          igreja_id: igrejaId,
          filial_id: isAllFiliais ? null : filialId,
        })
        .select("id")
        .single();
      if (txError) throw txError;

      const { error: inscError } = await supabase
        .from("inscricoes_jornada")
        .insert({
          jornada_id: jornada.id,
          pessoa_id: profile.id,
          responsavel_id: profile.id,
          status_pagamento: "pendente",
          transacao_id: transacaoCriada.id,
        });
      if (inscError) throw inscError;

      setPagamentoMensagem(`Inscrição realizada! Para liberar o acesso, realize o pagamento de R$ ${Number(jornada.valor || 0).toFixed(2)}.`);
      setPagamentoDialogOpen(true);
      await Promise.all([fetchInscricoes(), fetchDisponiveis()]);
    } catch (error) {
      const duplicate = (error as { code?: string } | null)?.code === "23505";
      if (duplicate) {
        toast.error("Você já está inscrito nesta jornada");
      } else {
        toast.error("Não foi possível realizar a inscrição");
      }
      console.error("Erro ao inscrever:", error);
    } finally {
      setEnrollingId(null);
    }
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="inscritos">Meus cursos</TabsTrigger>
          <TabsTrigger value="disponiveis">Disponíveis</TabsTrigger>
        </TabsList>

        <TabsContent value="inscritos" className="space-y-3">
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
            <div className="flex flex-col gap-3">
              {inscricoes.map((inscricao) => {
                const progresso = calcularProgresso(inscricao);
                const corTema = inscricao.jornada?.cor_tema || "hsl(var(--primary))";
                
                const bloqueado = inscricao.status_pagamento === "pendente";
                return (
                  <Card 
                    key={inscricao.id} 
                    className={`overflow-hidden hover:shadow-md transition-all ${bloqueado ? "opacity-90" : "cursor-pointer group"}`}
                    onClick={() => !bloqueado && navigate(`/cursos/${inscricao.jornada_id}`)}
                  >
                    <div className="flex items-stretch">
                      <div 
                        className="w-1.5 shrink-0" 
                        style={{ backgroundColor: corTema }}
                      />
                      
                      <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                              {inscricao.jornada?.titulo}
                            </h3>
                            {bloqueado && <Badge variant="secondary">Aguardando Pagamento</Badge>}
                          </div>
                          {inscricao.jornada?.descricao && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                              {inscricao.jornada.descricao}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 sm:gap-6">
                          <div className="flex-1 sm:w-40 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                {inscricao.etapasConcluidas}/{inscricao.totalEtapas} etapas
                              </span>
                              <span className="font-medium">{progresso}%</span>
                            </div>
                            <Progress value={progresso} className="h-1.5" />
                          </div>
                          
                          {!bloqueado && (
                            <Button 
                              size="sm" 
                              variant={progresso === 0 ? "default" : "outline"}
                              className="shrink-0 hidden sm:flex"
                              onClick={() => navigate(`/cursos/${inscricao.jornada_id}`)}
                            >
                              {progresso === 0 ? (
                                <>
                                  <Play className="h-4 w-4 mr-1.5" />
                                  Iniciar
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="h-4 w-4 mr-1.5" />
                                  Continuar
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="disponiveis" className="space-y-3">
          {loadingDisponiveis ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : jornadasDisponiveis.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nada disponível no momento</h3>
                <p className="text-muted-foreground text-sm">
                  Assim que novas jornadas forem liberadas, elas aparecerão aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jornadasDisponiveis.map((jornada) => (
                <Card key={jornada.id} className="h-full flex flex-col border hover:shadow-md transition-all">
                  <CardContent className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-2 h-10 rounded-full"
                        style={{ backgroundColor: jornada.cor_tema || "hsl(var(--primary))" }}
                      />
                      <div className="space-y-1">
                        <h3 className="font-semibold leading-tight">{jornada.titulo}</h3>
                        {jornada.descricao && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {jornada.descricao}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto flex justify-between items-center">
                      {jornada.requer_pagamento && (
                        <span className="text-sm font-medium">Valor: R$ {(jornada.valor || 0).toFixed(2)}</span>
                      )}
                      <Button 
                        size="sm"
                        onClick={() => handleInscrever(jornada)}
                        disabled={enrollingId === jornada.id}
                      >
                        {enrollingId === jornada.id ? "Inscrevendo..." : "Inscrever-se"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={pagamentoDialogOpen} onOpenChange={setPagamentoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inscrição realizada</DialogTitle>
            <DialogDescription>{pagamentoMensagem}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setPagamentoDialogOpen(false)}>Entendi</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
