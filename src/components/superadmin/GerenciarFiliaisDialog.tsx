import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Pencil, Trash2, Building, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Filial {
  id: string;
  nome: string;
  igreja_id: string;
  created_at: string;
}

interface GerenciarFiliaisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  igreja: { id: string; nome: string } | null;
}

export function GerenciarFiliaisDialog({ open, onOpenChange, igreja }: GerenciarFiliaisDialogProps) {
  const { toast } = useToast();
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(false);
  const [novaFilial, setNovaFilial] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState('');

  useEffect(() => {
    if (open && igreja) {
      loadFiliais();
    }
  }, [open, igreja]);

  const loadFiliais = async () => {
    if (!igreja) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('filiais')
        .select('*')
        .eq('igreja_id', igreja.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFiliais(data || []);
    } catch (error) {
      console.error('Erro ao carregar filiais:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFilial = async () => {
    if (!novaFilial.trim() || !igreja) return;

    setAdding(true);
    try {
      const { error } = await supabase
        .from('filiais')
        .insert({
          igreja_id: igreja.id,
          nome: novaFilial.trim(),
        });

      if (error) throw error;

      toast({ title: 'Filial criada com sucesso!' });
      setNovaFilial('');
      loadFiliais();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar filial';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleEditFilial = async (id: string) => {
    if (!editingNome.trim()) return;

    try {
      const { error } = await supabase
        .from('filiais')
        .update({ nome: editingNome.trim() })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Filial atualizada!' });
      setEditingId(null);
      loadFiliais();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar filial';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  const handleDeleteFilial = async (filial: Filial) => {
    if (filial.nome === 'Matriz') {
      toast({ title: 'A filial Matriz não pode ser excluída', variant: 'destructive' });
      return;
    }

    if (!confirm(`Deseja realmente excluir a filial "${filial.nome}"?`)) return;

    try {
      const { error } = await supabase
        .from('filiais')
        .delete()
        .eq('id', filial.id);

      if (error) throw error;

      toast({ title: 'Filial excluída!' });
      loadFiliais();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir filial';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  const startEdit = (filial: Filial) => {
    setEditingId(filial.id);
    setEditingNome(filial.nome);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingNome('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Filiais - {igreja?.nome}
          </DialogTitle>
          <DialogDescription>
            Gerencie as filiais/unidades desta igreja
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Formulário para nova filial */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="novaFilial" className="sr-only">
                Nome da nova filial
              </Label>
              <Input
                id="novaFilial"
                value={novaFilial}
                onChange={(e) => setNovaFilial(e.target.value)}
                placeholder="Nome da nova filial"
                onKeyDown={(e) => e.key === 'Enter' && handleAddFilial()}
              />
            </div>
            <Button onClick={handleAddFilial} disabled={adding || !novaFilial.trim()}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">Adicionar</span>
            </Button>
          </div>

          {/* Lista de filiais */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filiais.map((filial) => (
                  <TableRow key={filial.id}>
                    <TableCell>
                      {editingId === filial.id ? (
                        <Input
                          value={editingNome}
                          onChange={(e) => setEditingNome(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditFilial(filial.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{filial.nome}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(filial.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === filial.id ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditFilial(filial.id)}
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEdit}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(filial)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteFilial(filial)}
                            disabled={filial.nome === 'Matriz'}
                            className={filial.nome === 'Matriz' ? 'opacity-50 cursor-not-allowed' : ''}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filiais.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Nenhuma filial cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
