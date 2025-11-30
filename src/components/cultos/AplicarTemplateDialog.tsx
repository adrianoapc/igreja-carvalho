import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

interface Template {
  id: string;
  nome: string;
  descricao?: string;
  itens_count?: number;
}

interface AplicarTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cultoId: string;
  onSuccess?: () => void;
}

export function AplicarTemplateDialog({
  open,
  onOpenChange,
  cultoId,
  onSuccess
}: AplicarTemplateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("templates_liturgia")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;

      // Buscar contagem de itens para cada template
      const templatesWithCount = await Promise.all(
        (data || []).map(async (template) => {
          const { count } = await supabase
            .from("itens_template_liturgia")
            .select("*", { count: "exact", head: true })
            .eq("template_id", template.id);

          return { ...template, itens_count: count || 0 };
        })
      );

      setTemplates(templatesWithCount);
    } catch (error: any) {
      console.error("Erro ao carregar templates:", error);
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  const handleAplicar = async (templateId: string) => {
    setApplying(templateId);

    try {
      // Buscar itens do template
      const { data: itensTemplate, error: itensError } = await supabase
        .from("itens_template_liturgia")
        .select("*")
        .eq("template_id", templateId)
        .order("ordem");

      if (itensError) throw itensError;

      if (!itensTemplate || itensTemplate.length === 0) {
        toast.error("Template não possui itens");
        return;
      }

      // Buscar ordem máxima atual
      const { data: itensExistentes } = await supabase
        .from("liturgia_culto")
        .select("ordem")
        .eq("culto_id", cultoId)
        .order("ordem", { ascending: false })
        .limit(1);

      const ordemInicial = itensExistentes && itensExistentes.length > 0 
        ? itensExistentes[0].ordem + 1 
        : 1;

      // Criar itens de liturgia baseados no template
      const novosItens = itensTemplate.map((item, index) => ({
        culto_id: cultoId,
        ordem: ordemInicial + index,
        tipo: item.tipo,
        titulo: item.titulo,
        descricao: item.descricao,
        duracao_minutos: item.duracao_minutos,
        responsavel_externo: item.responsavel_externo,
        midias_ids: item.midias_ids
      }));

      const { error: insertError } = await supabase
        .from("liturgia_culto")
        .insert(novosItens);

      if (insertError) throw insertError;

      toast.success("Template aplicado com sucesso");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao aplicar template:", error);
      toast.error(error.message || "Erro ao aplicar template");
    } finally {
      setApplying(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aplicar Template de Liturgia</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Nenhum template disponível
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {templates.map((template) => (
                <Card key={template.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{template.nome}</h3>
                        {template.descricao && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {template.descricao}
                          </p>
                        )}
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            {template.itens_count || 0} {template.itens_count === 1 ? "item" : "itens"}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleAplicar(template.id)}
                        disabled={applying !== null || (template.itens_count || 0) === 0}
                        size="sm"
                      >
                        {applying === template.id && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Aplicar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
