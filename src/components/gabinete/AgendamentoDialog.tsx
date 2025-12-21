import { useState, useMemo, useEffect } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar as CalendarIcon, MapPin, Video, Loader2, Clock, User, AlertCircle, CalendarX, X } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, setHours, setMinutes, startOfDay, addMinutes, isAfter, isBefore, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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

interface DisponibilidadeDia {
  ativo: boolean;
  inicio?: string;
  fim?: string;
}

interface DisponibilidadeAgenda {
  [key: string]: DisponibilidadeDia | boolean | undefined;
  padrao?: boolean;
}

const DIAS_SEMANA_NOMES = [
  "Domingos",
  "Segundas-feiras",
  "Terças-feiras",
  "Quartas-feiras",
  "Quintas-feiras",
  "Sextas-feiras",
  "Sábados",
];

// Gera slots de 30 em 30 minutos dentro do intervalo configurado
function generateTimeSlotsFromConfig(
  selectedDate: Date,
  startTime: string,
  endTime: string,
  occupiedSlots: { start: Date; end: Date; info: string }[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;
  
  for (let totalMinutes = startTotalMinutes; totalMinutes < endTotalMinutes; totalMinutes += 30) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    
    const slotTime = setMinutes(setHours(selectedDate, hour), minute);
    const slotEnd = addMinutes(slotTime, 30);
    
    const conflict = occupiedSlots.find(occupied => {
      return (
        (isAfter(slotTime, occupied.start) || slotTime.getTime() === occupied.start.getTime()) &&
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
  
  return slots;
}

function hasValidDisponibilidade(disponibilidade: DisponibilidadeAgenda | null | undefined): boolean {
  if (!disponibilidade) return false;
  
  if (disponibilidade.padrao === true && Object.keys(disponibilidade).length === 1) {
    return false;
  }
  
  for (const key of Object.keys(disponibilidade)) {
    if (key !== "padrao") {
      const dia = disponibilidade[key];
      if (typeof dia === "object" && dia?.ativo) {
        return true;
      }
    }
  }
  
  return false;
}

function getDayConfig(disponibilidade: DisponibilidadeAgenda | null | undefined, date: Date): DisponibilidadeDia | null {
  if (!disponibilidade) return null;
  
  const dayOfWeek = getDay(date);
  const dayKey = dayOfWeek.toString();
  
  const config = disponibilidade[dayKey];
  if (typeof config === "object" && config !== null) {
    return config;
  }
  
  return null;
}

export function AgendamentoDialog({
  atendimentoId,
  open,
  onOpenChange,
  onSuccess,
  pastorPreSelecionadoId,
}: AgendamentoDialogProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]); // Agora é array para múltiplos slots
  const [selectedPastorId, setSelectedPastorId] = useState<string | null>(pastorPreSelecionadoId || null);
  const [localAtendimento, setLocalAtendimento] = useState("");
  const [mobileTab, setMobileTab] = useState<string>("data");

  useEffect(() => {
    if (open && pastorPreSelecionadoId) {
      setSelectedPastorId(pastorPreSelecionadoId);
    }
  }, [open, pastorPreSelecionadoId]);

  const { data: pastores = [] } = useQuery({
    queryKey: ["pastores-gabinete-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, disponibilidade_agenda")
        .or("e_pastor.eq.true,e_lider.eq.true")
        .order("nome");
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const pastorSelecionado = useMemo(() => {
    return pastores.find(p => p.id === selectedPastorId);
  }, [pastores, selectedPastorId]);

  const disponibilidadePastor = useMemo(() => {
    if (!pastorSelecionado?.disponibilidade_agenda) return null;
    return pastorSelecionado.disponibilidade_agenda as unknown as DisponibilidadeAgenda;
  }, [pastorSelecionado]);

  const pastorTemConfiguracao = useMemo(() => {
    return hasValidDisponibilidade(disponibilidadePastor);
  }, [disponibilidadePastor]);

  const configDiaSelecionado = useMemo(() => {
    if (!selectedDate || !disponibilidadePastor) return null;
    return getDayConfig(disponibilidadePastor, selectedDate);
  }, [selectedDate, disponibilidadePastor]);

  const pastorAtendeNoDia = useMemo(() => {
    return configDiaSelecionado?.ativo === true;
  }, [configDiaSelecionado]);

  const nomeDiaSelecionado = useMemo(() => {
    if (!selectedDate) return "";
    return DIAS_SEMANA_NOMES[getDay(selectedDate)];
  }, [selectedDate]);

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
    enabled: open && !!selectedPastorId && !!selectedDate && pastorTemConfiguracao && pastorAtendeNoDia,
  });

  const occupiedSlots = useMemo(() => {
    return agendamentosExistentes.map(ag => {
      const start = parseISO(ag.data_agendamento);
      const end = addMinutes(start, 60);
      return {
        start,
        end,
        info: ag.motivo_resumo || "Ocupado",
      };
    });
  }, [agendamentosExistentes]);

  const timeSlots = useMemo(() => {
    if (!selectedDate || !pastorAtendeNoDia || !configDiaSelecionado) return [];
    
    const { inicio, fim } = configDiaSelecionado;
    if (!inicio || !fim) return [];
    
    return generateTimeSlotsFromConfig(selectedDate, inicio, fim, occupiedSlots);
  }, [selectedDate, pastorAtendeNoDia, configDiaSelecionado, occupiedSlots]);

  const agendarMutation = useMutation({
    mutationFn: async () => {
      if (!atendimentoId || !selectedDate || selectedTimes.length === 0 || !selectedPastorId) {
        throw new Error("Dados incompletos");
      }

      // Usa o primeiro horário selecionado como início
      const firstTime = selectedTimes.sort()[0];
      const [hours, minutes] = firstTime.split(":").map(Number);
      const dataAgendamento = new Date(selectedDate);
      dataAgendamento.setHours(hours, minutes, 0, 0);

      // Calcula duração baseada nos slots selecionados (cada slot = 30min)
      const duracaoMinutos = selectedTimes.length * 30;

      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({
          data_agendamento: dataAgendamento.toISOString(),
          local_atendimento: localAtendimento || null,
          pastor_responsavel_id: selectedPastorId,
          status: "AGENDADO",
          // Podemos armazenar a duração em observações ou outro campo se necessário
          observacoes_internas: selectedTimes.length > 1 
            ? `Duração: ${duracaoMinutos} minutos (${selectedTimes.sort().join(", ")})`
            : null,
        })
        .eq("id", atendimentoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-pastor"] });
      queryClient.invalidateQueries({ queryKey: ["atendimento-pastoral"] });
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
    setSelectedTimes([]);
    setLocalAtendimento("");
    setMobileTab("data");
    if (!pastorPreSelecionadoId) {
      setSelectedPastorId(null);
    }
  };

  const handleToggleTime = (time: string) => {
    setSelectedTimes(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      }
      return [...prev, time].sort();
    });
  };

  const handleRemoveTime = (time: string) => {
    setSelectedTimes(prev => prev.filter(t => t !== time));
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
    if (selectedTimes.length === 0) {
      toast.error("Selecione pelo menos um horário");
      return;
    }
    agendarMutation.mutate();
  };

  const canConfirm = selectedPastorId && selectedDate && selectedTimes.length > 0 && pastorTemConfiguracao && pastorAtendeNoDia;

  // Calcula intervalo de horários selecionados para exibição
  const horariosResumo = useMemo(() => {
    if (selectedTimes.length === 0) return "";
    const sorted = [...selectedTimes].sort();
    if (sorted.length === 1) return sorted[0];
    return `${sorted[0]} - ${sorted[sorted.length - 1]}`;
  }, [selectedTimes]);

  const renderTimeSlots = () => {
    if (!selectedPastorId) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
          <div className="text-center space-y-2">
            <User className="h-8 w-8 mx-auto opacity-50" />
            <p className="text-sm">Selecione um pastor</p>
          </div>
        </div>
      );
    }

    if (!pastorTemConfiguracao) {
      return (
        <Alert variant="destructive" className="m-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Agenda não configurada</AlertTitle>
          <AlertDescription>
            Este pastor não possui horários de atendimento configurados.
          </AlertDescription>
        </Alert>
      );
    }

    if (!pastorAtendeNoDia) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
          <div className="text-center space-y-2">
            <CalendarX className="h-8 w-8 mx-auto opacity-50" />
            <p className="text-sm font-medium">Não atende às {nomeDiaSelecionado}</p>
            <p className="text-xs">Selecione outro dia no calendário</p>
          </div>
        </div>
      );
    }

    if (loadingAgendamentos) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (timeSlots.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
          <div className="text-center space-y-2">
            <Clock className="h-8 w-8 mx-auto opacity-50" />
            <p className="text-sm">Nenhum horário configurado para este dia</p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-2 space-y-3">
        {/* Slots selecionados */}
        {selectedTimes.length > 0 && (
          <div className="flex flex-wrap gap-1 pb-2 border-b">
            {selectedTimes.sort().map((time) => (
              <Badge key={time} variant="default" className="gap-1">
                {time}
                <button 
                  onClick={() => handleRemoveTime(time)}
                  className="ml-1 hover:bg-primary-foreground/20 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        
        <ScrollArea className="h-48">
          <div className="grid grid-cols-3 gap-2">
            {timeSlots.map((slot) => {
              const isSelected = selectedTimes.includes(slot.time);
              return (
                <Button
                  key={slot.time}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  disabled={!slot.available}
                  onClick={() => handleToggleTime(slot.time)}
                  className={cn(
                    "text-xs",
                    !slot.available && "opacity-50 cursor-not-allowed bg-muted text-muted-foreground",
                    isSelected && "ring-2 ring-primary"
                  )}
                  title={!slot.available ? slot.conflictInfo : "Clique para selecionar/desselecionar"}
                >
                  {slot.label}
                </Button>
              );
            })}
          </div>
        </ScrollArea>

        <p className="text-xs text-muted-foreground text-center">
          Clique para selecionar múltiplos horários consecutivos
        </p>
      </div>
    );
  };

  // Layout Desktop
  const renderDesktopLayout = () => (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Coluna Esquerda: Calendário */}
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            setSelectedDate(date);
            setSelectedTimes([]);
          }}
          locale={ptBR}
          disabled={(date) => date < startOfDay(new Date())}
          className="rounded-md border pointer-events-auto"
        />
      </div>

      {/* Coluna Direita: Horários */}
      <div className="flex flex-col">
        <Label className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Horários {selectedDate && `- ${format(selectedDate, "EEE, dd/MM", { locale: ptBR })}`}
        </Label>
        
        <div className="flex-1 rounded-md border bg-muted/20 min-h-[280px]">
          {renderTimeSlots()}
        </div>

        {selectedPastorId && pastorTemConfiguracao && pastorAtendeNoDia && timeSlots.length > 0 && (
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
        )}
      </div>
    </div>
  );

  // Layout Mobile com Tabs
  const renderMobileLayout = () => (
    <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex flex-col h-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="data" className="gap-1">
          <CalendarIcon className="h-4 w-4" />
          Data
        </TabsTrigger>
        <TabsTrigger value="horario" className="gap-1">
          <Clock className="h-4 w-4" />
          Horário
          {selectedTimes.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
              {selectedTimes.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="data" className="flex-1 mt-4">
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              setSelectedTimes([]);
              // Navega para aba de horários automaticamente
              if (date && pastorTemConfiguracao) {
                setTimeout(() => setMobileTab("horario"), 300);
              }
            }}
            locale={ptBR}
            disabled={(date) => date < startOfDay(new Date())}
            className="rounded-md border pointer-events-auto"
          />
        </div>
        {selectedDate && (
          <p className="text-center text-sm text-muted-foreground mt-3">
            {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        )}
      </TabsContent>

      <TabsContent value="horario" className="flex-1 mt-4">
        <Label className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Horários {selectedDate && `- ${format(selectedDate, "dd/MM", { locale: ptBR })}`}
        </Label>
        
        <div className="rounded-md border bg-muted/20 min-h-[250px]">
          {renderTimeSlots()}
        </div>

        {selectedPastorId && pastorTemConfiguracao && pastorAtendeNoDia && timeSlots.length > 0 && (
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded border bg-background" />
              <span>Disponível</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-muted" />
              <span>Ocupado</span>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Agendar Atendimento
          </DialogTitle>
          <DialogDescription>
            Selecione o pastor, data e horário(s) disponível(is)
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="pr-4">
            {/* Seletor de Pastor */}
            <div className="py-3 border-b">
              <Label className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Pastor Responsável
              </Label>
              <Select 
                value={selectedPastorId || ""} 
                onValueChange={(value) => {
                  setSelectedPastorId(value);
                  setSelectedTimes([]);
                }}
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

            {/* Corpo: Layout responsivo */}
            <div className="py-4">
              {isMobile ? renderMobileLayout() : renderDesktopLayout()}
            </div>

            {/* Local (opcional) */}
            {selectedPastorId && pastorTemConfiguracao && (
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
          </div>
        </ScrollArea>

        {/* Resumo e Confirmação */}
        <DialogFooter className="border-t pt-4 flex-col gap-3 shrink-0">
          {canConfirm && (
            <div className="w-full text-sm text-muted-foreground">
              Agendando com <strong>{pastorSelecionado?.nome}</strong> para{" "}
              <strong>{format(selectedDate!, "dd/MM/yyyy", { locale: ptBR })}</strong> às{" "}
              <strong>{horariosResumo}</strong>
              {selectedTimes.length > 1 && (
                <span className="text-xs ml-1">({selectedTimes.length * 30}min)</span>
              )}
            </div>
          )}
          <div className="flex gap-2 w-full sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!canConfirm || agendarMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              {agendarMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirmar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
