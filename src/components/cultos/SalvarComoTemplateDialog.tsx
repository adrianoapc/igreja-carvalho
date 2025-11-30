import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SalvarComoTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cultoId: string;
  onSuccess?: () => void;
}

export function SalvarComoTemplateDialog({
  open,
  onOpenChange,
  cultoId,
  onSuccess
}: SalvarComoTemplateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error("Nome do template é obrigatório");
      return;
    }

    setLoading(true);

    try {
      // Buscar itens da liturgia atual
      const { data: itensLiturgia, error: itensError } = await supabase
        .from("liturgia_culto")
        .select("*")
        .eq("culto_id", cultoId)
        .order("ordem");

      if (itensError) throw itensError;

      if (!itensLiturgia || itensLiturgia.length === 0) {
        toast.error("Liturgia não possui itens para salvar");
        return;
      }

      // Criar template
      const { data: novoTemplate, error: templateError } = await supabase
        .from("templates_culto")
        .insert({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          ativo: true
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Criar itens do template baseados na liturgia
      const itensTemplate = itensLiturgia.map(item => ({
        template_id: novoTemplate.id,
        ordem: item.ordem,
        tipo: item.tipo,
        titulo: item.titulo,
        descricao: item.descricao,
        duracao_minutos: item.duracao_minutos,
        responsavel_externo: item.responsavel_externo,
        midias_ids: item.midias_ids
      }));

      const { error: itensInsertError } = await supabase
        .from("itens_template_culto")
        .insert(itensTemplate);

      if (itensInsertError) throw itensInsertError;

      toast.success("Template criado com sucesso");
      onSuccess?.();
      onOpenChange(false);
      setNome("");
      setDescricao("");
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
          <DialogTitle>Salvar como Template</DialogTitle>
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
              Salvar Template
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
