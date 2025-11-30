import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ItemTemplate {
  ordem: number;
  tipo: string;
  titulo: string;
  descricao?: string;
  duracao_minutos?: number;
  responsavel_externo?: string;
  midias_ids?: string[];
}

interface TemplatesLiturgiaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: {
    id: string;
    nome: string;
    descricao?: string;
    ativo: boolean;
  };
  onSuccess?: () => void;
}

export function TemplatesLiturgiaDialog({
  open,
  onOpenChange,
  template,
  onSuccess
}: TemplatesLiturgiaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (template) {
      setNome(template.nome);
      setDescricao(template.descricao || "");
    } else {
      setNome("");
      setDescricao("");
    }
  }, [template, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error("Nome do template é obrigatório");
      return;
    }

    setLoading(true);

    try {
      if (template) {
        // Atualizar template existente
        const { error } = await supabase
          .from("templates_liturgia")
          .update({
            nome: nome.trim(),
            descricao: descricao.trim() || null
          })
          .eq("id", template.id);

        if (error) throw error;
        toast.success("Template atualizado com sucesso");
      } else {
        // Criar novo template vazio
        const { error } = await supabase
          .from("templates_liturgia")
          .insert({
            nome: nome.trim(),
            descricao: descricao.trim() || null
          });

        if (error) throw error;
        toast.success("Template criado com sucesso");
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar template:", error);
      toast.error(error.message || "Erro ao salvar template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar Template" : "Novo Template de Liturgia"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Template *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Culto Dominical Padrão"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva quando usar este template..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {template ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
