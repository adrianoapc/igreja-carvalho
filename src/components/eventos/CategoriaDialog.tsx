import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";

interface Categoria {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
}

interface CategoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria?: Categoria | null;
  onSuccess: () => void;
}

const categoriaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(50, "Nome deve ter no máximo 50 caracteres"),
  cor: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor inválida"),
  ativo: z.boolean()
});

const CORES_SUGERIDAS = [
  "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", 
  "#EF4444", "#EC4899", "#06B6D4", "#6366F1"
];

export default function CategoriaDialog({ open, onOpenChange, categoria, onSuccess }: CategoriaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    cor: "#8B5CF6",
    ativo: true
  });

  useEffect(() => {
    if (categoria) {
      setFormData({
        nome: categoria.nome,
        cor: categoria.cor,
        ativo: categoria.ativo
      });
    } else {
      setFormData({
        nome: "",
        cor: "#8B5CF6",
        ativo: true
      });
    }
  }, [categoria, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = categoriaSchema.safeParse(formData);
      if (!validation.success) {
        validation.error.issues.forEach(issue => {
          toast.error(issue.message);
        });
        return;
      }

      const dataToSave = {
        nome: formData.nome.trim(),
        cor: formData.cor,
        ativo: formData.ativo
      };

      if (categoria) {
        const { error } = await supabase
          .from("categorias_times")
          .update(dataToSave)
          .eq("id", categoria.id);

        if (error) throw error;
        toast.success("Categoria atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("categorias_times")
          .insert(dataToSave);

        if (error) throw error;
        toast.success("Categoria criada com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error("Erro ao salvar categoria", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title={categoria ? "Editar Categoria" : "Nova Categoria"}
    >
      <div className="flex flex-col h-full">
        {/* Description */}
        <div className="px-4 pt-2 pb-0 md:px-6">
          <p className="text-sm text-muted-foreground">
            {categoria ? "Atualize as informações da categoria" : "Crie uma nova categoria para os times"}
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
            <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Categoria *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Música, Técnico, Kids"
              maxLength={50}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cor">Cor *</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="cor"
                type="color"
                value={formData.cor}
                onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                className="w-20 h-10 cursor-pointer"
                required
              />
              <div className="flex gap-1 flex-wrap flex-1">
                {CORES_SUGERIDAS.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    className="w-8 h-8 rounded-md border-2 border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: cor }}
                    onClick={() => setFormData({ ...formData, cor })}
                    title={cor}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="ativo" className="text-base">Categoria Ativa</Label>
              <p className="text-sm text-muted-foreground">
                Categorias inativas não aparecem nas opções
              </p>
            </div>
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
            />
          </div>

          </div>
          </div>

          {/* Footer */}
          <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2">
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
                categoria ? "Atualizar" : "Criar"
              )}
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveDialog>
  );
}