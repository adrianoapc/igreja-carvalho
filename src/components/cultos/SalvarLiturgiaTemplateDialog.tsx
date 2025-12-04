import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface SalvarLiturgiaTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cultoId: string;
  onSuccess?: () => void;
}

interface LiturgiaItemTemplate {
  titulo: string;
  tipo: string;
  ordem: number;
  duracao_minutos: number | null;
  descricao: string | null;
  responsavel_id: string | null;
  responsavel_externo: string | null;
}

export function SalvarLiturgiaTemplateDialog({
  open,
  onOpenChange,
  cultoId,
  onSuccess
}: SalvarLiturgiaTemplateDialogProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Digite um nome para o template");
      return;
    }

    setLoading(true);

    try {
      // Buscar todos os itens da liturgia do culto atual
      const { data: itensLiturgia, error: fetchError } = await supabase
        .from("liturgia_culto")
        .select("titulo, tipo, ordem, duracao_minutos, descricao, responsavel_id, responsavel_externo")
        .eq("culto_id", cultoId)
        .order("ordem");

      if (fetchError) throw fetchError;

      if (!itensLiturgia || itensLiturgia.length === 0) {
        toast.error("Este culto não possui itens de liturgia para salvar");
        return;
      }

      // Limpar dados específicos e criar estrutura do template
      const estruturaJson: LiturgiaItemTemplate[] = itensLiturgia.map((item, index) => ({
        titulo: item.titulo,
        tipo: item.tipo,
        ordem: index + 1,
        duracao_minutos: item.duracao_minutos,
        descricao: item.descricao,
        responsavel_id: item.responsavel_id,
        responsavel_externo: item.responsavel_externo
      }));

      // Salvar template
      const { error: insertError } = await supabase
        .from("liturgia_templates")
        .insert([{
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          estrutura_json: estruturaJson as unknown as Json
        }]);

      if (insertError) throw insertError;

      toast.success("Template salvo com sucesso!", {
        description: `${estruturaJson.length} itens salvos no template "${nome}"`
      });

      setNome("");
      setDescricao("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template", { description: error.message });
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

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Template *</Label>
            <Input
              id="nome"
              placeholder="Ex: Culto de Santa Ceia"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva este template..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Os itens da liturgia atual serão salvos como template para reutilização em outros cultos.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || !nome.trim()}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
