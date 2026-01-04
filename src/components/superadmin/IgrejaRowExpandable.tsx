import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  Building2,
} from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Filial {
  id: string;
  nome: string;
  created_at: string;
}

interface Igreja {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  status: string;
  created_at: string;
}

interface IgrejaRowExpandableProps {
  igreja: Igreja;
  onViewMetricas: (igreja: Igreja) => void;
  onStatusChange: (igrejaId: string, newStatus: string) => void;
  onIgrejaUpdated: () => void;
  processing: boolean;
}

export function IgrejaRowExpandable({
  igreja,
  onViewMetricas,
  onStatusChange,
  onIgrejaUpdated,
  processing,
}: IgrejaRowExpandableProps) {
  const [expanded, setExpanded] = useState(false);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loadingFiliais, setLoadingFiliais] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editIgrejaOpen, setEditIgrejaOpen] = useState(false);
  const [igrejaForm, setIgrejaForm] = useState({
    nome: igreja.nome,
    cnpj: igreja.cnpj || '',
    email: igreja.email || '',
    telefone: igreja.telefone || '',
    cidade: igreja.cidade || '',
    estado: igreja.estado || '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleUpdateIgreja = async () => {
    if (!igrejaForm.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('igrejas')
      .update({
        nome: igrejaForm.nome.trim(),
        cnpj: igrejaForm.cnpj.trim() || null,
        email: igrejaForm.email.trim() || null,
        telefone: igrejaForm.telefone.trim() || null,
        cidade: igrejaForm.cidade.trim() || null,
        estado: igrejaForm.estado.trim() || null,
      })
      .eq('id', igreja.id);

    setSaving(false);

    if (error) {
      toast({ title: 'Erro ao atualizar igreja', variant: 'destructive' });
    } else {
      toast({ title: 'Igreja atualizada com sucesso!' });
      setEditIgrejaOpen(false);
      onIgrejaUpdated();
    }
  };

  const loadFiliais = async () => {
    setLoadingFiliais(true);
    const { data, error } = await supabase
      .from('filiais')
      .select('*')
      .eq('igreja_id', igreja.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setFiliais(data);
    }
    setLoadingFiliais(false);
  };

  useEffect(() => {
    if (expanded && filiais.length === 0) {
      loadFiliais();
    }
  }, [expanded]);

  const handleAddFilial = async () => {
    if (!novoNome.trim()) return;

    const { error } = await supabase
      .from('filiais')
      .insert({ igreja_id: igreja.id, nome: novoNome.trim() });

    if (error) {
      toast({ title: 'Erro ao criar filial', variant: 'destructive' });
    } else {
      toast({ title: 'Filial criada com sucesso!' });
      setNovoNome('');
      setShowAddForm(false);
      loadFiliais();
    }
  };

  const handleUpdateFilial = async (id: string) => {
    if (!editingNome.trim()) return;

    const { error } = await supabase
      .from('filiais')
      .update({ nome: editingNome.trim() })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar filial', variant: 'destructive' });
    } else {
      toast({ title: 'Filial atualizada!' });
      setEditingId(null);
      loadFiliais();
    }
  };

  const handleDeleteFilial = async (filial: Filial) => {
    if (filial.nome.toLowerCase() === 'matriz') {
      toast({ title: 'A filial Matriz não pode ser excluída', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('filiais').delete().eq('id', filial.id);

    if (error) {
      toast({ title: 'Erro ao excluir filial', variant: 'destructive' });
    } else {
      toast({ title: 'Filial excluída!' });
      loadFiliais();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      ativo: { variant: 'default', icon: <CheckCircle2 className="w-3 h-3" /> },
      pendente: { variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
      suspenso: { variant: 'destructive', icon: <AlertCircle className="w-3 h-3" /> },
      inativo: { variant: 'outline', icon: <XCircle className="w-3 h-3" /> },
    };
    const config = variants[status] || { variant: 'outline' as const, icon: null };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  return (
    <>
      {/* Main row */}
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpanded(!expanded)}>
        <TableCell>
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <Building2 className="w-4 h-4 text-primary" />
            <span className="font-medium">{igreja.nome}</span>
            {filiais.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">
                {filiais.length} {filiais.length === 1 ? 'filial' : 'filiais'}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          {igreja.cidade && igreja.estado ? `${igreja.cidade}/${igreja.estado}` : '-'}
        </TableCell>
        <TableCell>{igreja.email || '-'}</TableCell>
        <TableCell>{getStatusBadge(igreja.status)}</TableCell>
        <TableCell>
          {format(new Date(igreja.created_at), 'dd/MM/yyyy', { locale: ptBR })}
        </TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIgrejaForm({
                  nome: igreja.nome,
                  cnpj: igreja.cnpj || '',
                  email: igreja.email || '',
                  telefone: igreja.telefone || '',
                  cidade: igreja.cidade || '',
                  estado: igreja.estado || '',
                });
                setEditIgrejaOpen(true);
              }}
              title="Editar Igreja"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewMetricas(igreja)}
              title="Ver Métricas"
            >
              <Eye className="w-4 h-4" />
            </Button>
            {igreja.status === 'ativo' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onStatusChange(igreja.id, 'suspenso')}
                disabled={processing}
              >
                Suspender
              </Button>
            )}
            {igreja.status === 'suspenso' && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onStatusChange(igreja.id, 'ativo')}
                disabled={processing}
              >
                Reativar
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded filiais rows */}
      {expanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={6} className="p-0">
            <div className="pl-10 pr-4 py-3 border-l-4 border-primary/20 ml-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <GitBranch className="w-4 h-4" />
                  Filiais
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddForm(true)}
                  disabled={showAddForm}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Nova Filial
                </Button>
              </div>

              {loadingFiliais ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  {filiais.map((filial) => (
                    <div
                      key={filial.id}
                      className="flex items-center justify-between p-2 rounded-md bg-background border"
                    >
                      {editingId === filial.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingNome}
                            onChange={(e) => setEditingNome(e.target.value)}
                            className="h-8"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleUpdateFilial(filial.id)}
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{filial.nome}</span>
                            {filial.nome.toLowerCase() === 'matriz' && (
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
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteFilial(filial)}
                              disabled={filial.nome.toLowerCase() === 'matriz'}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {showAddForm && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-background border border-primary/30">
                      <Input
                        placeholder="Nome da nova filial"
                        value={novoNome}
                        onChange={(e) => setNovoNome(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleAddFilial}>
                        Criar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddForm(false);
                          setNovoNome('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}

                  {filiais.length === 0 && !showAddForm && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhuma filial cadastrada
                    </p>
                  )}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* Dialog de Edição da Igreja */}
      <Dialog open={editIgrejaOpen} onOpenChange={setEditIgrejaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Igreja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={igrejaForm.nome}
                onChange={(e) => setIgrejaForm({ ...igrejaForm, nome: e.target.value })}
                placeholder="Nome da igreja"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={igrejaForm.cnpj}
                  onChange={(e) => setIgrejaForm({ ...igrejaForm, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={igrejaForm.telefone}
                  onChange={(e) => setIgrejaForm({ ...igrejaForm, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={igrejaForm.email}
                onChange={(e) => setIgrejaForm({ ...igrejaForm, email: e.target.value })}
                placeholder="contato@igreja.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={igrejaForm.cidade}
                  onChange={(e) => setIgrejaForm({ ...igrejaForm, cidade: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={igrejaForm.estado}
                  onChange={(e) => setIgrejaForm({ ...igrejaForm, estado: e.target.value })}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditIgrejaOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateIgreja} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
