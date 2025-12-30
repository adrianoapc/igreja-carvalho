import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface Evento {
  id: string;
  titulo: string;
}

interface Voluntario {
  id: string;
  nome: string;
  avatar_url: string | null;
}

interface EscalaSlot {
  id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  pessoa_id: string;
  confirmado: boolean;
  time_id?: string;
  posicao_id?: string;
  profiles: Voluntario;
}

interface EscalaSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento: Evento;
  slot: { hora: number; data: Date } | null;
  editingSlot: EscalaSlot | null;
  onSuccess: () => void;
}

export default function EscalaSlotDialog({
  open,
  onOpenChange,
  evento,
  slot,
  editingSlot,
  onSuccess,
}: EscalaSlotDialogProps) {
  const [loading, setLoading] = useState(false);
  const [voluntarios, setVoluntarios] = useState<Voluntario[]>([]);
  const [selectedVoluntario, setSelectedVoluntario] = useState<string>("");
  const [confirmado, setConfirmado] = useState(false);
  const [loadingVoluntarios, setLoadingVoluntarios] = useState(false);

  useEffect(() => {
    if (open) {
      loadVoluntarios();
      if (editingSlot) {
        setSelectedVoluntario(editingSlot.pessoa_id);
        setConfirmado(editingSlot.confirmado);
      } else {
        setSelectedVoluntario("");
        setConfirmado(false);
      }
    }
  }, [open, editingSlot]);

  const loadVoluntarios = async () => {
    try {
      setLoadingVoluntarios(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .order("nome");

      if (error) throw error;
      setVoluntarios(data || []);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar voluntários";
      console.error("Erro ao carregar voluntários:", error);
      toast.error(message);
    } finally {
      setLoadingVoluntarios(false);
    }
  };

  const handleSave = async () => {
    if (!selectedVoluntario) {
      toast.error("Selecione um voluntário");
      return;
    }

    setLoading(true);
    try {
      if (editingSlot) {
        // Atualizar
        const { error } = await supabase
          .from("escalas")
          .update({ pessoa_id: selectedVoluntario, confirmado })
          .eq("id", editingSlot.id);

        if (error) throw error;
        toast.success("Escala atualizada");
      } else if (slot) {
        // Inserir novo
        const dataInicio = new Date(slot.data);
        dataInicio.setHours(slot.hora, 0, 0, 0);
        const dataFim = new Date(dataInicio);
        dataFim.setHours(dataFim.getHours() + 1);

        const { error } = await supabase.from("escalas").insert({
          evento_id: evento.id,
          pessoa_id: selectedVoluntario,
          data_hora_inicio: dataInicio.toISOString(),
          data_hora_fim: dataFim.toISOString(),
          confirmado,
        });

        if (error) throw error;
        toast.success("Voluntário adicionado ao turno");
      }

      onSuccess();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao salvar escala";
      console.error("Erro ao salvar:", error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold">
            {editingSlot ? "Editar Turno" : "Adicionar Voluntário"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{evento.titulo}</p>
        </div>

        <div className="space-y-4">
          {/* Seletor de Voluntário */}
          <div className="space-y-2">
            <Label>Voluntário</Label>
            <Select
              value={selectedVoluntario}
              onValueChange={setSelectedVoluntario}
            >
              <SelectTrigger disabled={loadingVoluntarios}>
                <SelectValue placeholder="Selecione um voluntário..." />
              </SelectTrigger>
              <SelectContent>
                {voluntarios.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checkbox de Confirmação */}
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
            <Checkbox
              id="confirmado"
              checked={confirmado}
              onCheckedChange={(checked) => setConfirmado(checked as boolean)}
            />
            <Label htmlFor="confirmado" className="cursor-pointer flex-1 mb-0">
              Confirmado
            </Label>
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !selectedVoluntario}
            className="flex-1"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editingSlot ? "Atualizar" : "Adicionar"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
