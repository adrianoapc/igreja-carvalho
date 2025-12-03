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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import JornadaCard from "@/components/jornadas/JornadaCard";
import KanbanColumn from "@/components/jornadas/KanbanColumn";
import AdicionarPessoaDialog from "@/components/jornadas/AdicionarPessoaDialog";
import EditarJornadaDialog from "@/components/jornadas/EditarJornadaDialog";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/MainLayout";

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
      const { data, error } = await supabase
        .from("inscricoes_jornada")
        .select(`
          *,
          pessoa:profiles!inscricoes_jornada_pessoa_id_fkey(id, nome, avatar_url, telefone),
          responsavel:profiles!inscricoes_jornada_responsavel_id_fkey(id, nome, avatar_url)
        `)
        .eq("jornada_id", id);

      if (error) throw error;
      return data;
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

  if (loadingJornada || loadingEtapas) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-4 overflow-x-auto">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-96 w-80 flex-shrink-0" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/jornadas")}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: jornada?.cor_tema || "#3b82f6" }}
              />
              <div>
                <h1 className="text-lg font-semibold">{jornada?.titulo}</h1>
                <p className="text-xs text-muted-foreground">
                  {totalInscritos} {totalInscritos === 1 ? "inscrito" : "inscritos"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <ToggleGroup
              type="single"
              value={filtro}
              onValueChange={(v) => v && setFiltro(v)}
              size="sm"
              className="bg-muted rounded-lg p-0.5"
            >
              <ToggleGroupItem value="todos" className="text-xs px-3 rounded-md data-[state=on]:bg-background">
                Todos
              </ToggleGroupItem>
              <ToggleGroupItem value="minhas" className="text-xs px-3 rounded-md data-[state=on]:bg-background">
                Minhas
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEditarJornada(true)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
            <Button size="sm" onClick={() => setShowAdicionarPessoa(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Pessoa
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="bg-muted/30 rounded-lg -mx-4 md:-mx-8 px-4 md:px-8 py-6">
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex gap-4">
                  {inscricoesByEtapa["sem_etapa"]?.length > 0 && (
                    <KanbanColumn
                      id="sem_etapa"
                      title="Aguardando"
                      items={inscricoesByEtapa["sem_etapa"]}
                      totalEtapas={totalEtapas}
                      etapaIndex={0}
                      onRefetch={refetchInscricoes}
                    />
                  )}

                  {etapas?.map((etapa, index) => (
                    <KanbanColumn
                      key={etapa.id}
                      id={etapa.id}
                      title={etapa.titulo}
                      items={inscricoesByEtapa[etapa.id] || []}
                      totalEtapas={totalEtapas}
                      etapaIndex={index + 1}
                      onRefetch={refetchInscricoes}
                    />
                  ))}
                </div>

                <DragOverlay>
                  {activeInscricao && (
                    <JornadaCard
                      inscricao={activeInscricao}
                      totalEtapas={totalEtapas}
                      etapaIndex={
                        etapas?.findIndex(
                          (e) => e.id === activeInscricao.etapa_atual_id
                        ) ?? 0
                      }
                      isDragging
                    />
                  )}
                </DragOverlay>
              </DndContext>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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
    </MainLayout>
  );
}
