import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, MapPin, Video, Loader2 } from "lucide-react";

interface AgendamentoDialogProps {
  atendimentoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AgendamentoDialog({
  atendimentoId,
  open,
  onOpenChange,
  onSuccess,
}: AgendamentoDialogProps) {
  const queryClient = useQueryClient();
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [localAtendimento, setLocalAtendimento] = useState("");

  const agendarMutation = useMutation({
    mutationFn: async () => {
      if (!atendimentoId || !dataAgendamento) {
        throw new Error("Dados incompletos");
      }

      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({
          data_agendamento: dataAgendamento,
          local_atendimento: localAtendimento || null,
          status: "AGENDADO",
        })
        .eq("id", atendimentoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      toast.success("Agendamento confirmado!");
      setDataAgendamento("");
      setLocalAtendimento("");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast.error("Erro ao salvar agendamento");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataAgendamento) {
      toast.error("Selecione uma data e horário");
      return;
    }
    agendarMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Agendar Atendimento
            </DialogTitle>
            <DialogDescription>
              Defina a data, horário e local do atendimento pastoral.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="data-agendamento">
                Data e Horário <span className="text-destructive">*</span>
              </Label>
              <Input
                id="data-agendamento"
                type="datetime-local"
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="local-atendimento" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Local ou Link (opcional)
              </Label>
              <Input
                id="local-atendimento"
                placeholder="Ex: Sala 1 ou https://meet.google.com/..."
                value={localAtendimento}
                onChange={(e) => setLocalAtendimento(e.target.value)}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Video className="h-3 w-3" />
                Cole um link para atendimento online
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={agendarMutation.isPending}>
              {agendarMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirmar Agendamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
