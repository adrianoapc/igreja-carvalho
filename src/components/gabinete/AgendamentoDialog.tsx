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
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  Video, 
  Loader2, 
  Clock, 
  User, 
  AlertCircle, 
  CalendarX, 
  X, 
  Phone, 
  Home, 
  Building2,
  ChevronLeft,
  ChevronRight,
  Check
} from "lucide-react";
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
import { format, parseISO, setHours, setMinutes, startOfDay, addMinutes, isAfter, isBefore, getDay } from "date-fns";
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

interface DisponibilidadeDia {
  ativo: boolean;
  inicio?: string;
  fim?: string;
}

interface DisponibilidadeAgenda {
  [key: string]: DisponibilidadeDia | boolean | undefined;
  padrao?: boolean;
}

type WizardStep = "pastor" | "data" | "horario" | "modalidade";

const STEPS: WizardStep[] = ["pastor", "data", "horario", "modalidade"];

const STEP_LABELS: Record<WizardStep, string> = {
  pastor: "Pastor",
  data: "Data",
  horario: "Horário",
  modalidade: "Modalidade",
};

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
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>("pastor");
  
  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedPastorId, setSelectedPastorId] = useState<string | null>(pastorPreSelecionadoId || null);
  const [modalidadeAtendimento, setModalidadeAtendimento] = useState<string>("gabinete");
  const [localAtendimento, setLocalAtendimento] = useState("");

  // Reset quando abre
  useEffect(() => {
    if (open) {
      if (pastorPreSelecionadoId) {
        setSelectedPastorId(pastorPreSelecionadoId);
        setCurrentStep("data");
      } else {
        setCurrentStep("pastor");
      }
    }
  }, [open, pastorPreSelecionadoId]);

  const { data: pastores = [] } = useQuery({
    queryKey: ["pastores-gabinete-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, disponibilidade_agenda")
        .eq("e_pastor", true)
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

  // Fetch atendimentos existentes
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

  // Fetch compromissos administrativos
  const { data: compromissosExistentes = [] } = useQuery({
    queryKey: ["compromissos-pastor", selectedPastorId, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedPastorId || !selectedDate) return [];
      
      const startOfSelectedDay = startOfDay(selectedDate);
      const endOfSelectedDay = new Date(startOfSelectedDay);
      endOfSelectedDay.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabase
        .from("agenda_pastoral")
        .select("id, titulo, data_inicio, data_fim, tipo")
        .eq("pastor_id", selectedPastorId)
        .gte("data_inicio", startOfSelectedDay.toISOString())
        .lte("data_inicio", endOfSelectedDay.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!selectedPastorId && !!selectedDate && pastorTemConfiguracao && pastorAtendeNoDia,
  });

  const occupiedSlots = useMemo(() => {
    const atendimentoSlots = agendamentosExistentes.map(ag => {
      const start = parseISO(ag.data_agendamento);
      const end = addMinutes(start, 60);
      return { start, end, info: ag.motivo_resumo || "Atendimento" };
    });

    const compromissoSlots = compromissosExistentes.map(c => {
      const start = parseISO(c.data_inicio);
      const end = parseISO(c.data_fim);
      return { start, end, info: `🚫 ${c.titulo}` };
    });

    return [...atendimentoSlots, ...compromissoSlots];
  }, [agendamentosExistentes, compromissosExistentes]);

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

      const firstTime = selectedTimes.sort()[0];
      const [hours, minutes] = firstTime.split(":").map(Number);
      const dataAgendamento = new Date(selectedDate);
      dataAgendamento.setHours(hours, minutes, 0, 0);

      const duracaoMinutos = selectedTimes.length * 30;

      const modalidadeLabels: Record<string, string> = {
        gabinete: "Gabinete",
        visita: "Visita",
        ligacao: "Ligação",
        online: "Online",
      };
      const localCompleto = localAtendimento 
        ? `${modalidadeLabels[modalidadeAtendimento]}: ${localAtendimento}`
        : modalidadeLabels[modalidadeAtendimento];

      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({
          data_agendamento: dataAgendamento.toISOString(),
          local_atendimento: localCompleto,
          pastor_responsavel_id: selectedPastorId,
          status: "AGENDADO",
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
    onError: (error: Error) => {
      console.error("Erro ao salvar agendamento:", error);
      toast.error(`Erro ao salvar agendamento: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedDate(new Date());
    setSelectedTimes([]);
    setModalidadeAtendimento("gabinete");
    setLocalAtendimento("");
    setCurrentStep("pastor");
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
    agendarMutation.mutate();
  };

  // Navegação do wizard
  const currentStepIndex = STEPS.indexOf(currentStep);
  
  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case "pastor":
        return !!selectedPastorId && pastorTemConfiguracao;
      case "data":
        return !!selectedDate && pastorAtendeNoDia;
      case "horario":
        return selectedTimes.length > 0;
      case "modalidade":
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedPastorId, pastorTemConfiguracao, selectedDate, pastorAtendeNoDia, selectedTimes]);

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const isLastStep = currentStep === "modalidade";

  // Resumo para o final
  const horariosResumo = useMemo(() => {
    if (selectedTimes.length === 0) return "";
    const sorted = [...selectedTimes].sort();
    if (sorted.length === 1) return sorted[0];
    return `${sorted[0]} - ${sorted[sorted.length - 1]}`;
  }, [selectedTimes]);

  // ===== RENDER STEPS =====
  const renderStepPastor = () => (
    <div className="space-y-3">
      <div className="text-center space-y-1 pb-2">
        <User className="h-8 w-8 mx-auto text-primary" />
        <h3 className="font-medium text-sm">Selecione o Pastor</h3>
      </div>
      
      <div className="space-y-1.5">
        {pastores.map((pastor) => {
          const disponibilidade = pastor.disponibilidade_agenda as unknown as DisponibilidadeAgenda;
          const temConfig = hasValidDisponibilidade(disponibilidade);
          const isSelected = selectedPastorId === pastor.id;
          
          return (
            <button
              key={pastor.id}
              onClick={() => {
                setSelectedPastorId(pastor.id);
                setSelectedTimes([]);
              }}
              disabled={!temConfig}
              className={cn(
                "w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-left",
                isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
                !isSelected && temConfig && "hover:border-primary/50 hover:bg-muted/50",
                !temConfig && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0",
                isSelected ? "bg-primary" : "bg-muted-foreground"
              )}>
                {pastor.nome?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pastor.nome}</p>
                {!temConfig && (
                  <p className="text-[10px] text-destructive">Agenda não configurada</p>
                )}
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          );
        })}
        
        {pastores.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <User className="h-6 w-6 mx-auto mb-1 opacity-50" />
            <p className="text-xs">Nenhum pastor cadastrado</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStepData = () => (
    <div className="space-y-2">
      <div className="text-center space-y-1">
        <CalendarIcon className="h-6 w-6 mx-auto text-primary" />
        <h3 className="font-medium text-sm">Escolha a Data</h3>
        <p className="text-xs text-muted-foreground">
          Com <strong>{pastorSelecionado?.nome}</strong>
        </p>
      </div>
      
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
          className="pointer-events-auto rounded-md border text-xs scale-[0.85] origin-top [&_.rdp-caption]:text-xs [&_.rdp-head_th]:text-[10px] [&_.rdp-cell]:p-0 [&_.rdp-button]:h-7 [&_.rdp-button]:w-7 [&_.rdp-button]:text-[10px]"
        />
      </div>
      
      {selectedDate && !pastorAtendeNoDia && (
        <Alert variant="destructive" className="py-1.5 px-2">
          <CalendarX className="h-3 w-3" />
          <AlertDescription className="text-[10px]">
            Não atende às {nomeDiaSelecionado}.
          </AlertDescription>
        </Alert>
      )}
      
      {selectedDate && pastorAtendeNoDia && (
        <div className="text-center text-xs text-primary font-medium">
          {format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}
        </div>
      )}
    </div>
  );

  const renderStepHorario = () => (
    <div className="space-y-2">
      <div className="text-center space-y-1">
        <Clock className="h-6 w-6 mx-auto text-primary" />
        <h3 className="font-medium text-sm">Selecione o Horário</h3>
        <p className="text-xs text-muted-foreground">
          {selectedDate && format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}
        </p>
      </div>
      
      {loadingAgendamentos ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : timeSlots.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          <Clock className="h-5 w-5 mx-auto mb-1 opacity-50" />
          <p className="text-xs">Nenhum horário disponível</p>
        </div>
      ) : (
        <>
          {/* Slots selecionados */}
          {selectedTimes.length > 0 && (
            <div className="flex flex-wrap gap-1 pb-1.5 border-b">
              {selectedTimes.sort().map((time) => (
                <Badge key={time} variant="default" className="gap-0.5 text-xs h-5 px-1.5">
                  {time}
                  <button 
                    onClick={() => handleRemoveTime(time)}
                    className="ml-0.5 hover:bg-primary-foreground/20 rounded-full"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              <span className="text-[10px] text-muted-foreground self-center ml-1">
                ({selectedTimes.length * 30}min)
              </span>
            </div>
          )}
          
          <ScrollArea className="h-32">
            <div className="grid grid-cols-5 gap-1">
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
                      "text-xs h-7 px-1",
                      !slot.available && "opacity-50 cursor-not-allowed bg-muted",
                      isSelected && "ring-1 ring-primary"
                    )}
                    title={!slot.available ? slot.conflictInfo : undefined}
                  >
                    {slot.label}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
          
          <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded border bg-background" />
              <span>Livre</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded bg-muted" />
              <span>Ocupado</span>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderStepModalidade = () => (
    <div className="space-y-3">
      <div className="text-center space-y-1">
        <Building2 className="h-6 w-6 mx-auto text-primary" />
        <h3 className="font-medium text-sm">Modalidade</h3>
      </div>
      
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { id: "gabinete", icon: Building2, label: "Gabinete" },
          { id: "visita", icon: Home, label: "Visita" },
          { id: "ligacao", icon: Phone, label: "Ligação" },
          { id: "online", icon: Video, label: "Online" },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = modalidadeAtendimento === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setModalidadeAtendimento(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
                !isSelected && "hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <Icon className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-[10px] font-medium", isSelected && "text-primary")}>{item.label}</span>
            </button>
          );
        })}
      </div>
      
      {(modalidadeAtendimento === "visita" || modalidadeAtendimento === "online") && (
        <div className="space-y-1">
          <Label className="text-xs">
            {modalidadeAtendimento === "visita" ? "Endereço da visita" : "Link da reunião"}
          </Label>
          <Input
            placeholder={modalidadeAtendimento === "visita" ? "Rua, número, bairro..." : "https://meet.google.com/..."}
            value={localAtendimento}
            onChange={(e) => setLocalAtendimento(e.target.value)}
            className="h-8 text-sm"
          />
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            {modalidadeAtendimento === "visita" ? (
              <><MapPin className="h-2.5 w-2.5" /> Informe o endereço completo</>
            ) : (
              <><Video className="h-2.5 w-2.5" /> Cole o link do Meet, Zoom, etc.</>
            )}
          </p>
        </div>
      )}
      
      {/* Resumo final */}
      <div className="p-2.5 bg-muted/50 rounded-lg space-y-1.5">
        <h4 className="font-medium text-xs">Resumo</h4>
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">{pastorSelecionado?.nome}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>{selectedDate && format(selectedDate, "dd/MM (EEE)", { locale: ptBR })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>{horariosResumo} ({selectedTimes.length * 30}min)</span>
          </div>
          {localAtendimento && (
            <div className="flex items-start gap-1.5 pt-0.5 border-t mt-1">
              {modalidadeAtendimento === "visita" ? (
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              ) : (
                <Video className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <span className="text-[10px] break-all">{localAtendimento}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "pastor":
        return renderStepPastor();
      case "data":
        return renderStepData();
      case "horario":
        return renderStepHorario();
      case "modalidade":
        return renderStepModalidade();
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[85vh] flex flex-col p-4">
        <DialogHeader className="pb-1 shrink-0 space-y-1">
          <DialogTitle className="flex items-center gap-1.5 text-sm">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Agendar Atendimento
          </DialogTitle>
          <DialogDescription className="sr-only">
            Wizard para agendar atendimento pastoral
          </DialogDescription>
          
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 pt-1">
            {STEPS.map((step, index) => {
              const isActive = step === currentStep;
              const isPast = index < currentStepIndex;
              return (
                <div key={step} className="flex items-center">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isPast && "bg-primary/20 text-primary",
                    !isActive && !isPast && "bg-muted text-muted-foreground"
                  )}>
                    {isPast ? <Check className="h-3 w-3" /> : index + 1}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      "w-6 h-0.5 mx-0.5",
                      index < currentStepIndex ? "bg-primary/50" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 py-2">
          <div className="px-0.5">
            {renderCurrentStep()}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-2 shrink-0">
          <div className="flex w-full gap-1.5">
            {currentStepIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goToPrevStep}
                className="gap-0.5 h-8 text-xs"
              >
                <ChevronLeft className="h-3 w-3" />
                Voltar
              </Button>
            )}
            
            <div className="flex-1" />
            
            {!isLastStep ? (
              <Button
                size="sm"
                onClick={goToNextStep}
                disabled={!canGoNext}
                className="gap-0.5 h-8 text-xs"
              >
                Próximo
                <ChevronRight className="h-3 w-3" />
              </Button>
            ) : (
              <Button 
                size="sm"
                onClick={handleSubmit} 
                disabled={agendarMutation.isPending}
                className="gap-0.5 h-8 text-xs"
              >
                {agendarMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Confirmar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}