import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar as CalendarIcon, MapPin, Video, Loader2, Clock, User, AlertCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format, parseISO, isSameDay, setHours, setMinutes, startOfDay, addMinutes, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AgendamentoDialogProps {
  atendimentoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  pastorPreSelecionadoId?: string | null;
}

interface TimeSlot {
  time: string;
  label: string;
  available: boolean;
  conflictInfo?: string;
}

// Gera slots de 30 em 30 minutos das 08:00 às 22:00
function generateTimeSlots(
  selectedDate: Date,
  occupiedSlots: { start: Date; end: Date; info: string }[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startHour = 8;
  const endHour = 22;
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const slotTime = setMinutes(setHours(selectedDate, hour), minute);
      const slotEnd = addMinutes(slotTime, 30);
      
      // Verifica se há conflito
      const conflict = occupiedSlots.find(occupied => {
        // Slot conflita se começa durante outro agendamento ou se outro agendamento começa durante o slot
        return (
          (isAfter(slotTime, occupied.start) || isSameTime(slotTime, occupied.start)) &&
          isBefore(slotTime, occupied.end)
        ) || (
          isAfter(occupied.start, slotTime) &&
          isBefore(occupied.start, slotEnd)
        );
      });
      
      const timeStr = format(slotTime, "HH:mm");
      
      slots.push({
        time: timeStr,
        label: timeStr,
        available: !conflict,
        conflictInfo: conflict?.info,
      });
    }
  }
  
  return slots;
}

function isSameTime(date1: Date, date2: Date): boolean {
  return date1.getTime() === date2.getTime();
}

