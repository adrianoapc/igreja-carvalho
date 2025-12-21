import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import { Clock, Calendar, MessageSquare, CheckCircle2, List, LayoutGrid } from "lucide-react";

import { PastoralKPIs } from "@/components/gabinete/PastoralKPIs";
import { PastoralFilters } from "@/components/gabinete/PastoralFilters";
import { PastoralKanbanColumn } from "@/components/gabinete/PastoralKanbanColumn";
import { PastoralDetailsDrawer } from "@/components/gabinete/PastoralDetailsDrawer";
import { PastoralListView } from "@/components/gabinete/PastoralListView";
import { PastoralCard } from "@/components/gabinete/PastoralCard";
import { PastoralInboxTable } from "@/components/gabinete/PastoralInboxTable";
import { AgendamentoDialog } from "@/components/gabinete/AgendamentoDialog";

type GravidadeEnum = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
type StatusEnum = "PENDENTE" | "TRIAGEM" | "AGENDADO" | "EM_ACOMPANHAMENTO" | "CONCLUIDO";

interface AtendimentoPastoral {
  id: string;
  created_at: string;
  pessoa_id: string | null;
  visitante_id: string | null;
  origem: string | null;
  motivo_resumo: string | null;
  conteudo_original: string | null;
  gravidade: GravidadeEnum | null;
  status: StatusEnum | null;
  pastor_responsavel_id: string | null;
  data_agendamento: string | null;
  local_atendimento: string | null;
  observacoes_internas: string | null;
  historico_evolucao: any[] | null;
  pessoa?: { nome: string | null; telefone: string | null } | null;
  visitante?: { nome: string | null; telefone: string | null } | null;
  pastor?: { nome: string | null } | null;
}

const STATUS_COLUMNS: { status: StatusEnum; label: string; icon: React.ReactNode }[] = [
  { status: "PENDENTE", label: "Pendente", icon: <Clock className="h-4 w-4" /> },
  { status: "EM_ACOMPANHAMENTO", label: "Em Acompanhamento", icon: <MessageSquare className="h-4 w-4" /> },
  { status: "AGENDADO", label: "Agendado", icon: <Calendar className="h-4 w-4" /> },
  { status: "CONCLUIDO", label: "Concluído", icon: <CheckCircle2 className="h-4 w-4" /> },
];

