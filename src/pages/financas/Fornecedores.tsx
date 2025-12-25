import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Fornecedor {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  tipo_pessoa: string;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  observacoes: string | null;
}

interface Props {
  onBack?: () => void;
}

export default function Fornecedores({ onBack }: Props) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    cpf_cnpj: "",
    tipo_pessoa: "juridica",
    telefone: "",
    email: "",
    ativo: true,
  });

  useEffect(() => {
    fetchFornecedores();
  }, []);

  const fetchFornecedores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      setFornecedores(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar fornecedores", { description: error.message });
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
      if (editingFornecedor) {
        const { error } = await supabase
          .from("fornecedores")
          .update({
            nome: formData.nome,
            cpf_cnpj: formData.cpf_cnpj || null,
            tipo_pessoa: formData.tipo_pessoa,
            telefone: formData.telefone || null,
            email: formData.email || null,
            ativo: formData.ativo,
          })
          .eq("id", editingFornecedor.id);
        
        if (error) throw error;
        toast.success("Fornecedor atualizado");
      } else {
        const { error } = await supabase
          .from("fornecedores")
          .insert({
            nome: formData.nome,
            cpf_cnpj: formData.cpf_cnpj || null,
            tipo_pessoa: formData.tipo_pessoa,
            telefone: formData.telefone || null,
            email: formData.email || null,
            ativo: formData.ativo,
          });
        
        if (error) throw error;
        toast.success("Fornecedor criado");
      }

      setDialogOpen(false);
      resetForm();
      fetchFornecedores();
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este fornecedor?")) return;

    try {
      const { error } = await supabase
        .from("fornecedores")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Fornecedor excluído");
      fetchFornecedores();
    } catch (error: any) {
      toast.error("Erro ao excluir", { description: error.message });
    }
  };

  const openEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setFormData({
      nome: fornecedor.nome,
      cpf_cnpj: fornecedor.cpf_cnpj || "",
      tipo_pessoa: fornecedor.tipo_pessoa,
      telefone: fornecedor.telefone || "",
      email: fornecedor.email || "",
      ativo: fornecedor.ativo,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingFornecedor(null);
    setFormData({
      nome: "",
      cpf_cnpj: "",
      tipo_pessoa: "juridica",
      telefone: "",
      email: "",
      ativo: true,
    });
  };

  const filteredFornecedores = fornecedores.filter((f) =>
    f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.cpf_cnpj?.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
            <p className="text-muted-foreground">Gerencie os fornecedores</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tipo_pessoa">Tipo</Label>
                  <Select value={formData.tipo_pessoa} onValueChange={(v) => setFormData({ ...formData, tipo_pessoa: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fisica">Pessoa Física</SelectItem>
                      <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf_cnpj">{formData.tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ'}</Label>
                  <Input
                    id="cpf_cnpj"
                    value={formData.cpf_cnpj}
                    onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                    placeholder={formData.tipo_pessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
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
                {editingFornecedor ? "Salvar Alterações" : "Criar Fornecedor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar fornecedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Fornecedores ({filteredFornecedores.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filteredFornecedores.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum fornecedor encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFornecedores.map((fornecedor) => (
                  <TableRow key={fornecedor.id}>
                    <TableCell className="font-medium">{fornecedor.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{fornecedor.cpf_cnpj || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{fornecedor.telefone || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{fornecedor.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={fornecedor.ativo ? "default" : "secondary"}>
                        {fornecedor.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(fornecedor)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(fornecedor.id)}>
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
