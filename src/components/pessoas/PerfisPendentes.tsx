import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { User, FileEdit } from 'lucide-react';
import { AprovarAlteracaoDialog } from './AprovarAlteracaoDialog';

interface AlteracaoPendente {
  id: string;
  profile_id: string;
  dados_novos: Record<string, string | null>;
  dados_antigos: Record<string, string | null>;
  status: string;
  created_at: string;
  profile?: {
    id: string;
    nome: string;
    avatar_url: string | null;
    data_nascimento: string | null;
    status: string;
  };
}

export function PerfisPendentes() {
  const [alteracoes, setAlteracoes] = useState<AlteracaoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlteracao, setSelectedAlteracao] = useState<AlteracaoPendente | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('membro');

  const loadAlteracoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alteracoes_perfil_pendentes')
        .select(`
          id,
          profile_id,
          dados_novos,
          dados_antigos,
          status,
          created_at
        `)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar dados dos perfis associados
      if (data && data.length > 0) {
        const profileIds = [...new Set(data.map(a => a.profile_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome, avatar_url, data_nascimento, status')
          .in('id', profileIds);

        const alteracoesComPerfil = data.map(alt => ({
          ...alt,
          dados_novos: alt.dados_novos as Record<string, string | null>,
          dados_antigos: alt.dados_antigos as Record<string, string | null>,
          profile: profiles?.find(p => p.id === alt.profile_id)
        }));

        setAlteracoes(alteracoesComPerfil);
      } else {
        setAlteracoes([]);
      }
    } catch (error) {
      console.error('Erro ao carregar alterações pendentes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlteracoes();
  }, []);

  const handleOpenAlteracao = (alteracao: AlteracaoPendente) => {
    setSelectedAlteracao(alteracao);
    setDialogOpen(true);
  };

  const filteredAlteracoes = alteracoes.filter(alt => {
    if (statusFilter === 'todos') return true;
    return alt.profile?.status === statusFilter;
  });

  const countByStatus = (status: string) => {
    return alteracoes.filter(a => a.profile?.status === status).length;
  };

  return (
    <>
      <div className="space-y-6">
        {/* Seção: Alterações de perfil */}
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <span className="w-1 h-5 bg-primary rounded-full" />
            Alterações de perfil ({alteracoes.length})
          </h3>
          <div className="flex gap-4 text-sm mb-4">
            <button 
              className={`hover:text-foreground transition-colors ${statusFilter === 'membro' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
              onClick={() => setStatusFilter('membro')}
            >
              Membros ({countByStatus('membro')})
            </button>
            <button 
              className={`hover:text-foreground transition-colors ${statusFilter === 'frequentador' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
              onClick={() => setStatusFilter('frequentador')}
            >
              Frequentadores ({countByStatus('frequentador')})
            </button>
            <button 
              className={`hover:text-foreground transition-colors ${statusFilter === 'visitante' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
              onClick={() => setStatusFilter('visitante')}
            >
              Visitantes ({countByStatus('visitante')})
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : filteredAlteracoes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma alteração pendente para esta categoria.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAlteracoes.map(alteracao => (
                <Card key={alteracao.id} className="border-dashed">
                  <CardContent className="pt-6 flex flex-col items-center text-center">
                    <Avatar className="h-16 w-16 mb-3">
                      <AvatarImage src={alteracao.profile?.avatar_url || ''} />
                      <AvatarFallback>
                        <User className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                    <h4 className="font-semibold">{alteracao.profile?.nome || 'Sem nome'}</h4>
                    <Button 
                      variant="secondary" 
                      className="w-full mt-4"
                      onClick={() => handleOpenAlteracao(alteracao)}
                    >
                      <FileEdit className="h-4 w-4 mr-2" />
                      Analisar perfil
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AprovarAlteracaoDialog
        alteracao={selectedAlteracao}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={loadAlteracoes}
      />
    </>
  );
}
