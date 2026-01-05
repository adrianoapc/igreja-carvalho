import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Copy,
} from "lucide-react";

interface Filial {
  id: string;
  nome: string;
  created_at: string;
}

interface FilialManagerProps {
  igrejaId: string;
  igrejaNome?: string;
  showHeader?: boolean;
  compact?: boolean;
  onFilialChange?: () => void;
}

/**
 * Componente reutilizável para gerenciar filiais de uma igreja.
 * Usado tanto pelo Super Admin quanto pelo Admin da Igreja.
 */
export function FilialManager({
  igrejaId,
  igrejaNome,
  showHeader = true,
  compact = false,
  onFilialChange,
}: FilialManagerProps) {
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replicarOpen, setReplicarOpen] = useState(false);
  const [filialOrigemId, setFilialOrigemId] = useState<string | null>(null);
  const [filiaisDestinoIds, setFiliaisDestinoIds] = useState<string[]>([]);
  const [tabelasSelecionadas, setTabelasSelecionadas] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [replicando, setReplicando] = useState(false);
  const { toast } = useToast();

  const tabelasDisponiveis = [
    { id: "contas", label: "Contas bancárias" },
    { id: "centros_custo", label: "Centros de custo" },
    { id: "categorias_financeiras", label: "Categorias financeiras" },
    { id: "subcategorias_financeiras", label: "Subcategorias financeiras" },
    { id: "fornecedores", label: "Fornecedores" },
    { id: "formas_pagamento", label: "Formas de pagamento" },
    { id: "bases_ministeriais", label: "Bases ministeriais" },
  ];

  const loadFiliais = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("filiais")
      .select("*")
      .eq("igreja_id", igrejaId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setFiliais(data);
    }
    setLoading(false);
  }, [igrejaId]);

  useEffect(() => {
    loadFiliais();
  }, [loadFiliais]);

  const handleAddFilial = async () => {
    if (!novoNome.trim()) return;

    setSaving(true);
    const { error } = await supabase
      .from("filiais")
      .insert({ igreja_id: igrejaId, nome: novoNome.trim() });

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao criar filial", variant: "destructive" });
    } else {
      toast({ title: "Filial criada com sucesso!" });
      setNovoNome("");
      setShowAddForm(false);
      loadFiliais();
      onFilialChange?.();
    }
  };

  const handleUpdateFilial = async (id: string) => {
    if (!editingNome.trim()) return;

    setSaving(true);
    const { error } = await supabase
      .from("filiais")
      .update({ nome: editingNome.trim() })
      .eq("id", id);

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao atualizar filial", variant: "destructive" });
    } else {
      toast({ title: "Filial atualizada!" });
      setEditingId(null);
      loadFiliais();
      onFilialChange?.();
    }
  };

  const handleDeleteFilial = async (filial: Filial) => {
    if (filial.nome.toLowerCase() === "matriz") {
      toast({
        title: "A filial Matriz não pode ser excluída",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("filiais").delete().eq("id", filial.id);
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao excluir filial", variant: "destructive" });
    } else {
      toast({ title: "Filial excluída!" });
      loadFiliais();
      onFilialChange?.();
    }
  };

  const toggleDestino = (id: string) => {
    setFiliaisDestinoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleTabela = (id: string) => {
    setTabelasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetReplicacao = () => {
    setFilialOrigemId(null);
    setFiliaisDestinoIds([]);
    setTabelasSelecionadas([]);
    setOverwrite(false);
  };

  const handleReplicarCadastros = async () => {
    if (!filialOrigemId) {
      toast({ title: "Selecione a filial origem", variant: "destructive" });
      return;
    }
    if (filiaisDestinoIds.length === 0) {
      toast({ title: "Selecione ao menos uma filial destino", variant: "destructive" });
      return;
    }
    if (tabelasSelecionadas.length === 0) {
      toast({ title: "Selecione ao menos um cadastro para replicar", variant: "destructive" });
      return;
    }

    setReplicando(true);
    try {
      const { data, error } = await supabase.functions.invoke("replicar-cadastros", {
        body: {
          igreja_id: igrejaId,
          filial_origem_id: filialOrigemId,
          filial_destino_ids: filiaisDestinoIds,
          tabelas: tabelasSelecionadas,
          overwrite,
        },
      });

      if (error) throw error;

      toast({
        title: "Replicação concluída",
        description: "Os cadastros selecionados foram processados. Consulte o log para detalhes.",
      });

      console.info("Resultado replicação:", data);
      resetReplicacao();
      setReplicarOpen(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Erro ao replicar cadastros", description: message, variant: "destructive" });
    } finally {
      setReplicando(false);
    }
  };

  const content = (
    <div className="space-y-3">
      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <GitBranch className="w-4 h-4" />
          <span>Filiais ({filiais.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReplicarOpen(true)}
            disabled={saving || filiais.length < 2}
          >
            <Copy className="w-4 h-4 mr-1" />
            Replicar Cadastros
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm || saving}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nova Filial
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Lista de filiais */}
          {filiais.map((filial) => (
            <div
              key={filial.id}
              className="flex items-center justify-between p-3 rounded-md bg-background border"
            >
              {editingId === filial.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editingNome}
                    onChange={(e) => setEditingNome(e.target.value)}
                    className="h-8"
                    autoFocus
                    disabled={saving}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleUpdateFilial(filial.id)}
                    disabled={saving}
                  >
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{filial.nome}</span>
                    {filial.nome.toLowerCase() === "matriz" && (
                      <Badge variant="secondary" className="text-xs">
                        Principal
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingId(filial.id);
                        setEditingNome(filial.nome);
                      }}
                      disabled={saving}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteFilial(filial)}
                      disabled={filial.nome.toLowerCase() === "matriz" || saving}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Formulário de nova filial */}
          {showAddForm && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-background border border-primary/30">
              <Input
                placeholder="Nome da nova filial"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="h-8"
                autoFocus
                disabled={saving}
              />
              <Button size="sm" onClick={handleAddFilial} disabled={saving}>
                Criar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNovoNome("");
                }}
                disabled={saving}
              >
                Cancelar
              </Button>
            </div>
          )}

          {/* Empty state */}
          {filiais.length === 0 && !showAddForm && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma filial cadastrada
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Gerenciar Filiais
          </CardTitle>
          {igrejaNome && (
            <CardDescription>
              Filiais da igreja: {igrejaNome}
            </CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent>{content}</CardContent>
      <ResponsiveDialog
        open={replicarOpen}
        onOpenChange={(open) => {
          setReplicarOpen(open);
          if (!open) resetReplicacao();
        }}
        title="Replicar cadastros entre filiais"
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Filial origem</Label>
                <Select value={filialOrigemId ?? ""} onValueChange={setFilialOrigemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a filial origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {filiais.map((filial) => (
                      <SelectItem key={filial.id} value={filial.id}>
                        {filial.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Filiais destino</Label>
                <div className="space-y-2 rounded-md border p-3">
                  {filiais
                    .filter((filial) => filial.id !== filialOrigemId)
                    .map((filial) => (
                      <label
                        key={filial.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={filiaisDestinoIds.includes(filial.id)}
                          onCheckedChange={() => toggleDestino(filial.id)}
                        />
                        {filial.nome}
                      </label>
                    ))}
                  {filiais.filter((filial) => filial.id !== filialOrigemId).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Selecione uma filial origem para listar destinos.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cadastros para replicar</Label>
                <div className="grid grid-cols-1 gap-2 rounded-md border p-3">
                  {tabelasDisponiveis.map((tabela) => (
                    <label key={tabela.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={tabelasSelecionadas.includes(tabela.id)}
                        onCheckedChange={() => toggleTabela(tabela.id)}
                      />
                      {tabela.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label>Substituir cadastros existentes</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, registros com o mesmo nome serão atualizados.
                  </p>
                </div>
                <Switch checked={overwrite} onCheckedChange={setOverwrite} />
              </div>

              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Apenas cadastros ativos serão replicados. Contas de tesouraria não são copiadas.
              </div>
            </div>
          </div>

          <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setReplicarOpen(false)}
              disabled={replicando}
            >
              Cancelar
            </Button>
            <Button onClick={handleReplicarCadastros} disabled={replicando}>
              {replicando ? "Replicando..." : "Replicar"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </Card>
  );
}
