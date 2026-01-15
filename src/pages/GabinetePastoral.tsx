import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { List, LayoutGrid, CalendarDays, Plus } from "lucide-react";
import { useFilialId } from "@/hooks/useFilialId";

import { Button } from "@/components/ui/button";
import { PastoralKPIs } from "@/components/gabinete/PastoralKPIs";
import { PastoralFilters } from "@/components/gabinete/PastoralFilters";
import { PastoralInboxTable } from "@/components/gabinete/PastoralInboxTable";
import { AgendamentoDialog } from "@/components/gabinete/AgendamentoDialog";
import { PastoralCalendarView } from "@/components/gabinete/PastoralCalendarView";

// Lazy load Kanban (heavy with DnD)
const PastoralKanbanView = lazy(
  () => import("@/components/gabinete/PastoralKanbanView")
);

type GravidadeEnum = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
type StatusEnum =
  | "PENDENTE"
  | "TRIAGEM"
  | "AGENDADO"
  | "EM_ACOMPANHAMENTO"
  | "CONCLUIDO";

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
  historico_evolucao: Array<{
    data: string;
    autor: string;
    acao: string;
    detalhes?: string;
  }> | null;
  pessoa?: { nome: string | null; telefone: string | null } | null;
  visitante?: { nome: string | null; telefone: string | null } | null;
  pastor?: { nome: string | null } | null;
}

export default function GabinetePastoral() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: filialLoading,
  } = useFilialId();

  // States
  const [filtroMeus, setFiltroMeus] = useState(false);
  const [filtroGravidade, setFiltroGravidade] = useState<
    GravidadeEnum | "TODAS"
  >("TODAS");
  const [busca, setBusca] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("TODAS");
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "agenda">(
    "list"
  );
  const [agendamentoDialogOpen, setAgendamentoDialogOpen] = useState(false);
  const [atendimentoParaAgendar, setAtendimentoParaAgendar] =
    useState<AtendimentoPastoral | null>(null);

  // Fetch atendimentos
  const { data: atendimentos, isLoading } = useQuery({
    queryKey: ["atendimentos-pastorais", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      let query = supabase
        .from("atendimentos_pastorais")
        .select(
          `
          *,
          pessoa:profiles!atendimentos_pastorais_pessoa_id_fkey(nome, telefone),
          visitante:visitantes_leads!atendimentos_pastorais_visitante_id_fkey(nome, telefone),
          pastor:profiles!atendimentos_pastorais_pastor_responsavel_id_fkey(nome)
        `
        )
        .order("created_at", { ascending: false });

      if (igrejaId) query = query.eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);

      const { data, error } = await query;

      if (error) throw error;

      const normalized = (data || []).map((row: Record<string, unknown>) => ({
        ...row,
        historico_evolucao: Array.isArray(row.historico_evolucao)
          ? row.historico_evolucao
          : null,
      }));

      return normalized as AtendimentoPastoral[];
    },
    enabled: !filialLoading && !!igrejaId,
    staleTime: 30000, // 30s cache
  });

  // Filtrar atendimentos
  const atendimentosFiltrados = useMemo(() => {
    if (!atendimentos) return [];

    return atendimentos.filter((a) => {
      if (filtroMeus && profile?.id && a.pastor_responsavel_id !== profile.id) {
        return false;
      }
      if (filtroGravidade !== "TODAS" && a.gravidade !== filtroGravidade) {
        return false;
      }
      if (filtroOrigem !== "TODAS" && a.origem !== filtroOrigem) {
        return false;
      }
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
  }, [
    atendimentos,
    filtroMeus,
    filtroGravidade,
    filtroOrigem,
    busca,
    profile?.id,
  ]);

  const handleAgendar = useCallback((atendimento: AtendimentoPastoral) => {
    setAtendimentoParaAgendar(atendimento);
    setAgendamentoDialogOpen(true);
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header Compacto */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Painel Pastoral</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de atendimentos
          </p>
        </div>
        <Button
          onClick={() => handleAgendar(null as any)}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Agenda
        </Button>
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
      />

      {/* Tabs */}
      <Tabs
        value={viewMode}
        onValueChange={(v) => setViewMode(v as "list" | "kanban" | "agenda")}
      >
        <TabsList className="grid w-full max-w-[300px] grid-cols-3 h-9">
          <TabsTrigger value="list" className="text-xs gap-1.5">
            <List className="h-3.5 w-3.5" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="kanban" className="text-xs gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            Quadro
          </TabsTrigger>
          <TabsTrigger value="agenda" className="text-xs gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-3">
          <PastoralInboxTable
            atendimentos={atendimentosFiltrados}
            onAgendar={handleAgendar}
          />
        </TabsContent>

        <TabsContent value="kanban" className="mt-3">
          <Suspense
            fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            }
          >
            <PastoralKanbanView
              atendimentos={atendimentosFiltrados}
              allAtendimentos={atendimentos || []}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="agenda" className="mt-3">
          <PastoralCalendarView />
        </TabsContent>
      </Tabs>

      {/* Dialog de Agendamento */}
      <AgendamentoDialog
        atendimentoId={atendimentoParaAgendar?.id || null}
        open={agendamentoDialogOpen}
        onOpenChange={setAgendamentoDialogOpen}
      />
    </div>
  );
}
