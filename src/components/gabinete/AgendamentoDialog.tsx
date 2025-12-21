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
    onError: () => {
      toast.error("Erro ao salvar agendamento");
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
    <div className="space-y-4">
      <div className="text-center space-y-2 pb-4">
        <User className="h-12 w-12 mx-auto text-primary" />
        <h3 className="font-semibold text-lg">Selecione o Pastor</h3>
        <p className="text-sm text-muted-foreground">Escolha o pastor que irá realizar o atendimento</p>
      </div>
      
      <div className="space-y-2">
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
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                isSelected && "border-primary bg-primary/5 ring-2 ring-primary",
                !isSelected && temConfig && "hover:border-primary/50 hover:bg-muted/50",
                !temConfig && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-white font-medium",
                isSelected ? "bg-primary" : "bg-muted-foreground"
              )}>
                {pastor.nome?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium">{pastor.nome}</p>
                {!temConfig && (
                  <p className="text-xs text-destructive">Agenda não configurada</p>
                )}
              </div>
              {isSelected && <Check className="h-5 w-5 text-primary" />}
            </button>
          );
        })}
        
        {pastores.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum pastor cadastrado</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStepData = () => (
    <div className="space-y-4">
      <div className="text-center space-y-2 pb-2">
        <CalendarIcon className="h-12 w-12 mx-auto text-primary" />
        <h3 className="font-semibold text-lg">Escolha a Data</h3>
        <p className="text-sm text-muted-foreground">
          Agendando com <strong>{pastorSelecionado?.nome}</strong>
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
          className="rounded-md border"
        />
      </div>
      
      {selectedDate && !pastorAtendeNoDia && (
        <Alert variant="destructive">
          <CalendarX className="h-4 w-4" />
          <AlertTitle>Não disponível</AlertTitle>
          <AlertDescription>
            {pastorSelecionado?.nome} não atende às {nomeDiaSelecionado}. Escolha outro dia.
          </AlertDescription>
        </Alert>
      )}
      
      {selectedDate && pastorAtendeNoDia && (
        <div className="text-center text-sm text-muted-foreground">
          {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </div>
      )}
    </div>
  );

  const renderStepHorario = () => (
    <div className="space-y-4">
      <div className="text-center space-y-2 pb-2">
        <Clock className="h-12 w-12 mx-auto text-primary" />
        <h3 className="font-semibold text-lg">Selecione o Horário</h3>
        <p className="text-sm text-muted-foreground">
          {selectedDate && format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}
        </p>
      </div>
      
      {loadingAgendamentos ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : timeSlots.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum horário disponível</p>
        </div>
      ) : (
        <>
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
              <span className="text-xs text-muted-foreground self-center ml-2">
                ({selectedTimes.length * 30}min)
              </span>
            </div>
          )}
          
          <ScrollArea className="h-48">
            <div className="grid grid-cols-4 gap-2">
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
                      "text-sm",
                      !slot.available && "opacity-50 cursor-not-allowed bg-muted",
                      isSelected && "ring-2 ring-primary"
                    )}
                    title={!slot.available ? slot.conflictInfo : undefined}
                  >
                    {slot.label}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
          
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded border bg-background" />
              <span>Disponível</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-muted" />
              <span>Ocupado</span>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderStepModalidade = () => (
    <div className="space-y-4">
      <div className="text-center space-y-2 pb-2">
        <Building2 className="h-12 w-12 mx-auto text-primary" />
        <h3 className="font-semibold text-lg">Modalidade do Atendimento</h3>
        <p className="text-sm text-muted-foreground">Como será o atendimento?</p>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
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
                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
                isSelected && "border-primary bg-primary/5 ring-2 ring-primary",
                !isSelected && "hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <Icon className={cn("h-8 w-8", isSelected ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("font-medium", isSelected && "text-primary")}>{item.label}</span>
            </button>
          );
        })}
      </div>
      
      {(modalidadeAtendimento === "visita" || modalidadeAtendimento === "online") && (
        <div className="space-y-2 pt-2">
          <Label>
            {modalidadeAtendimento === "visita" ? "Endereço da visita" : "Link da reunião"}
          </Label>
          <Input
            placeholder={modalidadeAtendimento === "visita" ? "Rua, número, bairro..." : "https://meet.google.com/..."}
            value={localAtendimento}
            onChange={(e) => setLocalAtendimento(e.target.value)}
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {modalidadeAtendimento === "visita" ? (
              <><MapPin className="h-3 w-3" /> Informe o endereço completo</>
            ) : (
              <><Video className="h-3 w-3" /> Cole o link do Meet, Zoom, etc.</>
            )}
          </p>
        </div>
      )}
      
      {/* Resumo final */}
      <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
        <h4 className="font-medium text-sm">Resumo do Agendamento</h4>
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{pastorSelecionado?.nome}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span>{selectedDate && format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{horariosResumo} ({selectedTimes.length * 30}min)</span>
          </div>
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
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Agendar Atendimento
          </DialogTitle>
          <DialogDescription className="sr-only">
            Wizard para agendar atendimento pastoral
          </DialogDescription>
          
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {STEPS.map((step, index) => {
              const isActive = step === currentStep;
              const isPast = index < currentStepIndex;
              return (
                <div key={step} className="flex items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isPast && "bg-primary/20 text-primary",
                    !isActive && !isPast && "bg-muted text-muted-foreground"
                  )}>
                    {isPast ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      "w-8 h-0.5 mx-1",
                      index < currentStepIndex ? "bg-primary/50" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground pt-1">
            {STEP_LABELS[currentStep]}
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 py-4">
          <div className="px-1">
            {renderCurrentStep()}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4 shrink-0">
          <div className="flex w-full gap-2">
            {currentStepIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={goToPrevStep}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>
            )}
            
            <div className="flex-1" />
            
            {!isLastStep ? (
              <Button
                onClick={goToNextStep}
                disabled={!canGoNext}
                className="gap-1"
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={agendarMutation.isPending}
                className="gap-1"
              >
                {agendarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
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