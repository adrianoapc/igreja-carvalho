import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Intercessor {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  max_pedidos: number;
  pedidos_ativos?: number;
}

export function IntercessoresManager() {
  const [intercessores, setIntercessores] = React.useState<Intercessor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    nome: "",
    email: "",
    telefone: "",
    max_pedidos: 10
  });
  const { toast } = useToast();

  const fetchIntercessores = async () => {
    try {
      const { data, error } = await supabase
        .from("intercessores")
        .select(`
          *,
          pedidos_oracao!intercessor_id(count)
        `)
        .order("nome");

      if (error) throw error;

      const intercessoresComContagem = data?.map(i => ({
        ...i,
        pedidos_ativos: i.pedidos_oracao?.[0]?.count || 0
      })) || [];

      setIntercessores(intercessoresComContagem);
    } catch (error) {
      console.error("Erro ao buscar intercessores:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os intercessores",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchIntercessores();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        const { error } = await supabase
          .from("intercessores")
          .update(formData)
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Intercessor atualizado com sucesso"
        });
      } else {
        const { error } = await supabase
          .from("intercessores")
          .insert([formData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Intercessor criado com sucesso"
        });
      }

      setFormData({ nome: "", email: "", telefone: "", max_pedidos: 10 });
      setEditingId(null);
      setDialogOpen(false);
      fetchIntercessores();
    } catch (error) {
      console.error("Erro ao salvar intercessor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o intercessor",
        variant: "destructive"
      });
    }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from("intercessores")
        .update({ ativo: !ativo })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Intercessor ${!ativo ? "ativado" : "desativado"} com sucesso`
      });

      fetchIntercessores();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este intercessor?")) return;

    try {
      const { error } = await supabase
        .from("intercessores")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Intercessor excluído com sucesso"
      });

      fetchIntercessores();
    } catch (error) {
      console.error("Erro ao excluir intercessor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o intercessor",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (intercessor: Intercessor) => {
    setEditingId(intercessor.id);
    setFormData({
      nome: intercessor.nome,
      email: intercessor.email || "",
      telefone: intercessor.telefone || "",
      max_pedidos: intercessor.max_pedidos
    });
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando intercessores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Intercessores</h2>
          <p className="text-muted-foreground">Cadastre e gerencie os intercessores da igreja</p>
        </div>
        <Button onClick={() => {
          setEditingId(null);
          setFormData({ nome: "", email: "", telefone: "", max_pedidos: 10 });
          setDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Intercessor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Intercessores Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Pedidos Ativos</TableHead>
                <TableHead>Max. Pedidos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {intercessores.map((intercessor) => (
                <TableRow key={intercessor.id}>
                  <TableCell className="font-medium">{intercessor.nome}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {intercessor.email && <div>{intercessor.email}</div>}
                      {intercessor.telefone && <div>{intercessor.telefone}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={intercessor.pedidos_ativos >= intercessor.max_pedidos ? "destructive" : "default"}>
                      {intercessor.pedidos_ativos}
                    </Badge>
                  </TableCell>
                  <TableCell>{intercessor.max_pedidos}</TableCell>
                  <TableCell>
                    <Switch
                      checked={intercessor.ativo}
                      onCheckedChange={() => handleToggleAtivo(intercessor.id, intercessor.ativo)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(intercessor)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(intercessor.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Intercessor" : "Novo Intercessor"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_pedidos">Máximo de Pedidos Simultâneos</Label>
              <Input
                id="max_pedidos"
                type="number"
                min="1"
                value={formData.max_pedidos}
                onChange={(e) => setFormData({ ...formData, max_pedidos: parseInt(e.target.value) })}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingId ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
