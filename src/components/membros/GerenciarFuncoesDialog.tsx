import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Loader2 } from "lucide-react";

interface Funcao {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface GerenciarFuncoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GerenciarFuncoesDialog({
  open,
  onOpenChange,
}: GerenciarFuncoesDialogProps) {
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    ativo: true,
  });
  const { toast } = useToast();

  const fetchFuncoes = async () => {
    try {
      const { data, error } = await supabase
        .from("funcoes_igreja")
        .select("*")
        .order("nome");

      if (error) throw error;
      setFuncoes(data || []);
    } catch (error) {
      console.error("Erro ao buscar funções:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as funções",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (open) {
      fetchFuncoes();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from("funcoes_igreja")
          .update(formData)
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Função atualizada com sucesso" });
      } else {
        const { error } = await supabase.from("funcoes_igreja").insert(formData);

        if (error) throw error;
        toast({ title: "Função criada com sucesso" });
      }

      setFormData({ nome: "", descricao: "", ativo: true });
      setEditingId(null);
      setShowForm(false);
      fetchFuncoes();
    } catch (error: unknown) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : String(error) || "Não foi possível salvar a função",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (funcao: Funcao) => {
    setFormData({
      nome: funcao.nome,
      descricao: funcao.descricao || "",
      ativo: funcao.ativo,
    });
    setEditingId(funcao.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta função?")) return;

    try {
      const { error } = await supabase.from("funcoes_igreja").delete().eq("id", id);

      if (error) throw error;
      toast({ title: "Função excluída com sucesso" });
      fetchFuncoes();
    } catch (error: unknown) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : String(error) || "Não foi possível excluir a função",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setFormData({ nome: "", descricao: "", ativo: true });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Gerenciar Funções da Igreja</h2>
        </div>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="space-y-4 px-4 py-4 md:px-6 md:py-5">
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Nova Função
            </Button>
          )}

          {showForm && (
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Função *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) =>
                        setFormData({ ...formData, nome: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) =>
                        setFormData({ ...formData, descricao: e.target.value })
                      }
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="ativo"
                      checked={formData.ativo}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, ativo: checked })
                      }
                    />
                    <Label htmlFor="ativo">Função ativa</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {editingId ? "Atualizar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground">
              Funções Cadastradas
            </h3>
            {funcoes.map((funcao) => (
              <Card key={funcao.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{funcao.nome}</h4>
                        <Badge variant={funcao.ativo ? "default" : "secondary"}>
                          {funcao.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                      {funcao.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {funcao.descricao}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(funcao)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(funcao.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        </ScrollArea>
      </div>
    </ResponsiveDialog>
  );
}
