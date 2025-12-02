import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { User, FileEdit, ArrowLeft, Clock, CheckCircle, XCircle, Filter } from 'lucide-react';
import { AprovarAlteracaoDialog } from '@/components/pessoas/AprovarAlteracaoDialog';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlteracaoPendente {
  id: string;
  profile_id: string;
  dados_novos: Record<string, string | null>;
  dados_antigos: Record<string, string | null>;
  status: string;
  created_at: string;
  updated_at: string | null;
  aprovado_por: string | null;
  observacoes: string | null;
  profile?: {
    id: string;
    nome: string;
    avatar_url: string | null;
    data_nascimento: string | null;
    status: string;
  };
  aprovador?: {
    nome: string;
  } | null;
}

export default function AlteracoesPendentes() {
  const navigate = useNavigate();
  const [alteracoes, setAlteracoes] = useState<AlteracaoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlteracao, setSelectedAlteracao] = useState<AlteracaoPendente | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('pendente');
  const [profileStatusFilter, setProfileStatusFilter] = useState<string>('todos');

  const loadAlteracoes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('alteracoes_perfil_pendentes')
        .select(`
          id,
          profile_id,
          dados_novos,
          dados_antigos,
          status,
          created_at,
          updated_at,
          aprovado_por,
          observacoes
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        const profileIds = [...new Set(data.map(a => a.profile_id))];
        const aprovadorIds = [...new Set(data.filter(a => a.aprovado_por).map(a => a.aprovado_por!))];

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome, avatar_url, data_nascimento, status')
          .in('id', profileIds);

        let aprovadores: { id: string; nome: string }[] = [];
        if (aprovadorIds.length > 0) {
          const { data: aprovadoresData } = await supabase
            .from('profiles')
            .select('id, nome')
            .in('user_id', aprovadorIds);
          aprovadores = aprovadoresData || [];
        }

        const alteracoesComDados = data.map(alt => ({
          ...alt,
          dados_novos: alt.dados_novos as Record<string, string | null>,
          dados_antigos: alt.dados_antigos as Record<string, string | null>,
          profile: profiles?.find(p => p.id === alt.profile_id),
          aprovador: aprovadores.find(a => a.id === alt.aprovado_por)
        }));

        setAlteracoes(alteracoesComDados);
      } else {
        setAlteracoes([]);
      }
    } catch (error) {
      console.error('Erro ao carregar alterações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlteracoes();
  }, [statusFilter]);

  const handleOpenAlteracao = (alteracao: AlteracaoPendente) => {
    setSelectedAlteracao(alteracao);
    setDialogOpen(true);
  };

  const filteredAlteracoes = alteracoes.filter(alt => {
    if (profileStatusFilter === 'todos') return true;
    return alt.profile?.status === profileStatusFilter;
  });

  const countByStatus = (status: string) => {
    return alteracoes.filter(a => a.status === status).length;
  };

  const countByProfileStatus = (profileStatus: string) => {
    return alteracoes.filter(a => a.profile?.status === profileStatus).length;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'aprovado':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProfileStatusBadge = (status: string) => {
    switch (status) {
      case 'membro':
        return <Badge variant="default">Membro</Badge>;
      case 'frequentador':
        return <Badge variant="secondary">Frequentador</Badge>;
      case 'visitante':
        return <Badge variant="outline">Visitante</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/pessoas')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Alterações de Perfil</h1>
          <p className="text-muted-foreground text-sm">Gerencie todas as alterações pendentes e histórico</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter('pendente')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{countByStatus('pendente')}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter('aprovado')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{countByStatus('aprovado')}</p>
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter('rejeitado')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{countByStatus('rejeitado')}</p>
                <p className="text-xs text-muted-foreground">Rejeitados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter('todos')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileEdit className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{alteracoes.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="aprovado">Aprovados</SelectItem>
                  <SelectItem value="rejeitado">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={profileStatusFilter} onValueChange={setProfileStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tipo pessoa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="membro">Membros ({countByProfileStatus('membro')})</SelectItem>
                  <SelectItem value="frequentador">Frequentadores ({countByProfileStatus('frequentador')})</SelectItem>
                  <SelectItem value="visitante">Visitantes ({countByProfileStatus('visitante')})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {statusFilter === 'todos' ? 'Todas as alterações' : 
             statusFilter === 'pendente' ? 'Alterações pendentes' :
             statusFilter === 'aprovado' ? 'Alterações aprovadas' : 'Alterações rejeitadas'}
            <span className="text-muted-foreground font-normal ml-2">({filteredAlteracoes.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : filteredAlteracoes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma alteração encontrada.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredAlteracoes.map(alteracao => (
                <div 
                  key={alteracao.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={alteracao.profile?.avatar_url || ''} />
                      <AvatarFallback>
                        <User className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{alteracao.profile?.nome || 'Sem nome'}</h4>
                        {alteracao.profile?.status && getProfileStatusBadge(alteracao.profile.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Solicitado em {format(new Date(alteracao.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {alteracao.updated_at && alteracao.status !== 'pendente' && (
                        <p className="text-xs text-muted-foreground">
                          {alteracao.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'} em {format(new Date(alteracao.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(alteracao.status)}
                    <Button 
                      variant={alteracao.status === 'pendente' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleOpenAlteracao(alteracao)}
                    >
                      {alteracao.status === 'pendente' ? 'Analisar' : 'Ver detalhes'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AprovarAlteracaoDialog
        alteracao={selectedAlteracao}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={loadAlteracoes}
      />
    </div>
  );
}
