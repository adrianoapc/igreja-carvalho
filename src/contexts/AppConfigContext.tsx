import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIgrejaId } from '@/hooks/useIgrejaId';

interface AppConfig {
  id?: number;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  allow_public_access: boolean;
}

interface IgrejaConfig {
  id: string;
  nome_igreja: string;
  logo_url: string | null;
  subtitulo: string | null;
}

interface AppConfigContextValue {
  config: AppConfig;
  igrejaConfig: IgrejaConfig;
  isLoading: boolean;
  loading: boolean;
  updateConfig: (updates: Partial<AppConfig>) => Promise<boolean>;
  refreshConfig: () => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_CONFIG: AppConfig = {
  maintenance_mode: false,
  maintenance_message: null,
  allow_public_access: true,
};

const DEFAULT_IGREJA_CONFIG: IgrejaConfig = {
  id: '',
  nome_igreja: 'Igreja',
  logo_url: null,
  subtitulo: null,
};

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [igrejaConfig, setIgrejaConfig] = useState<IgrejaConfig>(DEFAULT_IGREJA_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .single();

      if (error) {
        if (error.code !== 'PGRST116' && error.code !== 'PGRST100') {
          console.error('Erro ao buscar configuração:', error);
        }
        setConfig(DEFAULT_CONFIG);
      } else if (data) {
        setConfig({
          id: data.id,
          maintenance_mode: data.maintenance_mode ?? false,
          maintenance_message: data.maintenance_message ?? null,
          allow_public_access: data.allow_public_access ?? true,
        });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
      setConfig(DEFAULT_CONFIG);
    }
  }, []);

  const fetchIgrejaConfig = useCallback(async () => {
    if (!igrejaId) {
      setIgrejaConfig(DEFAULT_IGREJA_CONFIG);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('configuracoes_igreja')
        .select('id, nome_igreja, logo_url, subtitulo')
        .eq('igreja_id', igrejaId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar config igreja:', error);
        setIgrejaConfig(DEFAULT_IGREJA_CONFIG);
      } else if (data) {
        setIgrejaConfig({
          id: data.id,
          nome_igreja: data.nome_igreja,
          logo_url: data.logo_url,
          subtitulo: data.subtitulo,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar config igreja:', error);
      setIgrejaConfig(DEFAULT_IGREJA_CONFIG);
    }
  }, [igrejaId]);

  const updateConfig = useCallback(
    async (updates: Partial<AppConfig>) => {
      try {
        const { error } = await supabase
          .from('app_config')
          .update(updates)
          .eq('id', 1);

        if (error) throw error;

        setConfig((prev) => ({ ...prev, ...updates }));

        toast({
          title: 'Configuração atualizada',
          description: 'As alterações foram salvas com sucesso.',
        });

        return true;
      } catch (error: unknown) {
        console.error('Erro ao atualizar configuração:', error);
        toast({
          title: 'Erro',
          description:
            error instanceof Error
              ? error.message
              : String(error) || 'Não foi possível salvar as alterações.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  // Carrega dados quando auth terminar de inicializar
  useEffect(() => {
    if (igrejaLoading) return;
    setIsLoading(true);
    Promise.all([fetchConfig(), fetchIgrejaConfig()]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchConfig, fetchIgrejaConfig, igrejaLoading]);

  // Subscription Realtime — uma única instância para toda a árvore
  useEffect(() => {
    if (channelRef.current) return; // já subscrito

    const channel = supabase
      .channel('app_config_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_config' },
        fetchConfig
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AppConfigContextValue = {
    config,
    igrejaConfig,
    isLoading,
    loading: isLoading,
    updateConfig,
    refreshConfig: fetchConfig,
    refetch: fetchConfig,
  };

  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfigContext() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfigContext must be used inside AppConfigProvider');
  return ctx;
}
