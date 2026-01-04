import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Igreja {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  status: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingRequest {
  id: string;
  nome_igreja: string;
  cnpj: string | null;
  email: string;
  telefone: string | null;
  nome_responsavel: string;
  cidade: string | null;
  estado: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  igreja_id: string | null;
}

export interface TenantMetrica {
  id: string;
  igreja_id: string;
  data_referencia: string;
  total_membros: number;
  membros_ativos: number;
  total_eventos: number;
  total_transacoes: number;
  valor_transacoes: number;
  storage_bytes: number;
  total_midias: number;
  total_chamadas_api: number;
  total_erros_api: number;
  latencia_media_ms: number;
  total_checkins: number;
  total_pedidos_oracao: number;
}

export interface SuperAdminDashboard {
  total_igrejas: number;
  igrejas_ativas: number;
  igrejas_pendentes: number;
  solicitacoes_pendentes: number;
  total_membros: number;
  total_eventos_mes: number;
}

export function useSuperAdmin() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<SuperAdminDashboard | null>(null);
  const [igrejas, setIgrejas] = useState<Igreja[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<OnboardingRequest[]>([]);

  // Verificar se é super_admin
  const checkSuperAdmin = useCallback(async () => {
    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      setIsSuperAdmin(!!data && !error);
    } catch {
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSuperAdmin();
  }, [checkSuperAdmin]);

  // Carregar dashboard
  const loadDashboard = useCallback(async () => {
    if (!isSuperAdmin) return;

    try {
      const { data, error } = await supabase.rpc('get_super_admin_dashboard');
      if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
        const dashData = data as Record<string, unknown>;
        if (!dashData.error) {
          setDashboard(dashData as unknown as SuperAdminDashboard);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    }
  }, [isSuperAdmin]);

  // Carregar igrejas
  const loadIgrejas = useCallback(async () => {
    if (!isSuperAdmin) return;

    try {
      const { data, error } = await supabase
        .from('igrejas')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setIgrejas(data as Igreja[]);
      }
    } catch (err) {
      console.error('Erro ao carregar igrejas:', err);
    }
  }, [isSuperAdmin]);

  // Carregar solicitações de onboarding
  const loadSolicitacoes = useCallback(async () => {
    if (!isSuperAdmin) return;

    try {
      const { data, error } = await supabase
        .from('onboarding_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSolicitacoes(data as OnboardingRequest[]);
      }
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
    }
  }, [isSuperAdmin]);

  // Aprovar solicitação
  const aprovarSolicitacao = async (requestId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const { data, error } = await supabase.rpc('aprovar_onboarding', {
        p_request_id: requestId
      });

      if (error) throw error;

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const result = data as Record<string, unknown>;
        if (result.success) {
          await loadSolicitacoes();
          await loadDashboard();
          await loadIgrejas();
          return { success: true, message: result.message as string };
        }
        return { success: false, message: (result.error as string) || 'Erro desconhecido' };
      }

      return { success: false, message: 'Resposta inválida' };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao aprovar solicitação';
      return { success: false, message: errorMessage };
    }
  };

  // Rejeitar solicitação
  const rejeitarSolicitacao = async (requestId: string, motivo?: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('onboarding_requests')
        .update({
          status: 'rejeitado',
          observacoes: motivo,
          processado_por: user?.id,
          processado_em: new Date().toISOString()
        })
        .eq('id', requestId);

      if (!error) {
        await loadSolicitacoes();
        await loadDashboard();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Atualizar status da igreja
  const atualizarStatusIgreja = async (igrejaId: string, status: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('igrejas')
        .update({ status })
        .eq('id', igrejaId);

      if (!error) {
        await loadIgrejas();
        await loadDashboard();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Calcular métricas de um tenant
  const calcularMetricas = async (igrejaId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('calcular_metricas_tenant', {
        p_igreja_id: igrejaId
      });
      return !error;
    } catch {
      return false;
    }
  };

  // Carregar métricas de um tenant
  const loadMetricasTenant = async (igrejaId: string): Promise<TenantMetrica[]> => {
    try {
      const { data, error } = await supabase
        .from('tenant_metricas')
        .select('*')
        .eq('igreja_id', igrejaId)
        .order('data_referencia', { ascending: false })
        .limit(30);

      if (!error && data) {
        return data as TenantMetrica[];
      }
      return [];
    } catch {
      return [];
    }
  };

  return {
    isSuperAdmin,
    loading,
    dashboard,
    igrejas,
    solicitacoes,
    loadDashboard,
    loadIgrejas,
    loadSolicitacoes,
    aprovarSolicitacao,
    rejeitarSolicitacao,
    atualizarStatusIgreja,
    calcularMetricas,
    loadMetricasTenant,
  };
}
