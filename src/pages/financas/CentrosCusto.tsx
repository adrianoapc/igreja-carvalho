import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Pencil, Trash2, Search, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface CentroCusto {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  base_ministerial_id: string | null;
}

interface Props {
  onBack?: () => void;
}

export default function CentrosCusto({ onBack }: Props) {
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCentro, setEditingCentro] = useState<CentroCusto | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    ativo: true,
  });

  useEffect(() => {
    fetchCentros();
  }, []);

  const fetchCentros = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("centros_custo")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      setCentros(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar centros de custo", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      if (editingCentro) {
        const { error } = await supabase
          .from("centros_custo")
          .update({
            nome: formData.nome,
            descricao: formData.descricao || null,
            ativo: formData.ativo,
          })
          .eq("id", editingCentro.id);
        
        if (error) throw error;
        toast.success("Centro de custo atualizado");
      } else {
        const { error } = await supabase
          .from("centros_custo")
          .insert({
            nome: formData.nome,
            descricao: formData.descricao || null,
            ativo: formData.ativo,
          });
        
        if (error) throw error;
        toast.success("Centro de custo criado");
      }

      setDialogOpen(false);
      resetForm();
      fetchCentros();
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este centro de custo?")) return;

    try {
      const { error } = await supabase
        .from("centros_custo")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Centro de custo excluído");
      fetchCentros();
    } catch (error: any) {
      toast.error("Erro ao excluir", { description: error.message });
    }
  };

  const openEdit = (centro: CentroCusto) => {
    setEditingCentro(centro);
    setFormData({
      nome: centro.nome,
      descricao: centro.descricao || "",
      ativo: centro.ativo,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCentro(null);
    setFormData({ nome: "", descricao: "", ativo: true });
  };

  const filteredCentros = centros.filter((c) =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Centros de Custo</h1>
            <p className="text-muted-foreground">Gerencie os centros de custo</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Centro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCentro ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Marketing"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição opcional"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="ativo">Ativo</Label>
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingCentro ? "Salvar Alterações" : "Criar Centro"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar centro de custo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Centros de Custo ({filteredCentros.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filteredCentros.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum centro encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCentros.map((centro) => (
                  <TableRow key={centro.id}>
                    <TableCell className="font-medium">{centro.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{centro.descricao || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={centro.ativo ? "default" : "secondary"}>
                        {centro.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(centro)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(centro.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return onBack ? content : <MainLayout>{content}</MainLayout>;
}
