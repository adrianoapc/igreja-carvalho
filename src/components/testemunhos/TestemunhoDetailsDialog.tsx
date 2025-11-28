import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Heart, Clock, User, CheckCircle2, Archive, Eye } from "lucide-react";
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

interface Testemunho {
  id: string;
  titulo: string;
  mensagem: string;
  categoria: string;
  status: string;
  publicar: boolean;
  data_publicacao: string | null;
  created_at: string;
  autor_id: string;
  profiles: {
    nome: string;
  };
}

interface TestemunhoDetailsDialogProps {
  testemunho: Testemunho | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TestemunhoDetailsDialog({ 
  testemunho, 
  open, 
  onOpenChange, 
  onSuccess 
}: TestemunhoDetailsDialogProps) {
  const { toast } = useToast();
  const { profile, hasAccess } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const isAdmin = hasAccess("testemunhos", "aprovar_gerenciar");
  const isAuthor = profile?.id === testemunho?.autor_id;
  const canEdit = isAdmin || (isAuthor && testemunho?.status === "aberto");

  const [formData, setFormData] = useState({
    titulo: "",
    mensagem: "",
    categoria: "",
  });

  useEffect(() => {
    if (testemunho) {
      setFormData({
        titulo: testemunho.titulo,
        mensagem: testemunho.mensagem,
        categoria: testemunho.categoria,
      });
      setEditing(false);
      setErrors({});
    }
  }, [testemunho]);

  const getCategoriaLabel = (categoria: string) => {
    return CATEGORIAS.find(c => c.value === categoria)?.label || categoria;
  };

  const handleUpdate = async () => {
    if (!testemunho) return;

    setErrors({});
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

    setLoading(true);
    try {
      const { error } = await supabase
        .from("testemunhos")
        .update({
          titulo: result.data.titulo,
          mensagem: result.data.mensagem,
          categoria: result.data.categoria as any,
        })
        .eq("id", testemunho.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Testemunho atualizado com sucesso",
      });

      setEditing(false);
      onSuccess();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o testemunho",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!testemunho) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("testemunhos")
        .update({ status: newStatus as any })
        .eq("id", testemunho.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Testemunho ${newStatus === "publico" ? "tornado público" : "arquivado"}`,
      });

      onSuccess();
    } catch (error) {
      console.error("Erro ao mudar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePublicar = async () => {
    if (!testemunho) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("testemunhos")
        .update({ 
          publicar: true,
          data_publicacao: new Date().toISOString()
        })
        .eq("id", testemunho.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Testemunho publicado com sucesso",
      });

      onSuccess();
    } catch (error) {
      console.error("Erro ao publicar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível publicar o testemunho",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!testemunho) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-accent" />
            Detalhes do Testemunho
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do Autor */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{testemunho.profiles.nome}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{new Date(testemunho.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {getCategoriaLabel(testemunho.categoria)}
            </Badge>
            {testemunho.publicar ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                Publicado
              </Badge>
            ) : (
              <Badge className="bg-accent/20 text-accent-foreground">
                Pendente
              </Badge>
            )}
          </div>

          <Separator />

          {editing ? (
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-titulo">Título *</Label>
                <Input
                  id="edit-titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  maxLength={200}
                />
                {errors.titulo && (
                  <p className="text-sm text-destructive">{errors.titulo}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-categoria">Categoria *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                >
                  <SelectTrigger id="edit-categoria">
                    <SelectValue />
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
                <Label htmlFor="edit-mensagem">Mensagem *</Label>
                <Textarea
                  id="edit-mensagem"
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                  rows={8}
                  maxLength={5000}
                  className="resize-none"
                />
                {errors.mensagem && (
                  <p className="text-sm text-destructive">{errors.mensagem}</p>
                )}
                <p className="text-xs text-muted-foreground text-right">
                  {formData.mensagem.length}/5000
                </p>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">{testemunho.titulo}</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{testemunho.mensagem}</p>
              </div>
            </div>
          )}

          {/* Ações */}
          <Separator />
          
          <div className="flex flex-col sm:flex-row gap-2">
            {canEdit && !editing && (
              <Button
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={loading}
              >
                Editar
              </Button>
            )}

            {editing && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      titulo: testemunho.titulo,
                      mensagem: testemunho.mensagem,
                      categoria: testemunho.categoria,
                    });
                    setErrors({});
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={loading}
                  className="bg-gradient-primary"
                >
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </>
            )}

            {!editing && isAdmin && (
              <>
                {!testemunho.publicar && (
                  <Button
                    variant="outline"
                    onClick={handlePublicar}
                    disabled={loading}
                    className="text-green-600 hover:text-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Publicar
                  </Button>
                )}

                {testemunho.status === "aberto" && (
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange("publico")}
                    disabled={loading}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Tornar Público
                  </Button>
                )}

                {testemunho.status !== "arquivado" && (
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange("arquivado")}
                    disabled={loading}
                    className="text-muted-foreground"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Arquivar
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
