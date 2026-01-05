import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Search, Building2, AlertTriangle, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

interface Conta {
  id: string;
  nome: string;
  tipo: string;
  banco: string | null;
  agencia: string | null;
  conta_numero: string | null;
  saldo_inicial: number;
  ativo: boolean;
  observacoes: string | null;
}

interface Props {
  onBack?: () => void;
}

export default function ContasManutencao({ onBack }: Props) {
  const queryClient = useQueryClient();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<Conta | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "corrente",
    banco: "",
    agencia: "",
    conta_numero: "",
    saldo_inicial: 0,
    ativo: true,
    observacoes: "",
  });

  // Query contas
  const { data: contas = [], isLoading, error: contasError } = useQuery({
    queryKey: ['contas-manutencao', igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from('contas')
        .select('*')
        .eq('igreja_id', igrejaId)
        .order('nome');
      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Conta[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Query transações por conta
  const { data: transacoesPorConta = {}, error: transacoesError } = useQuery({
    queryKey: ['transacoes-por-conta', igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return {};
      let query = supabase
        .from('transacoes_financeiras')
        .select('conta_id')
        .not('conta_id', 'is', null)
        .eq('status', 'pago')
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId);
      }
      const { data, error } = await query;
      
      if (error) throw error;
      
      const contagem: Record<string, number> = {};
      data?.forEach(t => {
        if (t.conta_id) {
          contagem[t.conta_id] = (contagem[t.conta_id] || 0) + 1;
        }
      });
      return contagem;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Show error toast if query fails
  if (contasError) {
    toast.error("Erro ao carregar contas", { description: (contasError as Error).message });
  }
  
  if (transacoesError) {
    toast.error("Erro ao carregar transações", { description: (transacoesError as Error).message });
  }

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      const { error } = await supabase
        .from('contas')
        .insert({
          nome: data.nome,
          tipo: data.tipo,
          banco: data.banco || null,
          agencia: data.agencia || null,
          conta_numero: data.conta_numero || null,
          saldo_inicial: data.saldo_inicial,
          saldo_atual: data.saldo_inicial,
          ativo: data.ativo,
          observacoes: data.observacoes || null,
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta criada com sucesso");
      queryClient.invalidateQueries({ queryKey: ['contas-manutencao'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error("Erro ao criar conta", { description: error instanceof Error ? error.message : String(error) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      let updateQuery = supabase
        .from('contas')
        .update({
          nome: data.nome,
          tipo: data.tipo,
          banco: data.banco || null,
          agencia: data.agencia || null,
          conta_numero: data.conta_numero || null,
          saldo_inicial: data.saldo_inicial,
          ativo: data.ativo,
          observacoes: data.observacoes || null,
        })
        .eq('id', id)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        updateQuery = updateQuery.eq('filial_id', filialId);
      }
      const { error } = await updateQuery;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta atualizada");
      queryClient.invalidateQueries({ queryKey: ['contas-manutencao'] });
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
        .from('contas')
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
      toast.success("Conta excluída");
      queryClient.invalidateQueries({ queryKey: ['contas-manutencao'] });
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

    if (editingConta) {
      updateMutation.mutate({ id: editingConta.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (conta: Conta) => {
    const transacoesCount = transacoesPorConta[conta.id] || 0;
    if (transacoesCount > 0) {
      toast.error("Não é possível excluir", { 
        description: `Esta conta possui ${transacoesCount} transações vinculadas` 
      });
      return;
    }
    if (!confirm("Deseja excluir esta conta?")) return;
    deleteMutation.mutate(conta.id);
  };

  const openEdit = (conta: Conta) => {
    setEditingConta(conta);
    setFormData({
      nome: conta.nome,
      tipo: conta.tipo,
      banco: conta.banco || "",
      agencia: conta.agencia || "",
      conta_numero: conta.conta_numero || "",
      saldo_inicial: conta.saldo_inicial,
      ativo: conta.ativo,
      observacoes: conta.observacoes || "",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingConta(null);
    setFormData({
      nome: "",
      tipo: "corrente",
      banco: "",
      agencia: "",
      conta_numero: "",
      saldo_inicial: 0,
      ativo: true,
      observacoes: "",
    });
  };

  const filteredContas = contas.filter((c) =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.banco?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      corrente: "Conta Corrente",
      poupanca: "Poupança",
      caixa: "Caixa",
      investimento: "Investimento",
    };
    return tipos[tipo] || tipo;
  };

  const content = (
    <div className="space-y-6">
      {onBack && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Contas Bancárias</h1>
              <p className="text-muted-foreground text-sm">Gerencie contas e caixas</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-base h-10"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="text-xs">
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
      </div>

      {/* Table - Desktop */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Contas ({filteredContas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filteredContas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma conta encontrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContas.map((conta) => (
                  <TableRow key={conta.id}>
                    <TableCell className="font-medium">{conta.nome}</TableCell>
                    <TableCell>{getTipoLabel(conta.tipo)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {conta.banco ? `${conta.banco} ${conta.agencia || ''}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={conta.ativo ? "default" : "secondary"}>
                        {conta.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(conta)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(conta)}
                          disabled={(transacoesPorConta[conta.id] || 0) > 0}
                        >
                          {(transacoesPorConta[conta.id] || 0) > 0 ? (
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
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
        ) : filteredContas.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Nenhuma conta encontrada</p>
            </CardContent>
          </Card>
        ) : (
          filteredContas.map((conta) => (
            <Card key={conta.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{conta.nome}</h3>
                    <div className="space-y-1 mt-2">
                      <p className="text-sm text-muted-foreground">
                        Tipo: {getTipoLabel(conta.tipo)}
                      </p>
                      {conta.banco && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Landmark className="h-3 w-3" />
                          {conta.banco} {conta.agencia && `- Ag: ${conta.agencia}`}
                        </p>
                      )}
                      {conta.conta_numero && (
                        <p className="text-sm text-muted-foreground">
                          Conta: {conta.conta_numero}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={conta.ativo ? "default" : "secondary"} className="flex-shrink-0">
                    {conta.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openEdit(conta)}
                    className="flex-1"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDelete(conta)}
                    disabled={(transacoesPorConta[conta.id] || 0) > 0}
                    className="flex-1"
                  >
                    {(transacoesPorConta[conta.id] || 0) > 0 ? (
                      <>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Em uso
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                        Excluir
                      </>
                    )}
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
        title={editingConta ? "Editar Conta" : "Nova Conta"}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Bradesco Principal"
              className="text-base h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Conta Corrente</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
                <SelectItem value="caixa">Caixa</SelectItem>
                <SelectItem value="investimento">Investimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="banco">Banco</Label>
              <Input
                id="banco"
                value={formData.banco}
                onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                placeholder="Bradesco"
                className="text-base h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agencia">Agência</Label>
              <Input
                id="agencia"
                value={formData.agencia}
                onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                placeholder="1234"
                className="text-base h-10"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="conta_numero">Nº Conta</Label>
              <Input
                id="conta_numero"
                value={formData.conta_numero}
                onChange={(e) => setFormData({ ...formData, conta_numero: e.target.value })}
                placeholder="12345-6"
                className="text-base h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saldo_inicial">Saldo Inicial</Label>
              <Input
                id="saldo_inicial"
                type="number"
                step="0.01"
                value={formData.saldo_inicial}
                onChange={(e) => setFormData({ ...formData, saldo_inicial: parseFloat(e.target.value) || 0 })}
                className="text-base h-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações opcionais"
              rows={2}
              className="text-base"
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
            {editingConta ? "Salvar Alterações" : "Criar Conta"}
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );

  return onBack ? content : <MainLayout>{content}</MainLayout>;
}
