import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Building2,
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
  const { toast } = useToast();

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

  const content = (
    <div className="space-y-3">
      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <GitBranch className="w-4 h-4" />
          <span>Filiais ({filiais.length})</span>
        </div>
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
    </Card>
  );
}
