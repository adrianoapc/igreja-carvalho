import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Clock, Calendar, MessageSquare, CheckCircle2 } from "lucide-react";

import { PastoralKanbanColumn } from "./PastoralKanbanColumn";
import { PastoralDetailsDrawer } from "./PastoralDetailsDrawer";
import { PastoralCard } from "./PastoralCard";

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
  { status: "EM_ACOMPANHAMENTO", label: "Acompanhando", icon: <MessageSquare className="h-4 w-4" /> },
  { status: "AGENDADO", label: "Agendado", icon: <Calendar className="h-4 w-4" /> },
  { status: "CONCLUIDO", label: "Concluído", icon: <CheckCircle2 className="h-4 w-4" /> },
];

interface PastoralKanbanViewProps {
  atendimentos: AtendimentoPastoral[];
  allAtendimentos: AtendimentoPastoral[];
}

export default function PastoralKanbanView({ atendimentos, allAtendimentos }: PastoralKanbanViewProps) {
  const queryClient = useQueryClient();
  const [selectedAtendimento, setSelectedAtendimento] = useState<AtendimentoPastoral | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

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

  const atendimentosPorStatus = useMemo(() => {
    const grouped: Record<StatusEnum, AtendimentoPastoral[]> = {
      PENDENTE: [],
      TRIAGEM: [],
      AGENDADO: [],
      EM_ACOMPANHAMENTO: [],
      CONCLUIDO: [],
    };

    atendimentos.forEach((a) => {
      const status = a.status || "PENDENTE";
      if (grouped[status]) {
        grouped[status].push(a);
      }
    });

    return grouped;
  }, [atendimentos]);

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

      const atendimento = allAtendimentos.find((a) => a.id === atendimentoId);
      if (!atendimento || atendimento.status === newStatus) return;

      updateStatusMutation.mutate({ id: atendimentoId, status: newStatus });
    },
    [allAtendimentos, updateStatusMutation]
  );

  const handleCardClick = useCallback((atendimento: AtendimentoPastoral) => {
    setSelectedAtendimento(atendimento);
    setDrawerOpen(true);
  }, []);

  const activeAtendimento = useMemo(() => {
    if (!activeId || !allAtendimentos) return null;
    return allAtendimentos.find((a) => a.id === activeId) || null;
  }, [activeId, allAtendimentos]);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
            <PastoralCard atendimento={activeAtendimento} onClick={() => {}} />
          )}
        </DragOverlay>
      </DndContext>

      <PastoralDetailsDrawer
        atendimento={selectedAtendimento}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
