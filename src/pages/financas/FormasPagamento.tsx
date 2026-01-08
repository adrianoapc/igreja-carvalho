import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface FormaPagamento {
  id: string;
  nome: string;
  ativo: boolean;
  taxa_administrativa?: number | null;
  taxa_administrativa_fixa?: number | null;
  gera_pago?: boolean;
}

interface Props {
  onBack?: () => void;
}

export default function FormasPagamento({ onBack }: Props) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate("/financas"));
  const queryClient = useQueryClient();
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();

  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingForma, setEditingForma] = useState<FormaPagamento | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    ativo: true,
    taxa_administrativa: 0 as number | null,
    taxa_administrativa_fixa: null as number | null,
    gera_pago: false,
  });

  // Estado para mapeamentos forma → conta
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [selectedFormaId, setSelectedFormaId] = useState<string>("");
  const [selectedContaId, setSelectedContaId] = useState<string>("");

  // Query formas
  const {
    data: formas = [],
    isLoading,
    error: formasError,
  } = useQuery({
    queryKey: ["formas-pagamento", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("formas_pagamento")
        .select("*")
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as FormaPagamento[];
    },
    enabled: !loading && !!igrejaId,
  });

  // Contas para mapeamento
  const { data: contas = [] } = useQuery({
    queryKey: ["contas-config", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
    enabled: !loading && !!igrejaId,
  });

  // Mapeamentos forma → conta
  type FormaContaMapa = {
    id: string;
    forma_pagamento_id: string;
    conta_id: string;
    prioridade: number | null;
    contas: { id: string; nome: string };
    formas_pagamento: {
      id: string;
      nome: string;
      taxa_administrativa: number | null;
      taxa_administrativa_fixa: number | null;
      gera_pago: boolean;
    };
  };
  const { data: mapeamentos = [] } = useQuery({
    queryKey: ["forma-conta-mapa-config", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("forma_pagamento_contas")
        .select(`
          id, forma_pagamento_id, conta_id, prioridade,
          contas(id, nome),
          formas_pagamento(id, nome, taxa_administrativa, taxa_administrativa_fixa, gera_pago)
        `)
        .eq("igreja_id", igrejaId)
        .order("prioridade", { ascending: true });
      if (!isAllFiliais && filialId) {
        query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      } else {
        query = query.is("filial_id", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FormaContaMapa[];
    },
    enabled: !loading && !!igrejaId,
  });

  // Show error toast if query fails
  if (formasError) {
    toast.error("Erro ao carregar formas de pagamento", {
      description: (formasError as Error).message,
    });
  }

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      const { error } = await supabase
        .from("formas_pagamento")
        .insert({
          nome: data.nome,
          ativo: data.ativo,
          taxa_administrativa: data.taxa_administrativa ?? 0,
          taxa_administrativa_fixa: data.taxa_administrativa_fixa,
          gera_pago: data.gera_pago ?? false,
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Forma de pagamento criada");
      queryClient.invalidateQueries({ queryKey: ["formas-pagamento"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error("Erro ao criar", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      let updateQuery = supabase
        .from("formas_pagamento")
        .update({
          nome: data.nome,
          ativo: data.ativo,
          taxa_administrativa: data.taxa_administrativa ?? 0,
          taxa_administrativa_fixa: data.taxa_administrativa_fixa,
          gera_pago: data.gera_pago ?? false,
        })
        .eq("id", id)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        updateQuery = updateQuery.eq("filial_id", filialId);
      }
      const { error } = await updateQuery;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Forma de pagamento atualizada");
      queryClient.invalidateQueries({ queryKey: ["formas-pagamento"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error("Erro ao atualizar", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      let deleteQuery = supabase
        .from("formas_pagamento")
        .delete()
        .eq("id", id)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        deleteQuery = deleteQuery.eq("filial_id", filialId);
      }
      const { error } = await deleteQuery;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Forma de pagamento excluída");
      queryClient.invalidateQueries({ queryKey: ["formas-pagamento"] });
    },
    onError: (error: unknown) => {
      toast.error("Erro ao excluir", {
        description: error instanceof Error ? error.message : String(error),
      });
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
      taxa_administrativa: forma.taxa_administrativa ?? 0,
      taxa_administrativa_fixa: forma.taxa_administrativa_fixa ?? null,
      gera_pago: !!forma.gera_pago,
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

  const handleAddMapeamento = async () => {
    if (!selectedFormaId || !selectedContaId || !igrejaId) return;
    const { error } = await supabase
      .from("forma_pagamento_contas")
      .insert({
        forma_pagamento_id: selectedFormaId,
        conta_id: selectedContaId,
        igreja_id: igrejaId,
        filial_id: !isAllFiliais ? filialId : null,
        prioridade: 1,
      });
    if (error) {
      if (String(error.message).includes("duplicate key")) {
        toast.error("Esta forma já está mapeada para esta conta.");
      } else {
        toast.error("Erro ao criar mapeamento", { description: error.message });
      }
      return;
    }
    toast.success("Mapeamento criado!");
    queryClient.invalidateQueries({ queryKey: ["forma-conta-mapa-config"] });
    setMapDialogOpen(false);
    setSelectedFormaId("");
    setSelectedContaId("");
  };

  const handleDeleteMapeamento = async (id: string) => {
    if (!igrejaId) return;
    const { error } = await supabase
      .from("forma_pagamento_contas")
      .delete()
      .eq("id", id)
      .eq("igreja_id", igrejaId);
    if (error) {
      toast.error("Erro ao remover mapeamento", { description: error.message });
      return;
    }
    toast.success("Mapeamento removido!");
    queryClient.invalidateQueries({ queryKey: ["forma-conta-mapa-config"] });
  };

  const content = (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              Formas de Pagamento
            </h1>
            <p className="text-muted-foreground text-sm">
              Gerencie as formas de pagamento
            </p>
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
        <Button
          onClick={() => setDialogOpen(true)}
          size="sm"
          className="text-xs"
        >
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
            <p className="text-center text-muted-foreground py-8">
              Carregando...
            </p>
          ) : filteredFormas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma forma encontrada
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Taxa (%)</TableHead>
                  <TableHead>Taxa Fixa (R$)</TableHead>
                  <TableHead>Gera Pago?</TableHead>
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
                    <TableCell>{(forma.taxa_administrativa ?? 0).toFixed(2)} %</TableCell>
                    <TableCell>
                      {forma.taxa_administrativa_fixa != null
                        ? `R$ ${Number(forma.taxa_administrativa_fixa).toFixed(2)}`
                        : "-"}
                    </TableCell>
                    <TableCell>{forma.gera_pago ? "✅ Sim" : "⏳ Não"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(forma)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(forma.id)}
                        >
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
          <p className="text-center text-muted-foreground py-8">
            Carregando...
          </p>
        ) : filteredFormas.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                Nenhuma forma encontrada
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredFormas.map((forma) => (
            <Card key={forma.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <CreditCard className="h-5 w-5 text-primary flex-shrink-0" />
                    <h3 className="font-semibold text-base truncate">
                      {forma.nome}
                    </h3>
                  </div>
                  <Badge
                    variant={forma.ativo ? "default" : "secondary"}
                    className="flex-shrink-0"
                  >
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
        title={
          editingForma ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
              placeholder="Ex: PIX, Cartão de Crédito"
              className="text-base h-10"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="ativo">Ativo</Label>
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, ativo: checked })
              }
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxa">Taxa Administrativa (%)</Label>
              <Input
                id="taxa"
                type="number"
                step="0.01"
                min="0"
                value={formData.taxa_administrativa ?? 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    taxa_administrativa: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxa-fixa">Taxa Fixa (R$)</Label>
              <Input
                id="taxa-fixa"
                type="number"
                step="0.01"
                min="0"
                value={formData.taxa_administrativa_fixa ?? 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    taxa_administrativa_fixa: e.target.value === "" ? null : parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="gera-pago">Gera como Pago?</Label>
              <Switch
                id="gera-pago"
                checked={!!formData.gera_pago}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, gera_pago: checked })
                }
              />
            </div>
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

      {/* Seção: Mapeamento Forma → Conta */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Mapeamento: Forma → Conta
          </CardTitle>
          <Button size="sm" onClick={() => setMapDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Mapeamento
          </Button>
        </CardHeader>
        <CardContent>
          {mapeamentos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum mapeamento configurado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Forma</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mapeamentos.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.formas_pagamento.nome}</TableCell>
                    <TableCell>{m.contas.nome}</TableCell>
                    <TableCell>
                      {(m.formas_pagamento.taxa_administrativa ?? 0) > 0 && (
                        <>
                          {m.formas_pagamento.taxa_administrativa}%
                          {m.formas_pagamento.taxa_administrativa_fixa ? " + " : ""}
                        </>
                      )}
                      {m.formas_pagamento.taxa_administrativa_fixa != null ? (
                        <>R$ {Number(m.formas_pagamento.taxa_administrativa_fixa).toFixed(2)}</>
                      ) : (
                        (m.formas_pagamento.taxa_administrativa ?? 0) === 0 && "-"
                      )}
                    </TableCell>
                    <TableCell>{m.formas_pagamento.gera_pago ? "✅ Pago" : "⏳ Pendente"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteMapeamento(m.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Novo Mapeamento */}
      <ResponsiveDialog
        open={mapDialogOpen}
        onOpenChange={setMapDialogOpen}
        title="Novo Mapeamento"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="select-forma">Forma de Pagamento</Label>
            <Select
              value={selectedFormaId}
              onValueChange={setSelectedFormaId}
            >
              <SelectTrigger id="select-forma">
                <SelectValue placeholder="Selecione uma forma..." />
              </SelectTrigger>
              <SelectContent>
                {formas.map((forma) => (
                  <SelectItem key={forma.id} value={forma.id}>
                    {forma.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="select-conta">Conta Financeira</Label>
            <Select value={selectedContaId} onValueChange={setSelectedContaId}>
              <SelectTrigger id="select-conta">
                <SelectValue placeholder="Selecione uma conta..." />
              </SelectTrigger>
              <SelectContent>
                {contas.map((conta) => (
                  <SelectItem key={conta.id} value={conta.id}>
                    {conta.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddMapeamento} disabled={!selectedFormaId || !selectedContaId}>
            Criar Mapeamento
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );

  return content;
}
