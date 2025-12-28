import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const TIPOS_CULTO = [
  "Culto de Celebração",
  "Culto de Ensino",
  "Culto de Oração",
  "Santa Ceia",
  "Vigília",
  "Batismo",
  "Casamento",
  "Funeral",
  "Reunião de Jovens",
  "Reunião de Crianças",
  "Outro"
];

const CATEGORIAS_TEMPLATE = [
  "Culto Dominical",
  "Culto Especial",
  "Celebrações",
  "Eventos",
  "Reuniões",
  "Geral"
];

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
    tipo_culto?: string;
    tema_padrao?: string;
    local_padrao?: string;
    duracao_padrao?: number;
    pregador_padrao?: string;
    observacoes_padrao?: string;
    incluir_escalas?: boolean;
    categoria?: string;
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
  const [tipoCulto, setTipoCulto] = useState("");
  const [temaPadrao, setTemaPadrao] = useState("");
  const [localPadrao, setLocalPadrao] = useState("");
  const [duracaoPadrao, setDuracaoPadrao] = useState<number | undefined>(undefined);
  const [pregadorPadrao, setPregadorPadrao] = useState("");
  const [observacoesPadrao, setObservacoesPadrao] = useState("");
  const [incluirEscalas, setIncluirEscalas] = useState(false);
  const [categoria, setCategoria] = useState("Geral");

  useEffect(() => {
    if (template) {
      setNome(template.nome);
      setDescricao(template.descricao || "");
      setTipoCulto(template.tipo_culto || "");
      setTemaPadrao(template.tema_padrao || "");
      setLocalPadrao(template.local_padrao || "");
      setDuracaoPadrao(template.duracao_padrao || undefined);
      setPregadorPadrao(template.pregador_padrao || "");
      setObservacoesPadrao(template.observacoes_padrao || "");
      setIncluirEscalas(template.incluir_escalas || false);
      setCategoria(template.categoria || "Geral");
    } else {
      setNome("");
      setDescricao("");
      setTipoCulto("");
      setTemaPadrao("");
      setLocalPadrao("");
      setDuracaoPadrao(undefined);
      setPregadorPadrao("");
      setObservacoesPadrao("");
      setIncluirEscalas(false);
      setCategoria("Geral");
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
      const templateData = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        tipo_culto: tipoCulto || null,
        tema_padrao: temaPadrao.trim() || null,
        local_padrao: localPadrao.trim() || null,
        duracao_padrao: duracaoPadrao || null,
        pregador_padrao: pregadorPadrao.trim() || null,
        observacoes_padrao: observacoesPadrao.trim() || null,
        incluir_escalas: incluirEscalas,
        categoria: categoria
      };

      if (template) {
        // Atualizar template existente
        const { error } = await supabase
          .from("templates_culto")
          .update(templateData)
          .eq("id", template.id);

        if (error) throw error;
        toast.success("Template atualizado com sucesso");
      } else {
        // Criar novo template vazio
        const { error } = await supabase
          .from("templates_culto")
          .insert(templateData);

        if (error) throw error;
        toast.success("Template criado com sucesso");
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Erro ao salvar template:", error);
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao salvar template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            {template ? "Editar Template" : "Novo Template de Culto"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4">
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
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_TEMPLATE.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipoCulto">Tipo de Culto</Label>
              <Select value={tipoCulto} onValueChange={setTipoCulto}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CULTO.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="space-y-2">
              <Label htmlFor="duracaoPadrao">Duração Padrão (min)</Label>
              <Input
                id="duracaoPadrao"
                type="number"
                value={duracaoPadrao || ""}
                onChange={(e) => setDuracaoPadrao(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="120"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="temaPadrao">Tema Padrão</Label>
            <Input
              id="temaPadrao"
              value={temaPadrao}
              onChange={(e) => setTemaPadrao(e.target.value)}
              placeholder="Ex: O Amor de Deus"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="localPadrao">Local Padrão</Label>
              <Input
                id="localPadrao"
                value={localPadrao}
                onChange={(e) => setLocalPadrao(e.target.value)}
                placeholder="Ex: Templo Principal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pregadorPadrao">Pregador Padrão</Label>
              <Input
                id="pregadorPadrao"
                value={pregadorPadrao}
                onChange={(e) => setPregadorPadrao(e.target.value)}
                placeholder="Ex: Pastor João"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoesPadrao">Observações Padrão</Label>
            <Textarea
              id="observacoesPadrao"
              value={observacoesPadrao}
              onChange={(e) => setObservacoesPadrao(e.target.value)}
              placeholder="Observações que sempre aparecem neste tipo de culto..."
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="incluirEscalas"
              checked={incluirEscalas}
              onCheckedChange={(checked) => setIncluirEscalas(checked as boolean)}
            />
            <Label htmlFor="incluirEscalas" className="text-sm font-normal cursor-pointer">
              Incluir escalas de times ao aplicar template
            </Label>
          </div>

          </div>

          <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2 justify-end">
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
      </div>
    </ResponsiveDialog>
  );
}
