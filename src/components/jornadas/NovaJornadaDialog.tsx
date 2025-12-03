import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, X, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface NovaJornadaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CORES_TEMA = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export default function NovaJornadaDialog({
  open,
  onOpenChange,
  onSuccess,
}: NovaJornadaDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [corTema, setCorTema] = useState(CORES_TEMA[0]);
  const [etapas, setEtapas] = useState<string[]>(["Etapa 1", "Etapa 2", "Etapa 3"]);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create jornada
      const { data: jornada, error: jornadaError } = await supabase
        .from("jornadas")
        .insert({
          titulo,
          descricao: descricao || null,
          cor_tema: corTema,
        })
        .select()
        .single();

      if (jornadaError) throw jornadaError;

      // Create etapas
      const etapasToInsert = etapas
        .filter((e) => e.trim())
        .map((titulo, index) => ({
          jornada_id: jornada.id,
          titulo,
          ordem: index + 1,
        }));

      if (etapasToInsert.length > 0) {
        const { error: etapasError } = await supabase
          .from("etapas_jornada")
          .insert(etapasToInsert);

        if (etapasError) throw etapasError;
      }

      return jornada;
    },
    onSuccess: () => {
      toast.success("Jornada criada com sucesso!");
      resetForm();
      onSuccess();
    },
    onError: (error) => {
      console.error("Error creating jornada:", error);
      toast.error("Erro ao criar jornada");
    },
  });

  const resetForm = () => {
    setTitulo("");
    setDescricao("");
    setCorTema(CORES_TEMA[0]);
    setEtapas(["Etapa 1", "Etapa 2", "Etapa 3"]);
  };

  const addEtapa = () => {
    setEtapas([...etapas, `Etapa ${etapas.length + 1}`]);
  };

  const removeEtapa = (index: number) => {
    if (etapas.length > 1) {
      setEtapas(etapas.filter((_, i) => i !== index));
    }
  };

  const updateEtapa = (index: number, value: string) => {
    const newEtapas = [...etapas];
    newEtapas[index] = value;
    setEtapas(newEtapas);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Informe o título da jornada");
      return;
    }
    if (etapas.filter((e) => e.trim()).length === 0) {
      toast.error("Adicione pelo menos uma etapa");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Jornada</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Escola de Líderes 2025"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o objetivo desta jornada..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor do Tema</Label>
            <div className="flex gap-2 flex-wrap">
              {CORES_TEMA.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  className={`w-8 h-8 rounded-full transition-all ${
                    corTema === cor
                      ? "ring-2 ring-offset-2 ring-primary scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: cor }}
                  onClick={() => setCorTema(cor)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Etapas (Colunas do Kanban)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEtapa}
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {etapas.map((etapa, index) => (
                <div key={index} className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground w-6">
                    {index + 1}.
                  </span>
                  <Input
                    value={etapa}
                    onChange={(e) => updateEtapa(index, e.target.value)}
                    placeholder={`Etapa ${index + 1}`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEtapa(index)}
                    disabled={etapas.length <= 1}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Jornada"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