export function AgendamentoDialog({
  atendimentoId,
  open,
  onOpenChange,
  onSuccess,
  pastorPreSelecionadoId,
}: AgendamentoDialogProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedPastorId, setSelectedPastorId] = useState<string | null>(pastorPreSelecionadoId || null);
  const [localAtendimento, setLocalAtendimento] = useState("");

  // Buscar lista de pastores/líderes disponíveis
  const { data: pastores = [] } = useQuery({
    queryKey: ["pastores-gabinete"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .or("e_pastor.eq.true,e_lider.eq.true")
        .order("nome");
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Buscar agendamentos existentes do pastor selecionado na data selecionada
  const { data: agendamentosExistentes = [], isLoading: loadingAgendamentos } = useQuery({
    queryKey: ["agendamentos-pastor", selectedPastorId, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedPastorId || !selectedDate) return [];
      
      const startOfSelectedDay = startOfDay(selectedDate);
      const endOfSelectedDay = new Date(startOfSelectedDay);
      endOfSelectedDay.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabase
        .from("atendimentos_pastorais")
        .select("id, data_agendamento, motivo_resumo, status")
        .eq("pastor_responsavel_id", selectedPastorId)
        .in("status", ["AGENDADO", "EM_ACOMPANHAMENTO"])
        .gte("data_agendamento", startOfSelectedDay.toISOString())
        .lte("data_agendamento", endOfSelectedDay.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!selectedPastorId && !!selectedDate,
  });

  // Converter agendamentos existentes em slots ocupados
  const occupiedSlots = useMemo(() => {
    return agendamentosExistentes.map(ag => {
      const start = parseISO(ag.data_agendamento);
      const end = addMinutes(start, 60); // Assume 1 hora por atendimento
      return {
        start,
        end,
        info: ag.motivo_resumo || "Ocupado",
      };
    });
  }, [agendamentosExistentes]);

  // Gerar time slots para o dia selecionado
  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    return generateTimeSlots(selectedDate, occupiedSlots);
  }, [selectedDate, occupiedSlots]);

  // Nome do pastor selecionado
  const pastorSelecionado = pastores.find(p => p.id === selectedPastorId);

  const agendarMutation = useMutation({
    mutationFn: async () => {
      if (!atendimentoId || !selectedDate || !selectedTime || !selectedPastorId) {
        throw new Error("Dados incompletos");
      }

      // Monta o datetime completo
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const dataAgendamento = new Date(selectedDate);
      dataAgendamento.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({
          data_agendamento: dataAgendamento.toISOString(),
          local_atendimento: localAtendimento || null,
          pastor_responsavel_id: selectedPastorId,
          status: "AGENDADO",
        })
        .eq("id", atendimentoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-pastor"] });
      toast.success("Agendamento confirmado!");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error("Erro ao salvar agendamento");
    },
  });

  const resetForm = () => {
    setSelectedDate(new Date());
    setSelectedTime(null);
    setLocalAtendimento("");
    if (!pastorPreSelecionadoId) {
      setSelectedPastorId(null);
    }
  };

  const handleSubmit = () => {
    if (!selectedPastorId) {
      toast.error("Selecione um pastor");
      return;
    }
    if (!selectedDate) {
      toast.error("Selecione uma data");
      return;
    }
    if (!selectedTime) {
      toast.error("Selecione um horário");
      return;
    }
    agendarMutation.mutate();
  };

  const canConfirm = selectedPastorId && selectedDate && selectedTime;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Agendar Atendimento
          </DialogTitle>
          <DialogDescription>
            Selecione o pastor, data e horário disponível
          </DialogDescription>
        </DialogHeader>

        {/* Seletor de Pastor */}
        <div className="py-3 border-b">
          <Label className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Pastor Responsável
          </Label>
          <Select 
            value={selectedPastorId || ""} 
            onValueChange={setSelectedPastorId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um pastor..." />
            </SelectTrigger>
            <SelectContent>
              {pastores.map((pastor) => (
                <SelectItem key={pastor.id} value={pastor.id}>
                  {pastor.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Corpo: Calendário + Horários */}
        <div className="flex-1 overflow-hidden">
          {!selectedPastorId ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center space-y-2">
                <AlertCircle className="h-8 w-8 mx-auto opacity-50" />
                <p>Selecione um pastor para ver a agenda</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {/* Coluna Esquerda: Calendário */}
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedTime(null); // Reset time when date changes
                  }}
                  locale={ptBR}
                  disabled={(date) => date < startOfDay(new Date())}
                  className="rounded-md border pointer-events-auto"
                />
              </div>

              {/* Coluna Direita: Horários */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Horários {selectedDate && `- ${format(selectedDate, "dd/MM", { locale: ptBR })}`}
                </Label>
                
                {loadingAgendamentos ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ScrollArea className="h-64 rounded-md border p-2">
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map((slot) => (
                        <Button
                          key={slot.time}
                          type="button"
                          size="sm"
                          variant={selectedTime === slot.time ? "default" : "outline"}
                          disabled={!slot.available}
                          onClick={() => setSelectedTime(slot.time)}
                          className={cn(
                            "text-xs",
                            !slot.available && "opacity-50 cursor-not-allowed bg-muted text-muted-foreground",
                            selectedTime === slot.time && "ring-2 ring-primary"
                          )}
                          title={!slot.available ? slot.conflictInfo : undefined}
                        >
                          {slot.label}
                          {!slot.available && (
                            <span className="sr-only">- Ocupado</span>
                          )}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                
                {/* Legenda */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded border bg-background" />
                    <span>Disponível</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-muted" />
                    <span>Ocupado</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Local (opcional) */}
        {selectedPastorId && (
          <div className="py-3 border-t space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Local ou Link (opcional)
            </Label>
            <Input
              placeholder="Ex: Sala 1 ou https://meet.google.com/..."
              value={localAtendimento}
              onChange={(e) => setLocalAtendimento(e.target.value)}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Video className="h-3 w-3" />
              Cole um link para atendimento online
            </p>
          </div>
        )}

        {/* Resumo e Confirmação */}
        <DialogFooter className="border-t pt-4 flex-col sm:flex-row gap-3">
          {canConfirm && (
            <div className="flex-1 text-sm text-muted-foreground">
              Agendando com <strong>{pastorSelecionado?.nome}</strong> para{" "}
              <strong>{format(selectedDate!, "dd/MM/yyyy", { locale: ptBR })}</strong> às{" "}
              <strong>{selectedTime}</strong>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!canConfirm || agendarMutation.isPending}
            >
              {agendarMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirmar Agendamento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
