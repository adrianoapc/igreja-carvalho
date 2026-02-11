import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar, Clock } from "lucide-react";

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
  tipo: string;
}

interface EventoSelectProps {
  igrejaId: string;
  filialId: string | null;
  isAllFiliais: boolean;
  value: string | null;
  onValueChange: (value: string | null) => void;
  onEventoSelect?: (evento: Evento | null) => void;
}

export function EventoSelect({
  igrejaId,
  filialId,
  isAllFiliais,
  value,
  onValueChange,
  onEventoSelect,
}: EventoSelectProps) {
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["eventos-recentes-filtrados", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];

      // Buscar eventos dos últimos 30 dias até 90 dias no futuro
      const dataInicio = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const dataFim = format(
        new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000),
        "yyyy-MM-dd",
      );
      console.log("[EventoSelect] filtros", {
        igrejaId,
        filialId,
        isAllFiliais,
        dataInicio,
        dataFim,
      });

      // Buscar eventos já lançados (sessões finalizadas)
      const { data: sessoesFinalizadas, error: erroSessoes } = await supabase
        .from("sessoes_contagem")
        .select("evento_id")
        .eq("igreja_id", igrejaId)
        .eq("status", "finalizado");
      if (erroSessoes) throw erroSessoes;
      const eventosLancados = new Set(
        (sessoesFinalizadas || []).map((s: any) => s.evento_id).filter(Boolean),
      );

      let query = supabase
        .from("eventos")
        .select("id, titulo, data_evento, tipo, tem_oferta")
        .eq("igreja_id", igrejaId)
        .gte("data_evento", dataInicio)
        .lte("data_evento", dataFim)
        .in("status", ["confirmado", "realizado"])
        .in("tipo", ["CULTO", "EVENTO"])
        .eq("tem_oferta", true)
        .order("data_evento", { ascending: true })
        .limit(50);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query;
      console.log("[EventoSelect] query result", { data, error });
      if (error) throw error;

      // Filtrar eventos já lançados
      const agora = new Date();
      // Só mostrar eventos até 2 dias após a data_evento
      const eventosFiltrados = (data || []).filter((ev: any) => {
        if (!ev.data_evento) return false;
        const dataEv = new Date(ev.data_evento);
        const diffDias =
          (agora.getTime() - dataEv.getTime()) / (1000 * 60 * 60 * 24);
        // Permite selecionar até 2 dias após o evento
        if (diffDias > 2) return false;
        if (eventosLancados.has(ev.id)) return false;
        return true;
      });
      console.log("[EventoSelect] filtrados", {
        total: data?.length || 0,
        filtrados: eventosFiltrados.length,
      });
      return eventosFiltrados as Evento[];
    },
    enabled: !!igrejaId,
  });

  const handleValueChange = (newValue: string) => {
    if (newValue === "manual") {
      onValueChange(null);
      onEventoSelect?.(null);
    } else {
      onValueChange(newValue);
      const evento = eventos.find((e) => e.id === newValue);
      onEventoSelect?.(evento || null);
    }
  };

  const formatEventoDisplay = (evento: Evento) => {
    const data = format(new Date(evento.data_evento), "dd/MMM", {
      locale: ptBR,
    });
    const hora = format(new Date(evento.data_evento), "HH:mm");
    return `${data} às ${hora} - ${evento.titulo}`;
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="evento-select" className="flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        Selecionar Culto/Evento
      </Label>
      <Select
        value={value || "manual"}
        onValueChange={handleValueChange}
        disabled={isLoading}
      >
        <SelectTrigger id="evento-select">
          <SelectValue placeholder="Selecione um evento ou digite manualmente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="manual">
            📝 Entrada Manual (sem vínculo)
          </SelectItem>
          {eventos.map((evento) => (
            <SelectItem key={evento.id} value={evento.id}>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {formatEventoDisplay(evento)}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isLoading && (
        <p className="text-xs text-muted-foreground">Carregando eventos...</p>
      )}
      {!isLoading && eventos.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum evento encontrado (últimos 30 dias até próximos 90 dias)
        </p>
      )}
    </div>
  );
}
