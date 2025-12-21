import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Heart, Calendar, Stethoscope, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgendamentoDialog } from "./AgendamentoDialog";

interface NovoEventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  defaultPastorId?: string;
}

type EventoStep = "escolha" | "compromisso";

const TIPOS_COMPROMISSO = [
  { value: "COMPROMISSO", label: "Compromisso", cor: "blue" },
  { value: "BLOQUEIO", label: "Bloqueio de Agenda", cor: "gray" },
  { value: "FERIAS", label: "Férias/Afastamento", cor: "green" },
  { value: "OUTRO", label: "Outro", cor: "purple" },
];

export function NovoEventoDialog({
  open,
  onOpenChange,
  selectedDate,
  defaultPastorId,
}: NovoEventoDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<EventoStep>("escolha");
  const [agendamentoDialogOpen, setAgendamentoDialogOpen] = useState(false);
  
  // Form state para compromisso
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pastorId, setPastorId] = useState<string>(defaultPastorId || "");
  const [tipoCompromisso, setTipoCompromisso] = useState("COMPROMISSO");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("10:00");

  // Fetch pastores (apenas quem é pastor)
  const { data: pastores = [] } = useQuery({
    queryKey: ["pastores-evento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("e_pastor", true)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const criarCompromissoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !pastorId || !titulo) {
        throw new Error("Dados incompletos");
      }

      const [horaIni, minIni] = horaInicio.split(":").map(Number);
      const [horaF, minF] = horaFim.split(":").map(Number);

      const dataInicio = new Date(selectedDate);
      dataInicio.setHours(horaIni, minIni, 0, 0);

      const dataFim = new Date(selectedDate);
      dataFim.setHours(horaF, minF, 0, 0);

      const tipoInfo = TIPOS_COMPROMISSO.find((t) => t.value === tipoCompromisso);

      const { error } = await supabase.from("agenda_pastoral").insert({
        pastor_id: pastorId,
        titulo,
        descricao: descricao || null,
        data_inicio: dataInicio.toISOString(),
        data_fim: dataFim.toISOString(),
        tipo: tipoCompromisso,
        cor: tipoInfo?.cor || "blue",
        criado_por: profile?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compromissos-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos-pastor"] });
      toast.success("Compromisso criado!");
      resetAndClose();
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao criar compromisso");
    },
  });

  const resetAndClose = () => {
    setStep("escolha");
    setTitulo("");
    setDescricao("");
    setTipoCompromisso("COMPROMISSO");
    setHoraInicio("09:00");
    setHoraFim("10:00");
    if (!defaultPastorId) setPastorId("");
    onOpenChange(false);
  };

  const handleEscolhaAtendimento = () => {
    onOpenChange(false);
    setAgendamentoDialogOpen(true);
  };

  const handleEscolhaCompromisso = () => {
    setStep("compromisso");
  };

  const handleBack = () => {
    setStep("escolha");
  };

  const handleSubmitCompromisso = () => {
    if (!titulo.trim()) {
      toast.error("Informe o título");
      return;
    }
    if (!pastorId) {
      toast.error("Selecione o pastor");
      return;
    }
    criarCompromissoMutation.mutate();
  };

  const renderEscolha = () => (
    <div className="grid gap-4 py-4">
      <p className="text-sm text-muted-foreground text-center">
        {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={handleEscolhaAtendimento}
          className={cn(
            "flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed",
            "hover:border-primary hover:bg-primary/5 transition-all",
            "cursor-pointer group"
          )}
        >
          <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
            <Stethoscope className="h-8 w-8" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">Atendimento Pastoral</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Agendar conversa com membro
            </p>
          </div>
        </button>

        <button
          onClick={handleEscolhaCompromisso}
          className={cn(
            "flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed",
            "hover:border-primary hover:bg-primary/5 transition-all",
            "cursor-pointer group"
          )}
        >
          <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
            <Calendar className="h-8 w-8" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">Compromisso/Bloqueio</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Reunião, almoço, férias, etc.
            </p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderCompromissoForm = () => (
    <div className="grid gap-4 py-4">
      <div className="space-y-2">
        <Label>Título *</Label>
        <Input
          placeholder="Ex: Reunião de Obreiros, Almoço..."
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Pastor</Label>
        <Select value={pastorId} onValueChange={setPastorId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {pastores.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={tipoCompromisso} onValueChange={setTipoCompromisso}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_COMPROMISSO.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Início
          </Label>
          <Input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Fim
          </Label>
          <Input
            type="time"
            value={horaFim}
            onChange={(e) => setHoraFim(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição (opcional)</Label>
        <Textarea
          placeholder="Detalhes adicionais..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step === "escolha" ? (
                <>
                  <Calendar className="h-5 w-5 text-primary" />
                  Novo Evento
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-primary" />
                  Novo Compromisso
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {step === "escolha"
                ? "Escolha o tipo de evento para adicionar"
                : "Preencha os dados do compromisso"}
            </DialogDescription>
          </DialogHeader>

          {step === "escolha" ? renderEscolha() : renderCompromissoForm()}

          {step === "compromisso" && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleBack}>
                Voltar
              </Button>
              <Button
                onClick={handleSubmitCompromisso}
                disabled={criarCompromissoMutation.isPending}
              >
                {criarCompromissoMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Agendamento de Atendimento (reaproveitado) */}
      <AgendamentoDialog
        atendimentoId={null}
        open={agendamentoDialogOpen}
        onOpenChange={setAgendamentoDialogOpen}
        pastorPreSelecionadoId={defaultPastorId}
      />
    </>
  );
}
