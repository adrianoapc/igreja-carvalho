import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [incluirEscalas, setIncluirEscalas] = useState(false);

  useEffect(() => {
    if (open && cultoId) {
      loadCultoData();
    }
  }, [open, cultoId]);

  const loadCultoData = async () => {
    try {
      const { data: culto } = await supabase
        .from("cultos")
        .select("*")
        .eq("id", cultoId)
        .single();

      if (culto) {
        setNome(`Template - ${culto.titulo}`);
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados do culto:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error("Nome do template é obrigatório");
      return;
    }

    setLoading(true);

    try {
      // Buscar dados do culto
      const { data: culto, error: cultoError } = await supabase
        .from("cultos")
        .select("*")
        .eq("id", cultoId)
        .single();

      if (cultoError) throw cultoError;

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

      // Criar template com dados do culto
      const { data: novoTemplate, error: templateError } = await supabase
        .from("templates_culto")
        .insert({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          tipo_culto: culto.tipo,
          tema_padrao: culto.tema,
          local_padrao: culto.local,
          duracao_padrao: culto.duracao_minutos,
          pregador_padrao: culto.pregador,
          observacoes_padrao: culto.observacoes,
          incluir_escalas: incluirEscalas,
          categoria: "Geral",
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

      // Salvar escalas se solicitado
      if (incluirEscalas) {
        const { data: escalas, error: escalasError } = await supabase
          .from("escalas_culto")
          .select("time_id, posicao_id, pessoa_id, observacoes")
          .eq("culto_id", cultoId);

        if (escalasError) throw escalasError;

        if (escalas && escalas.length > 0) {
          const escalasTemplate = escalas.map(escala => ({
            template_id: novoTemplate.id,
            time_id: escala.time_id,
            posicao_id: escala.posicao_id,
            pessoa_id: escala.pessoa_id,
            observacoes: escala.observacoes
          }));

          const { error: escalasInsertError } = await supabase
            .from("escalas_template")
            .insert(escalasTemplate);

          if (escalasInsertError) throw escalasInsertError;
        }
      }

      toast.success("Template criado com sucesso");
      onSuccess?.();
      onOpenChange(false);
      setNome("");
      setDescricao("");
      setIncluirEscalas(false);
    } catch (error: any) {
      console.error("Erro ao salvar template:", error);
      toast.error(error.message || "Erro ao salvar template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Salvar como Template</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="incluirEscalas"
              checked={incluirEscalas}
              onCheckedChange={(checked) => setIncluirEscalas(checked as boolean)}
            />
            <Label htmlFor="incluirEscalas" className="text-sm font-normal cursor-pointer">
              Incluir escalas de times no template
            </Label>
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
        </div>
      </div>
    </ResponsiveDialog>
  );
}
