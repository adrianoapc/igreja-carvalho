import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Pencil, Trash2, Search, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

interface FormaPagamento {
  id: string;
  nome: string;
  ativo: boolean;
}

interface Props {
  onBack?: () => void;
}

export default function FormasPagamento({ onBack }: Props) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate('/financas'));
  const queryClient = useQueryClient();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingForma, setEditingForma] = useState<FormaPagamento | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    ativo: true,
  });

  // Query formas
  const { data: formas = [], isLoading, error: formasError } = useQuery({
    queryKey: ['formas-pagamento', igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from('formas_pagamento')
        .select('*')
        .eq('igreja_id', igrejaId)
        .order('nome');
      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as FormaPagamento[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Show error toast if query fails
  if (formasError) {
    toast.error("Erro ao carregar formas de pagamento", { description: (formasError as Error).message });
  }

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      const { error } = await supabase
        .from('formas_pagamento')
        .insert({ nome: data.nome, ativo: data.ativo, igreja_id: igrejaId, filial_id: !isAllFiliais ? filialId : null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Forma de pagamento criada");
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error("Erro ao criar", { description: error instanceof Error ? error.message : String(error) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      let updateQuery = supabase
        .from('formas_pagamento')
        .update({ nome: data.nome, ativo: data.ativo })
        .eq('id', id)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        updateQuery = updateQuery.eq('filial_id', filialId);
      }
      const { error } = await updateQuery;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Forma de pagamento atualizada");
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error("Erro ao atualizar", { description: error instanceof Error ? error.message : String(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      let deleteQuery = supabase
        .from('formas_pagamento')
        .delete()
        .eq('id', id)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        deleteQuery = deleteQuery.eq('filial_id', filialId);
      }
      const { error } = await deleteQuery;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Forma de pagamento excluída");
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
    },
    onError: (error: unknown) => {
      toast.error("Erro ao excluir", { description: error instanceof Error ? error.message : String(error) });
    },
  });

  const handleSubmit = () => {
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (editingForma) {
      updateMutation.mutate({ id: editingForma.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Deseja excluir esta forma de pagamento?")) return;
    deleteMutation.mutate(id);
  };

  const openEdit = (forma: FormaPagamento) => {
    setEditingForma(forma);
    setFormData({
      nome: forma.nome,
      ativo: forma.ativo,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingForma(null);
    setFormData({ nome: "", ativo: true });
  };

  const filteredFormas = formas.filter((f) =>
    f.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const content = (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={handleBack} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Formas de Pagamento</h1>
            <p className="text-muted-foreground text-sm">Gerencie as formas de pagamento</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar forma de pagamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-base h-10"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="text-xs">
          <Plus className="h-4 w-4 mr-2" />
          Nova Forma
        </Button>
      </div>

      {/* Table - Desktop */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Formas de Pagamento ({filteredFormas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filteredFormas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma forma encontrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFormas.map((forma) => (
                  <TableRow key={forma.id}>
                    <TableCell className="font-medium">{forma.nome}</TableCell>
                    <TableCell>
                      <Badge variant={forma.ativo ? "default" : "secondary"}>
                        {forma.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(forma)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(forma.id)}>
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
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : filteredFormas.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Nenhuma forma encontrada</p>
            </CardContent>
          </Card>
        ) : (
          filteredFormas.map((forma) => (
            <Card key={forma.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <CreditCard className="h-5 w-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold text-base truncate">{forma.nome}</h3>
                  </div>
                  <Badge variant={forma.ativo ? "default" : "secondary"} className="flex-shrink-0">
                    {forma.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openEdit(forma)}
                    className="flex-1"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDelete(forma.id)}
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
        title={editingForma ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: PIX, Cartão de Crédito"
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
          <Button 
            onClick={handleSubmit} 
            className="w-full"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {editingForma ? "Salvar Alterações" : "Criar Forma"}
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );

  return content;
}
