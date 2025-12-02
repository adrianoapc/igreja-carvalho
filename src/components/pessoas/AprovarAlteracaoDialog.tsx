import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ArrowRight, User, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

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

interface AprovarAlteracaoDialogProps {
  alteracao: AlteracaoPendente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const fieldLabels: Record<string, string> = {
  nome: 'Nome completo',
  telefone: 'Telefone',
  sexo: 'Sexo',
  data_nascimento: 'Aniversário',
  estado_civil: 'Estado civil',
  cep: 'CEP',
  cidade: 'Cidade',
  bairro: 'Bairro',
  estado: 'Estado',
  endereco: 'Endereço',
  profissao: 'Profissão',
  cpf: 'CPF',
  rg: 'RG',
  data_batismo: 'Aniversário de batismo',
};

const formatValue = (key: string, value: string | null): string => {
  if (value === null || value === '') return '(vazio)';
  
  if (key === 'data_nascimento' || key === 'data_batismo') {
    try {
      return format(new Date(value), 'dd/MM/yyyy');
    } catch {
      return value;
    }
  }
  
  if (key === 'telefone' && value) {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return value;
  }
  
  if (key === 'sexo') {
    return value === 'masculino' ? 'Masculino' : value === 'feminino' ? 'Feminino' : value;
  }
  
  return value;
};

export function AprovarAlteracaoDialog({ alteracao, open, onOpenChange, onSuccess }: AprovarAlteracaoDialogProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [camposAprovados, setCamposAprovados] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (alteracao) {
      // Inicializar todos os campos como aprovados por padrão
      const inicial: Record<string, boolean> = {};
      Object.keys(alteracao.dados_novos).forEach(key => {
        if (alteracao.dados_novos[key] !== alteracao.dados_antigos[key]) {
          inicial[key] = true;
        }
      });
      setCamposAprovados(inicial);
    }
  }, [alteracao]);

  const handleToggleCampo = (campo: string) => {
    setCamposAprovados(prev => ({
      ...prev,
      [campo]: !prev[campo]
    }));
  };

  const getChangedFields = () => {
    if (!alteracao) return [];
    return Object.keys(alteracao.dados_novos).filter(
      key => alteracao.dados_novos[key] !== alteracao.dados_antigos[key]
    );
  };

  const handleAprovar = async () => {
    if (!alteracao) return;
    
    setLoading(true);
    try {
      // Construir objeto com apenas os campos aprovados
      const updateData: Record<string, string | null> = {};
      Object.keys(camposAprovados).forEach(key => {
        if (camposAprovados[key]) {
          updateData[key] = alteracao.dados_novos[key];
        }
      });

      if (Object.keys(updateData).length > 0) {
        // Atualizar o perfil com os campos aprovados
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            ...updateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', alteracao.profile_id);

        if (updateError) throw updateError;
      }

      // Marcar alteração como aprovada
      const { error: statusError } = await supabase
        .from('alteracoes_perfil_pendentes')
        .update({
          status: 'aprovado',
          campos_aprovados: camposAprovados
        })
        .eq('id', alteracao.id);

      if (statusError) throw statusError;

      toast({
        title: 'Alteração aprovada',
        description: `${Object.keys(camposAprovados).filter(k => camposAprovados[k]).length} campos foram atualizados.`
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao aprovar alteração:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível aprovar a alteração.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejeitar = async () => {
    if (!alteracao) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('alteracoes_perfil_pendentes')
        .update({ status: 'rejeitado' })
        .eq('id', alteracao.id);

      if (error) throw error;

      toast({
        title: 'Alteração rejeitada',
        description: 'Todas as alterações foram recusadas.'
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao rejeitar alteração:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível rejeitar a alteração.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const changedFields = getChangedFields();

  if (!alteracao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-1 h-6 bg-primary rounded-full" />
            Aprovar Alteração de Perfil
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cabeçalho com info do perfil */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={alteracao.profile?.avatar_url || ''} />
                <AvatarFallback>
                  <User className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground">
                  Data de nascimento: {alteracao.profile?.data_nascimento 
                    ? format(new Date(alteracao.profile.data_nascimento), 'dd/MM/yyyy')
                    : 'Não informado'}
                </p>
                <h3 className="text-xl font-semibold">{alteracao.profile?.nome}</h3>
                <p className="text-sm text-muted-foreground">Igreja Carvalho</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                variant="default" 
                size="sm"
                onClick={() => navigate(`/pessoas/${alteracao.profile_id}`)}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver perfil
              </Button>
              <Badge variant="secondary" className="justify-center">
                {alteracao.profile?.status === 'membro' ? 'Membro' : 
                 alteracao.profile?.status === 'frequentador' ? 'Frequentador' : 'Visitante'}
              </Badge>
            </div>
          </div>

          {/* Lista de campos alterados */}
          <div className="space-y-3">
            {changedFields.map(campo => (
              <div key={campo} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{fieldLabels[campo] || campo}:</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm">
                      De: <strong>{formatValue(campo, alteracao.dados_antigos[campo])}</strong>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Para: <strong className="text-primary">{formatValue(campo, alteracao.dados_novos[campo])}</strong>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${camposAprovados[campo] ? 'text-primary' : 'text-muted-foreground'}`}>
                    {camposAprovados[campo] ? 'Aprovar' : 'Não aprovar'}
                  </span>
                  <Switch
                    checked={camposAprovados[campo] || false}
                    onCheckedChange={() => handleToggleCampo(campo)}
                  />
                </div>
              </div>
            ))}
          </div>

          {changedFields.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Nenhuma alteração detectada.
            </p>
          )}

          {/* Botões de ação */}
          <div className="flex justify-between pt-4">
            <Button
              variant="destructive"
              onClick={handleRejeitar}
              disabled={loading}
            >
              Recusar todo perfil
            </Button>
            <Button
              onClick={handleAprovar}
              disabled={loading || changedFields.length === 0}
            >
              Aprovar perfil
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
