import { useState, useEffect } from 'react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ArrowRight, User, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useIgrejaId } from '@/hooks/useIgrejaId';
import { useFilialId } from '@/hooks/useFilialId';

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
  const { igrejaId } = useIgrejaId();
  const { filialId, isAllFiliais } = useFilialId();

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
      if (!igrejaId) {
        throw new Error("Igreja não identificada.");
      }
      // Construir objeto com apenas os campos aprovados
      const updateData: Record<string, string | null> = {};
      Object.keys(camposAprovados).forEach(key => {
        if (camposAprovados[key]) {
          updateData[key] = alteracao.dados_novos[key];
        }
      });

      if (Object.keys(updateData).length > 0) {
        // Atualizar o perfil com os campos aprovados
      let updateProfileQuery = supabase
        .from('profiles')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', alteracao.profile_id)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        updateProfileQuery = updateProfileQuery.eq('filial_id', filialId);
      }
      const { error: updateError } = await updateProfileQuery;

        if (updateError) throw updateError;
      }

      // Marcar alteração como aprovada
      let statusQuery = supabase
        .from('alteracoes_perfil_pendentes')
        .update({
          status: 'aprovado',
          campos_aprovados: camposAprovados
        })
        .eq('id', alteracao.id)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        statusQuery = statusQuery.eq('filial_id', filialId);
      }
      const { error: statusError } = await statusQuery;

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
      if (!igrejaId) {
        throw new Error("Igreja não identificada.");
      }
      let rejectQuery = supabase
        .from('alteracoes_perfil_pendentes')
        .update({ status: 'rejeitado' })
        .eq('id', alteracao.id)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        rejectQuery = rejectQuery.eq('filial_id', filialId);
      }
      const { error } = await rejectQuery;

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
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{ className: "h-[85vh] w-full max-w-5xl p-0 flex flex-col" }}
      drawerContentProps={{ className: "max-h-[90vh] p-0 flex flex-col" }}
    >
      <div className="flex flex-col h-full">
        {/* Cabeçalho Fixo */}
        <div className="border-b flex-none">
          <div className="pb-3 px-4 pt-4 md:px-6 md:pt-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
              <span className="w-1 h-6 bg-primary rounded-full" />
              Aprovar Alteração de Perfil
            </h2>
          </div>

          {/* Card de Informações do Perfil */}
          <div className="space-y-4 px-4 py-4 md:px-6 md:py-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-4 md:col-span-2">
                <Avatar className="h-16 w-16 flex-shrink-0">
                  <AvatarImage src={alteracao.profile?.avatar_url || ''} />
                  <AvatarFallback>
                    <User className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold truncate">{alteracao.profile?.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    Nasc: {alteracao.profile?.data_nascimento 
                      ? format(new Date(alteracao.profile.data_nascimento), 'dd/MM/yyyy')
                      : 'Não informado'}
                  </p>
                  <p className="text-sm text-muted-foreground">Igreja Carvalho</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:col-span-1">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/pessoas/${alteracao.profile_id}`)}
                  className="w-full"
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

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="destructive"
                onClick={handleRejeitar}
                disabled={loading}
              >
                Recusar
              </Button>
              <Button
                onClick={handleAprovar}
                disabled={loading || changedFields.length === 0}
              >
                Aprovar
              </Button>
            </div>
          </div>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-4 px-4 py-4 md:px-6 md:py-5">
            {changedFields.map(campo => (
              <div key={campo} className="p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_1fr_120px] gap-3 items-start">
                  <div className="flex items-center justify-between md:flex-col md:items-start md:justify-start md:gap-2">
                    <p className="text-sm font-semibold text-muted-foreground">{fieldLabels[campo] || campo}</p>
                  </div>

                  <div className="p-3 bg-red-50 rounded border border-red-200/50">
                    <p className="text-xs text-red-600 font-medium mb-1">De:</p>
                    <p className="text-sm font-semibold text-red-900 break-words">
                      {formatValue(campo, alteracao.dados_antigos[campo])}
                    </p>
                  </div>

                  <div className="p-3 bg-green-50 rounded border border-green-200/50">
                    <p className="text-xs text-green-600 font-medium mb-1">Para:</p>
                    <p className="text-sm font-semibold text-green-900 break-words">
                      {formatValue(campo, alteracao.dados_novos[campo])}
                    </p>
                  </div>

                  <div className="flex items-center justify-between md:flex-col md:items-end md:justify-start md:gap-2">
                    <span className={`text-xs font-medium ${camposAprovados[campo] ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {camposAprovados[campo] ? '✓ Aprovar' : '○ Não aprovar'}
                    </span>
                    <Switch
                      checked={camposAprovados[campo] || false}
                      onCheckedChange={() => handleToggleCampo(campo)}
                    />
                  </div>
                </div>
              </div>
            ))}

            {changedFields.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma alteração detectada.
              </p>
            )}
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
