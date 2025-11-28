import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { User, Mail, Phone, Eye, EyeOff, Edit, CheckCircle2, Archive } from "lucide-react";

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

interface TestemunhoDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testemunho: any;
  onSuccess: () => void;
}

export function TestemunhoDetailsDialog({ open, onOpenChange, testemunho, onSuccess }: TestemunhoDetailsDialogProps) {
  const { toast } = useToast();
  const { profile, hasAccess } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pessoaNome, setPessoaNome] = useState<string>("");

  const [formData, setFormData] = useState({
    titulo: testemunho.titulo,
    mensagem: testemunho.mensagem,
    categoria: testemunho.categoria,
    status: testemunho.status,
    publicar: testemunho.publicar,
  });

  const isAdmin = hasAccess("testemunhos", "aprovar_gerenciar");

  useEffect(() => {
    const fetchPessoaNome = async () => {
      if (testemunho.pessoa_id) {
        const { data } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', testemunho.pessoa_id)
          .single();
        if (data) setPessoaNome(data.nome);
      }
    };
    fetchPessoaNome();
  }, [testemunho.pessoa_id]);

  const handleUpdate = async () => {
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

      setIsEditing(false);
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
    setLoading(true);
    try {
      const updateData: any = { status: newStatus as any };
      
      if (newStatus === "publico" && !testemunho.data_publicacao) {
        updateData.data_publicacao = new Date().toISOString();
      }

      const { error } = await supabase
        .from("testemunhos")
        .update(updateData)
        .eq("id", testemunho.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Testemunho ${newStatus === "publico" ? "tornado público" : "arquivado"}`,
      });

      onSuccess();
      onOpenChange(false);
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
    setLoading(true);
    try {
      const { error } = await supabase
        .from("testemunhos")
        .update({ 
          publicar: !formData.publicar,
          data_publicacao: !formData.publicar ? new Date().toISOString() : null
        })
        .eq("id", testemunho.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: formData.publicar ? "Testemunho despublicado" : "Testemunho publicado",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao publicar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar status de publicação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getNomeExibicao = () => {
    if (testemunho.anonimo) return "Anônimo";
    if (pessoaNome) return pessoaNome;
    if (testemunho.nome_externo) return testemunho.nome_externo;
    if (testemunho.profiles?.nome) return testemunho.profiles.nome;
    return "Não identificado";
  };

  const mascarar = (texto: string | null | undefined) => {
    if (!texto) return "";
    if (texto.includes("@")) {
      const [user, domain] = texto.split("@");
      return `${user.substring(0, 2)}***@${domain}`;
    }
    return texto.substring(0, 4) + "***" + texto.substring(texto.length - 2);
  };

  const getCategoriaLabel = (categoria: string) => {
    return CATEGORIAS.find(c => c.value === categoria)?.label || categoria;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Testemunho</DialogTitle>
          <DialogDescription>
            {isEditing ? "Editar informações do testemunho" : "Visualizar informações do testemunho"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{getNomeExibicao()}</span>
                {testemunho.anonimo && (
                  <Badge variant="secondary" className="gap-1">
                    <EyeOff className="w-3 h-3" />
                    Anônimo
                  </Badge>
                )}
              </div>
              {!testemunho.anonimo && (testemunho.email_externo || testemunho.profiles?.email) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-3 h-3" />
                  {testemunho.email_externo || testemunho.profiles?.email}
                </div>
              )}
              {testemunho.anonimo && testemunho.email_externo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-3 h-3" />
                  {mascarar(testemunho.email_externo)}
                </div>
              )}
              {!testemunho.anonimo && (testemunho.telefone_externo || testemunho.profiles?.telefone) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {testemunho.telefone_externo || testemunho.profiles?.telefone}
                </div>
              )}
              {testemunho.anonimo && testemunho.telefone_externo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {mascarar(testemunho.telefone_externo)}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Data: {format(new Date(testemunho.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{getCategoriaLabel(testemunho.categoria)}</Badge>
              {testemunho.publicar ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <Eye className="w-3 h-3 mr-1" />
                  Publicado
                </Badge>
              ) : (
                <Badge variant="secondary">Pendente</Badge>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
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
                <Label htmlFor="mensagem">Mensagem *</Label>
                <Textarea
                  id="mensagem"
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
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
            </div>
          ) : (
            <div className="space-y-4 bg-muted p-4 rounded-lg">
              <h3 className="font-semibold text-lg">{testemunho.titulo}</h3>
              <p className="whitespace-pre-wrap text-sm">{testemunho.mensagem}</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      titulo: testemunho.titulo,
                      mensagem: testemunho.mensagem,
                      categoria: testemunho.categoria,
                      status: testemunho.status,
                      publicar: testemunho.publicar,
                    });
                    setErrors({});
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button onClick={handleUpdate} disabled={loading} className="bg-gradient-primary">
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Fechar
                </Button>
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      disabled={loading}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handlePublicar}
                      disabled={loading}
                      className={formData.publicar ? "text-muted-foreground" : "text-green-600 hover:text-green-700"}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {formData.publicar ? "Despublicar" : "Publicar"}
                    </Button>
                    {testemunho.status !== "publico" && (
                      <Button
                        variant="outline"
                        onClick={() => handleStatusChange("publico")}
                        disabled={loading}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
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
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