export default function GabinetePastoral() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // States
  const [filtroMeus, setFiltroMeus] = useState(false);
  const [filtroGravidade, setFiltroGravidade] = useState<GravidadeEnum | "TODAS">("TODAS");
  const [busca, setBusca] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("TODAS");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list");
  const [selectedAtendimento, setSelectedAtendimento] = useState<AtendimentoPastoral | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [agendamentoDialogOpen, setAgendamentoDialogOpen] = useState(false);
  const [atendimentoParaAgendar, setAtendimentoParaAgendar] = useState<AtendimentoPastoral | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch atendimentos
  const { data: atendimentos, isLoading } = useQuery({
    queryKey: ["atendimentos-pastorais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos_pastorais")
        .select(`
          *,
          pessoa:profiles!atendimentos_pastorais_pessoa_id_fkey(nome, telefone),
          visitante:visitantes_leads!atendimentos_pastorais_visitante_id_fkey(nome, telefone),
          pastor:profiles!atendimentos_pastorais_pastor_responsavel_id_fkey(nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AtendimentoPastoral[];
    },
  });

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusEnum }) => {
      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      toast.success("Status atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  // Filtrar atendimentos
  const atendimentosFiltrados = useMemo(() => {
    if (!atendimentos) return [];

    return atendimentos.filter((a) => {
      // Filtro "Meus Atendimentos"
      if (filtroMeus && profile?.id && a.pastor_responsavel_id !== profile.id) {
        return false;
      }
      // Filtro Gravidade
      if (filtroGravidade !== "TODAS" && a.gravidade !== filtroGravidade) {
        return false;
      }
      // Filtro Origem
      if (filtroOrigem !== "TODAS" && a.origem !== filtroOrigem) {
        return false;
      }
      // Filtro Busca
      if (busca) {
        const searchLower = busca.toLowerCase();
        const nome = a.pessoa?.nome || a.visitante?.nome || "";
        const motivo = a.motivo_resumo || "";
        if (
          !nome.toLowerCase().includes(searchLower) &&
          !motivo.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [atendimentos, filtroMeus, filtroGravidade, filtroOrigem, busca, profile?.id]);

  // Agrupar por status
  const atendimentosPorStatus = useMemo(() => {
    const grouped: Record<StatusEnum, AtendimentoPastoral[]> = {
      PENDENTE: [],
      TRIAGEM: [],
      AGENDADO: [],
      EM_ACOMPANHAMENTO: [],
      CONCLUIDO: [],
    };

    atendimentosFiltrados.forEach((a) => {
      const status = a.status || "PENDENTE";
      if (grouped[status]) {
        grouped[status].push(a);
      }
    });

    return grouped;
  }, [atendimentosFiltrados]);

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const atendimentoId = active.id as string;
      const newStatus = over.id as StatusEnum;

      const atendimento = atendimentos?.find((a) => a.id === atendimentoId);
      if (!atendimento || atendimento.status === newStatus) return;

      updateStatusMutation.mutate({ id: atendimentoId, status: newStatus });
    },
    [atendimentos, updateStatusMutation]
  );

  const handleCardClick = useCallback((atendimento: AtendimentoPastoral) => {
    setSelectedAtendimento(atendimento);
    setDrawerOpen(true);
  }, []);

  const handleAgendar = useCallback((atendimento: AtendimentoPastoral) => {
    setAtendimentoParaAgendar(atendimento);
    setAgendamentoDialogOpen(true);
  }, []);

  const activeAtendimento = useMemo(() => {
    if (!activeId || !atendimentos) return null;
    return atendimentos.find((a) => a.id === activeId) || null;
  }, [activeId, atendimentos]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Pastoral</h1>
        <p className="text-muted-foreground">Gestão de atendimentos pastorais</p>
      </div>

      {/* KPIs */}
      <PastoralKPIs atendimentos={atendimentos || []} />

      {/* Filtros */}
      <PastoralFilters
        filtroMeus={filtroMeus}
        setFiltroMeus={setFiltroMeus}
        filtroGravidade={filtroGravidade}
        setFiltroGravidade={setFiltroGravidade}
        busca={busca}
        setBusca={setBusca}
        filtroOrigem={filtroOrigem}
        setFiltroOrigem={setFiltroOrigem}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Tabs: Lista Inbox e Quadro Kanban */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "kanban" | "list")}>
        <TabsList className="grid w-full max-w-[300px] grid-cols-2">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="kanban" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Quadro
          </TabsTrigger>
        </TabsList>

        {/* Tab Inbox - Table View */}
        <TabsContent value="list" className="mt-4">
          <PastoralInboxTable
            atendimentos={atendimentosFiltrados}
            onAgendar={handleAgendar}
          />
        </TabsContent>

        {/* Tab Kanban - Board View */}
        <TabsContent value="kanban" className="mt-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
              {STATUS_COLUMNS.map(({ status, label, icon }) => (
                <PastoralKanbanColumn
                  key={status}
                  status={status}
                  label={label}
                  icon={icon}
                  atendimentos={atendimentosPorStatus[status] || []}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>

            <DragOverlay>
              {activeAtendimento && (
                <PastoralCard
                  atendimento={activeAtendimento}
                  onClick={() => {}}
                />
              )}
            </DragOverlay>
          </DndContext>
        </TabsContent>
      </Tabs>

      {/* Drawer de detalhes (para Kanban view) */}
      <PastoralDetailsDrawer
        atendimento={selectedAtendimento}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      {/* Dialog de Agendamento */}
      <AgendamentoDialog
        atendimentoId={atendimentoParaAgendar?.id || null}
        open={agendamentoDialogOpen}
        onOpenChange={setAgendamentoDialogOpen}
      />
    </div>
  );
}
