import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";

const CATEGORIAS = [
  { value: "espiritual", label: "Área Espiritual" },
  { value: "casamento", label: "Casamento" },
  { value: "familia", label: "Família" },
  { value: "saude", label: "Saúde" },
  { value: "trabalho", label: "Trabalho" },
  { value: "financeiro", label: "Vida Financeira" },
  { value: "ministerial", label: "Vida Ministerial" },
  { value: "outro", label: "Outros" },
];

const testemunhoSchema = z.object({
  titulo: z.string()
    .trim()
    .min(3, "O título deve ter pelo menos 3 caracteres")
    .max(200, "O título deve ter no máximo 200 caracteres"),
  mensagem: z.string()
    .trim()
    .min(10, "A mensagem deve ter pelo menos 10 caracteres")
    .max(5000, "A mensagem deve ter no máximo 5000 caracteres"),
  categoria: z.string().min(1, "Selecione uma categoria"),
});

interface NovoTestemunhoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovoTestemunhoDialog({ open, onOpenChange, onSuccess }: NovoTestemunhoDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    titulo: "",
    mensagem: "",
    categoria: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validação
    const result = testemunhoSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          newErrors[issue.path[0].toString()] = issue.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    if (!profile?.id) {
      toast({
        title: "Erro",
        description: "Você precisa estar autenticado para criar um testemunho",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("testemunhos").insert({
        titulo: result.data.titulo,
        mensagem: result.data.mensagem,
        categoria: result.data.categoria as any,
        autor_id: profile.id,
        status: "aberto",
        publicar: false,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Testemunho criado com sucesso! Aguarde a aprovação.",
      });

      setFormData({ titulo: "", mensagem: "", categoria: "" });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Erro ao criar testemunho:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o testemunho",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compartilhar Testemunho</DialogTitle>
          <DialogDescription>
            Compartilhe como Deus tem agido em sua vida
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Deus restaurou meu casamento"
              maxLength={200}
            />
            {errors.titulo && (
              <p className="text-sm text-destructive">{errors.titulo}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria *</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value })}
            >
              <SelectTrigger id="categoria">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoria && (
              <p className="text-sm text-destructive">{errors.categoria}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem *</Label>
            <Textarea
              id="mensagem"
              value={formData.mensagem}
              onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
              placeholder="Conte como Deus agiu em sua vida..."
              rows={8}
              maxLength={5000}
              className="resize-none"
            />
            <div className="flex justify-between items-center">
              {errors.mensagem && (
                <p className="text-sm text-destructive">{errors.mensagem}</p>
              )}
              <p className="text-xs text-muted-foreground ml-auto">
                {formData.mensagem.length}/5000
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-primary">
              {loading ? "Enviando..." : "Compartilhar Testemunho"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
