import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";

interface Time {
  id: string;
  nome: string;
  cor: string;
}

interface Posicao {
  id: string;
  nome: string;
  descricao: string | null;
  time_id: string;
  ativo: boolean;
}

interface PosicaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posicao?: Posicao | null;
  timeId?: string | null;
  onSuccess: () => void;
}

const posicaoSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  time_id: z.string().min(1, "Time é obrigatório"),
  descricao: z.string().trim().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  ativo: z.boolean()
});

export default function PosicaoDialog({ open, onOpenChange, posicao, timeId, onSuccess }: PosicaoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [times, setTimes] = useState<Time[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    time_id: timeId || "",
    descricao: "",
    ativo: true
  });

  useEffect(() => {
    if (open) {
      loadTimes();
    }
  }, [open]);

  useEffect(() => {
    if (posicao) {
      setFormData({
        nome: posicao.nome,
        time_id: posicao.time_id,
        descricao: posicao.descricao || "",
        ativo: posicao.ativo
      });
    } else {
      setFormData({
        nome: "",
        time_id: timeId || "",
        descricao: "",
        ativo: true
      });
    }
  }, [posicao, timeId, open]);

  const loadTimes = async () => {
    try {
      const { data, error } = await supabase
        .from("times_culto")
        .select("id, nome, cor")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) throw error;
      setTimes(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar times");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validação
      const validation = posicaoSchema.safeParse(formData);
      if (!validation.success) {
        validation.error.issues.forEach(issue => {
          toast.error(issue.message);
        });
        return;
      }

      const dataToSave = {
        nome: formData.nome.trim(),
        time_id: formData.time_id,
        descricao: formData.descricao.trim() || null,
        ativo: formData.ativo
      };

      if (posicao) {
        // Atualizar posição existente
        const { error } = await supabase
          .from("posicoes_time")
          .update(dataToSave)
          .eq("id", posicao.id);

        if (error) throw error;
        toast.success("Posição atualizada com sucesso!");
      } else {
        // Criar nova posição
        const { error } = await supabase
          .from("posicoes_time")
          .insert(dataToSave);

        if (error) throw error;
        toast.success("Posição criada com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao salvar posição", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{posicao ? "Editar Posição" : "Nova Posição"}</DialogTitle>
          <DialogDescription>
            {posicao ? "Atualize as informações da posição" : "Crie uma nova posição para o time"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="time">Time *</Label>
            <Select
              value={formData.time_id}
              onValueChange={(value) => setFormData({ ...formData, time_id: value })}
              disabled={!!timeId}
            >
              <SelectTrigger id="time">
                <SelectValue placeholder="Selecione um time" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {times.map((time) => (
                  <SelectItem key={time.id} value={time.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: time.cor }}
                      />
                      {time.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Posição *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Vocalista, Guitarrista, Tecladista"
              maxLength={100}
              required
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva as responsabilidades desta posição..."
              maxLength={500}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {formData.descricao.length}/500
            </p>
          </div>

          {/* Status Ativo */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="ativo" className="text-base">Posição Ativa</Label>
              <p className="text-sm text-muted-foreground">
                Posições inativas não aparecem para escalas
              </p>
            </div>
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                posicao ? "Atualizar" : "Criar Posição"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}