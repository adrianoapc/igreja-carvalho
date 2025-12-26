import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
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
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate('/financas'));
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={handleBack} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Centros de Custo</h1>
            <p className="text-muted-foreground text-sm">Gerencie os centros de custo</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar centro de custo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-base h-10"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="text-xs">
          <Plus className="h-4 w-4 mr-2" />
          Novo Centro
        </Button>
      </div>

      {/* Table - Desktop */}
      <Card className="hidden md:block">
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

      {/* Cards - Mobile */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : filteredCentros.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Nenhum centro encontrado</p>
            </CardContent>
          </Card>
        ) : (
          filteredCentros.map((centro) => (
            <Card key={centro.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{centro.nome}</h3>
                    {centro.descricao && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{centro.descricao}</p>
                    )}
                  </div>
                  <Badge variant={centro.ativo ? "default" : "secondary"} className="flex-shrink-0">
                    {centro.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openEdit(centro)}
                    className="flex-1"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDelete(centro.id)}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog de Criação/Edição */}
      <ResponsiveDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
        title={editingCentro ? "Editar Centro de Custo" : "Novo Centro de Custo"}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Marketing"
              className="text-base h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição opcional"
              className="text-base h-10"
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
      </ResponsiveDialog>
    </div>
  );

  return content;
}
