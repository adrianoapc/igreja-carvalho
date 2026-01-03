import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import JornadaCard from "@/components/jornadas/JornadaCard";
import KanbanColumn from "@/components/jornadas/KanbanColumn";
import AdicionarPessoaDialog from "@/components/jornadas/AdicionarPessoaDialog";
import EditarJornadaDialog from "@/components/jornadas/EditarJornadaDialog";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function JornadaBoard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAdicionarPessoa, setShowAdicionarPessoa] = useState(false);
  const [showEditarJornada, setShowEditarJornada] = useState(false);
  const [filtro, setFiltro] = useState<string>("todos");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const { data: jornada, isLoading: loadingJornada } = useQuery({
    queryKey: ["jornada", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jornadas")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: etapas, isLoading: loadingEtapas } = useQuery({
    queryKey: ["etapas-jornada", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etapas_jornada")
        .select("*")
        .eq("jornada_id", id)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: inscricoes, refetch: refetchInscricoes } = useQuery({
    queryKey: ["inscricoes-jornada", id],
    queryFn: async () => {
      // Buscar inscrições
      const { data: inscricoesData, error: inscricoesError } = await supabase
        .from("inscricoes_jornada")
        .select(
          `
          *,
          pessoa:profiles!inscricoes_jornada_pessoa_id_fkey(id, nome, avatar_url, telefone),
          responsavel:profiles!inscricoes_jornada_responsavel_id_fkey(id, nome, avatar_url)
        `
        )
        .eq("jornada_id", id);

      if (inscricoesError) throw inscricoesError;
      if (!inscricoesData) return [];

      // Buscar etapas desta jornada para saber quais etapa_ids considerar
      const { data: etapasJornada } = await supabase
        .from("etapas_jornada")
        .select("id")
        .eq("jornada_id", id!);

      const etapaIds = etapasJornada?.map((e) => e.id) || [];

      // Para cada inscricao, buscar quais etapas foram concluídas (IDs)
      const inscricoesComProgresso = await Promise.all(
        inscricoesData.map(async (inscricao) => {
          if (etapaIds.length === 0) {
            return {
              ...inscricao,
              etapas_concluidas: 0,
              etapas_concluidas_ids: [],
            };
          }

          const { data: presencas, count } = await supabase
            .from("presencas_aula")
            .select("etapa_id", { count: "exact" })
            .eq("aluno_id", inscricao.pessoa_id)
            .in("etapa_id", etapaIds)
            .eq("status", "concluido");

          const etapasConcluidasIds =
            presencas?.map((p) => p.etapa_id).filter(Boolean) || [];

          return {
            ...inscricao,
            etapas_concluidas: count || 0,
            etapas_concluidas_ids: etapasConcluidasIds,
          };
        })
      );

      return inscricoesComProgresso;
    },
  });

  const updateInscricaoMutation = useMutation({
    mutationFn: async ({
      inscricaoId,
      etapaId,
    }: {
      inscricaoId: string;
      etapaId: string | null;
    }) => {
      const { error } = await supabase
        .from("inscricoes_jornada")
        .update({
          etapa_atual_id: etapaId,
          data_mudanca_fase: new Date().toISOString(),
        })
        .eq("id", inscricaoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inscricoes-jornada", id] });
    },
  });

  const inscricoesFiltradas = useMemo(() => {
    if (!inscricoes) return [];
    if (filtro === "minhas" && profile?.id) {
      return inscricoes.filter((i) => i.responsavel_id === profile.id);
    }
    return inscricoes;
  }, [inscricoes, filtro, profile?.id]);

  const inscricoesByEtapa = useMemo(() => {
    if (!inscricoesFiltradas || !etapas) return {};

    const grouped: Record<string, typeof inscricoesFiltradas> = {};

    etapas.forEach((etapa) => {
      grouped[etapa.id] = [];
    });

    grouped["sem_etapa"] = [];

    inscricoesFiltradas.forEach((inscricao) => {
      const etapaId = inscricao.etapa_atual_id || "sem_etapa";
      if (grouped[etapaId]) {
        grouped[etapaId].push(inscricao);
      } else {
        grouped["sem_etapa"].push(inscricao);
      }
    });

    return grouped;
  }, [inscricoesFiltradas, etapas]);

  const activeInscricao = useMemo(() => {
    if (!activeId || !inscricoes) return null;
    return inscricoes.find((i) => i.id === activeId);
  }, [activeId, inscricoes]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const inscricaoId = active.id as string;
    const overId = over.id as string;

    let targetEtapaId: string | null = null;

    if (overId.startsWith("column-")) {
      targetEtapaId = overId.replace("column-", "");
      if (targetEtapaId === "sem_etapa") targetEtapaId = null;
    } else {
      const targetInscricao = inscricoes?.find((i) => i.id === overId);
      targetEtapaId = targetInscricao?.etapa_atual_id || null;
    }

    const currentInscricao = inscricoes?.find((i) => i.id === inscricaoId);
    if (!currentInscricao) return;

    if (currentInscricao.etapa_atual_id !== targetEtapaId) {
      updateInscricaoMutation.mutate({
        inscricaoId,
        etapaId: targetEtapaId,
      });
      toast.success("Etapa atualizada");
    }
  };

  const totalEtapas = etapas?.length || 1;
  const totalInscritos = inscricoes?.length || 0;
  const totalConcluidos = inscricoes?.filter((i) => i.concluido)?.length || 0;
  const totalAtivos = totalInscritos - totalConcluidos;
  const taxaRetencao =
    totalInscritos > 0 ? (totalConcluidos / totalInscritos) * 100 : 0;

  if (loadingJornada || loadingEtapas) {
    return (
      <div className="flex flex-col h-[calc(100vh-theme(spacing.16)-theme(spacing.8))] w-full -m-4 md:-m-8 p-6">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 w-80 shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full max-w-full overflow-hidden relative -m-4 md:-m-8">
      {/* Header Fixo */}
      <div className="shrink-0 bg-background border-b z-10 relative px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/ensino/jornadas")}
              className="rounded-full shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: jornada?.cor_tema || "#3b82f6" }}
              />
              <div className="min-w-0">
                <h1 className="text-lg font-semibold truncate">
                  {jornada?.titulo}
                </h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>
                    {totalInscritos}{" "}
                    {totalInscritos === 1 ? "inscrito" : "inscritos"}
                  </span>
                  <span className="flex items-center gap-1 text-foreground font-semibold">
                    Taxa de Retenção: {taxaRetencao.toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1">
                    Total Ativos:{" "}
                    <span className="font-semibold text-foreground">
                      {totalAtivos}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Leaders section removed - lideres property not in jornadas table */}

            <ToggleGroup
              type="single"
              value={filtro}
              onValueChange={(v) => v && setFiltro(v)}
              size="sm"
              className="bg-muted rounded-lg p-0.5"
            >
              <ToggleGroupItem
                value="todos"
                className="text-xs px-3 rounded-md data-[state=on]:bg-background"
              >
                Todos
              </ToggleGroupItem>
              <ToggleGroupItem
                value="minhas"
                className="text-xs px-3 rounded-md data-[state=on]:bg-background"
              >
                Minhas
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEditarJornada(true)}
              className="hidden sm:flex"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEditarJornada(true)}
              className="sm:hidden"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button size="sm" onClick={() => setShowAdicionarPessoa(true)}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Adicionar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Área de Scroll do Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden w-full relative bg-muted/20">
        <div className="flex h-full min-w-max px-4 md:px-6 pb-6 pt-4 gap-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full">
              {inscricoesByEtapa["sem_etapa"]?.length > 0 && (
                <KanbanColumn
                  id="sem_etapa"
                  title="Aguardando"
                  items={inscricoesByEtapa["sem_etapa"]}
                  totalEtapas={totalEtapas}
                  onRefetch={refetchInscricoes}
                  etapasOrdenadas={etapas || []}
                />
              )}

              {etapas?.map((etapa) => (
                <KanbanColumn
                  key={etapa.id}
                  id={etapa.id}
                  title={etapa.titulo}
                  items={inscricoesByEtapa[etapa.id] || []}
                  totalEtapas={totalEtapas}
                  onRefetch={refetchInscricoes}
                  etapasOrdenadas={etapas || []}
                />
              ))}
            </div>

            <DragOverlay>
              {activeInscricao && (
                <JornadaCard
                  inscricao={activeInscricao}
                  totalEtapas={totalEtapas}
                  isDragging
                />
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      <AdicionarPessoaDialog
        open={showAdicionarPessoa}
        onOpenChange={setShowAdicionarPessoa}
        jornadaId={id!}
        primeiraEtapaId={etapas?.[0]?.id}
        onSuccess={() => {
          refetchInscricoes();
          setShowAdicionarPessoa(false);
        }}
      />

      {jornada && (
        <EditarJornadaDialog
          open={showEditarJornada}
          onOpenChange={setShowEditarJornada}
          jornada={jornada}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["jornada", id] });
            queryClient.invalidateQueries({ queryKey: ["etapas-jornada", id] });
            setShowEditarJornada(false);
          }}
        />
      )}
    </div>
  );
}
