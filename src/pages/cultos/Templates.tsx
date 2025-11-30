import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, FileText, ArrowLeft, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TemplatesLiturgiaDialog } from "@/components/cultos/TemplatesLiturgiaDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CATEGORIAS_FILTER = [
  "Todos",
  "Culto Dominical",
  "Culto Especial",
  "Celebrações",
  "Eventos",
  "Reuniões",
  "Geral"
];

interface Template {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  created_at: string;
  itens_count?: number;
  categoria?: string;
  tipo_culto?: string;
}

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | undefined>();
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [categoriaFilter, setCategoriaFilter] = useState("Todos");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("templates_culto")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar contagem de itens para cada template
      const templatesWithCount = await Promise.all(
        (data || []).map(async (template) => {
          const { count } = await supabase
            .from("itens_template_culto")
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

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      const { error } = await supabase
        .from("templates_culto")
        .delete()
        .eq("id", templateToDelete);

      if (error) throw error;

      toast.success("Template excluído com sucesso");
      loadTemplates();
    } catch (error: any) {
      console.error("Erro ao excluir template:", error);
      toast.error(error.message || "Erro ao excluir template");
    } finally {
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleToggleAtivo = async (template: Template) => {
    try {
      const { error } = await supabase
        .from("templates_culto")
        .update({ ativo: !template.ativo })
        .eq("id", template.id);

      if (error) throw error;

      toast.success(template.ativo ? "Template desativado" : "Template ativado");
      loadTemplates();
    } catch (error: any) {
      console.error("Erro ao atualizar template:", error);
      toast.error("Erro ao atualizar template");
    }
  };

  const handleDuplicate = async (template: Template) => {
    try {
      // Buscar itens do template original
      const { data: itens, error: itensError } = await supabase
        .from("itens_template_culto")
        .select("*")
        .eq("template_id", template.id)
        .order("ordem");

      if (itensError) throw itensError;

      // Criar novo template
      const { data: novoTemplate, error: templateError } = await supabase
        .from("templates_culto")
        .insert({
          nome: `${template.nome} (Cópia)`,
          descricao: template.descricao,
          ativo: true
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Copiar itens se existirem
      if (itens && itens.length > 0) {
        const novosItens = itens.map(item => ({
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
          .insert(novosItens);

        if (itensInsertError) throw itensInsertError;
      }

      toast.success("Template duplicado com sucesso");
      loadTemplates();
    } catch (error: any) {
      console.error("Erro ao duplicar template:", error);
      toast.error("Erro ao duplicar template");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">Carregando templates...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/cultos")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">Templates de Liturgia</h1>
          <p className="text-muted-foreground">
            Crie modelos reutilizáveis para cultos similares
          </p>
        </div>
        <Button onClick={() => { setSelectedTemplate(undefined); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {/* Filtros de Categoria */}
      <Tabs value={categoriaFilter} onValueChange={setCategoriaFilter} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7">
          {CATEGORIAS_FILTER.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="text-xs sm:text-sm">
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              Nenhum template criado ainda
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates
            .filter(template => 
              categoriaFilter === "Todos" || template.categoria === categoriaFilter
            )
            .map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{template.nome}</CardTitle>
                    {template.descricao && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {template.descricao}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant={template.ativo ? "default" : "secondary"}>
                    {template.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {template.categoria && (
                      <Badge variant="outline">{template.categoria}</Badge>
                    )}
                    {template.tipo_culto && (
                      <Badge variant="secondary" className="text-xs">
                        {template.tipo_culto}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 inline mr-1" />
                    {template.itens_count || 0} {template.itens_count === 1 ? "item" : "itens"}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicate(template)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleAtivo(template)}
                    >
                      {template.ativo ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setTemplateToDelete(template.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplatesLiturgiaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={selectedTemplate}
        onSuccess={loadTemplates}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
