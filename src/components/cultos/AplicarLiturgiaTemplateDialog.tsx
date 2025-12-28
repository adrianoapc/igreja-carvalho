import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface Template {
  id: string;
  nome: string;
  descricao: string | null;
  estrutura_json: Json | null;
  created_at: string | null;
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

interface AplicarLiturgiaTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cultoId: string;
  onSuccess?: () => void;
}

export function AplicarLiturgiaTemplateDialog({
  open,
  onOpenChange,
  cultoId,
  onSuccess
}: AplicarLiturgiaTemplateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Template | null>(null);
  const [clearConfirm, setClearConfirm] = useState<Template | null>(null);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("liturgia_templates")
        .select("*")
        .order("nome");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: unknown) {
      console.error("Erro ao carregar templates:", error);
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  const getItensCount = (template: Template): number => {
    if (!template.estrutura_json) return 0;
    const estrutura = template.estrutura_json as unknown as LiturgiaItemTemplate[];
    return Array.isArray(estrutura) ? estrutura.length : 0;
  };

  const handleApplyTemplate = async (template: Template, clearExisting: boolean) => {
    setApplying(template.id);
    setClearConfirm(null);

    try {
      if (!template.estrutura_json) {
        toast.error("Template não possui itens");
        return;
      }

      const itensTemplate = template.estrutura_json as unknown as LiturgiaItemTemplate[];

      if (!Array.isArray(itensTemplate) || itensTemplate.length === 0) {
        toast.error("Template não possui itens válidos");
        return;
      }

      // Se for limpar, deletar itens existentes primeiro
      if (clearExisting) {
        // Buscar itens existentes para deletar recursos
        const { data: itensExistentes } = await supabase
          .from("liturgias")
          .select("id")
          .eq("evento_id", cultoId);

        if (itensExistentes && itensExistentes.length > 0) {
          // Deletar recursos associados
          const idsExistentes = itensExistentes.map(i => i.id);
          await supabase
            .from("liturgia_recursos")
            .delete()
            .in("liturgia_item_id", idsExistentes);

          // Deletar itens
          await supabase
            .from("liturgias")
            .delete()
            .eq("evento_id", cultoId);
        }
      }

      // Buscar ordem máxima atual (se não limpou)
      let ordemInicial = 1;
      if (!clearExisting) {
        const { data: itensExistentes } = await supabase
          .from("liturgias")
          .select("ordem")
          .eq("evento_id", cultoId)
          .order("ordem", { ascending: false })
          .limit(1);

        if (itensExistentes && itensExistentes.length > 0) {
          ordemInicial = itensExistentes[0].ordem + 1;
        }
      }

      // Criar novos itens baseados no template
      const novosItens = itensTemplate.map((item, index) => ({
        evento_id: cultoId,
        titulo: item.titulo,
        tipo: item.tipo,
        ordem: ordemInicial + index,
        duracao_minutos: item.duracao_minutos,
        descricao: item.descricao,
        responsavel_id: item.responsavel_id,
        responsavel_externo: item.responsavel_externo
      }));

      const { error: insertError } = await supabase
        .from("liturgias")
        .insert(novosItens);

      if (insertError) throw insertError;

      toast.success("Template aplicado com sucesso!", {
        description: `${novosItens.length} itens ${clearExisting ? 'substituídos' : 'adicionados'}`
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Erro ao aplicar template:", error);
      toast.error("Erro ao aplicar template", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setApplying(null);
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    try {
      const { error } = await supabase
        .from("liturgia_templates")
        .delete()
        .eq("id", template.id);

      if (error) throw error;

      toast.success("Template excluído");
      setDeleteConfirm(null);
      loadTemplates();
    } catch (error: unknown) {
      console.error("Erro ao excluir template:", error);
      toast.error("Erro ao excluir template", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleSelectTemplate = (template: Template) => {
    // Verificar se já existem itens no culto
    supabase
      .from("liturgias")
      .select("id", { count: "exact", head: true })
      .eq("evento_id", cultoId)
      .then(({ count }) => {
        if (count && count > 0) {
          // Já tem itens - perguntar se quer limpar ou adicionar
          setClearConfirm(template);
        } else {
          // Sem itens - aplicar direto
          handleApplyTemplate(template, false);
        }
      });
  };

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <div className="flex flex-col h-full">
          <div className="border-b pb-4 px-6 pt-6"><h2 className="text-lg font-semibold">
            Aplicar Template de Liturgia</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
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
              <p className="text-sm text-muted-foreground mt-1">
                Salve a liturgia de um culto como template para reutilizar
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {templates.map((template) => {
                  const itensCount = getItensCount(template);
                  return (
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
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                <FileText className="w-3 h-3 mr-1" />
                                {itensCount} {itensCount === 1 ? "item" : "itens"}
                              </Badge>
                              {template.created_at && (
                                <span className="text-xs text-muted-foreground">
                                  Criado em {new Date(template.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirm(template)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleSelectTemplate(template)}
                              disabled={applying !== null || itensCount === 0}
                              size="sm"
                            >
                              {applying === template.id && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Aplicar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          </div>
          <div className="border-t pt-4 px-6 pb-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template "{deleteConfirm?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteTemplate(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação: Limpar ou Adicionar */}
      <AlertDialog open={!!clearConfirm} onOpenChange={() => setClearConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Já existem itens neste culto
            </AlertDialogTitle>
            <AlertDialogDescription>
              Como deseja aplicar o template "{clearConfirm?.nome}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => clearConfirm && handleApplyTemplate(clearConfirm, false)}
            >
              Adicionar ao final
            </Button>
            <AlertDialogAction
              onClick={() => clearConfirm && handleApplyTemplate(clearConfirm, true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar e aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
