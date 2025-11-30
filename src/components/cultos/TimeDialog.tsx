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
  categoria: string;
  descricao: string | null;
  cor: string | null;
  ativo: boolean;
}

interface TimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  time?: Time | null;
  onSuccess: () => void;
}

const timeSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  descricao: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  cor: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor inválida"),
  ativo: z.boolean()
});

interface Categoria {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
}

const CORES_SUGERIDAS = [
  "#8B5CF6", // Purple
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
];

export default function TimeDialog({ open, onOpenChange, time, onSuccess }: TimeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    categoria: "",
    descricao: "",
    cor: "#8B5CF6",
    ativo: true
  });

  useEffect(() => {
    if (open) {
      loadCategorias();
    }
  }, [open]);

  const loadCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from("categorias_times")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) throw error;
      setCategorias(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar categorias");
    }
  };

  useEffect(() => {
    if (time) {
      setFormData({
        nome: time.nome,
        categoria: time.categoria,
        descricao: time.descricao || "",
        cor: time.cor || "#8B5CF6",
        ativo: time.ativo
      });
    } else {
      setFormData({
        nome: "",
        categoria: "",
        descricao: "",
        cor: "#8B5CF6",
        ativo: true
      });
    }
  }, [time, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validação
      const validation = timeSchema.safeParse(formData);
      if (!validation.success) {
        validation.error.issues.forEach(issue => {
          toast.error(issue.message);
        });
        return;
      }

      const dataToSave = {
        nome: formData.nome.trim(),
        categoria: formData.categoria,
        descricao: formData.descricao.trim() || null,
        cor: formData.cor,
        ativo: formData.ativo
      };

      if (time) {
        // Atualizar time existente
        const { error } = await supabase
          .from("times_culto")
          .update(dataToSave)
          .eq("id", time.id);

        if (error) throw error;
        toast.success("Time atualizado com sucesso!");
      } else {
        // Criar novo time
        const { error } = await supabase
          .from("times_culto")
          .insert(dataToSave);

        if (error) throw error;
        toast.success("Time criado com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao salvar time", {
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
          <DialogTitle>{time ? "Editar Time" : "Novo Time"}</DialogTitle>
          <DialogDescription>
            {time ? "Atualize as informações do time" : "Crie um novo time para os cultos"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Time *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Louvor, Sonorização, Recepção"
              maxLength={100}
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria *</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value })}
            >
              <SelectTrigger id="categoria">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {categorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: cat.cor }}
                      />
                      {cat.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cor */}
          <div className="space-y-2">
            <Label htmlFor="cor">Cor do Time *</Label>
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
            <p className="text-xs text-muted-foreground">
              Cor selecionada: {formData.cor}
            </p>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva as responsabilidades e funções deste time..."
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
              <Label htmlFor="ativo" className="text-base">Time Ativo</Label>
              <p className="text-sm text-muted-foreground">
                Times inativos não aparecem para escalas
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
                time ? "Atualizar" : "Criar Time"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
