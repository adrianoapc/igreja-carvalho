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
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowLeft, Plus, Settings, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import JornadaCard from "@/components/jornadas/JornadaCard";
import KanbanColumn from "@/components/jornadas/KanbanColumn";
import AdicionarPessoaDialog from "@/components/jornadas/AdicionarPessoaDialog";
import EditarJornadaDialog from "@/components/jornadas/EditarJornadaDialog";

export default function JornadaBoard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAdicionarPessoa, setShowAdicionarPessoa] = useState(false);
  const [showEditarJornada, setShowEditarJornada] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Fetch jornada details
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

  // Fetch etapas
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

  // Fetch inscricoes with pessoa and responsavel
  const { data: inscricoes, isLoading: loadingInscricoes, refetch: refetchInscricoes } = useQuery({
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

  // Mutation to update inscription
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

  // Group inscricoes by etapa
  const inscricoesByEtapa = useMemo(() => {
    if (!inscricoes || !etapas) return {};

    const grouped: Record<string, typeof inscricoes> = {};
    
    // Initialize all etapas
    etapas.forEach((etapa) => {
      grouped[etapa.id] = [];
    });
    
    // Add "sem_etapa" for inscricoes without etapa
    grouped["sem_etapa"] = [];

    inscricoes.forEach((inscricao) => {
      const etapaId = inscricao.etapa_atual_id || "sem_etapa";
      if (grouped[etapaId]) {
        grouped[etapaId].push(inscricao);
      } else {
        grouped["sem_etapa"].push(inscricao);
      }
    });

    return grouped;
  }, [inscricoes, etapas]);

  // Find active inscricao for drag overlay
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

    // Determine target etapa
    let targetEtapaId: string | null = null;

    if (overId.startsWith("column-")) {
      // Dropped on column
      targetEtapaId = overId.replace("column-", "");
      if (targetEtapaId === "sem_etapa") targetEtapaId = null;
    } else {
      // Dropped on another card - find its etapa
      const targetInscricao = inscricoes?.find((i) => i.id === overId);
      targetEtapaId = targetInscricao?.etapa_atual_id || null;
    }

    // Find current etapa
    const currentInscricao = inscricoes?.find((i) => i.id === inscricaoId);
    if (!currentInscricao) return;

    // Only update if etapa changed
    if (currentInscricao.etapa_atual_id !== targetEtapaId) {
      updateInscricaoMutation.mutate({
        inscricaoId,
        etapaId: targetEtapaId,
      });
      toast.success("Etapa atualizada!");
    }
  };

  const totalEtapas = etapas?.length || 1;

  if (loadingJornada || loadingEtapas) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 w-72 flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/jornadas")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: jornada?.cor_tema || "#3b82f6" }}
                />
                <div>
                  <h1 className="text-xl font-bold">{jornada?.titulo}</h1>
                  {jornada?.descricao && (
                    <p className="text-sm text-muted-foreground">
                      {jornada.descricao}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Users className="w-3 h-3" />
                {inscricoes?.length || 0} inscritos
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditarJornada(true)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button size="sm" onClick={() => setShowAdicionarPessoa(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Pessoa
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <ScrollArea className="w-full">
        <div className="p-4 min-w-max">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4">
              {/* Coluna "Sem Etapa" se houver inscricoes sem etapa */}
              {inscricoesByEtapa["sem_etapa"]?.length > 0 && (
                <KanbanColumn
                  id="sem_etapa"
                  title="Aguardando"
                  color="#6b7280"
                  items={inscricoesByEtapa["sem_etapa"]}
                  totalEtapas={totalEtapas}
                  etapaIndex={0}
                  onRefetch={refetchInscricoes}
                />
              )}

              {/* Colunas das etapas */}
              {etapas?.map((etapa, index) => (
                <KanbanColumn
                  key={etapa.id}
                  id={etapa.id}
                  title={etapa.titulo}
                  color={jornada?.cor_tema || "#3b82f6"}
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
