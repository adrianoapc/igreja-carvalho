import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [igrejaConfig, setIgrejaConfig] = useState<IgrejaConfig>(DEFAULT_IGREJA_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .single();

      if (error) {
        console.error('Erro ao buscar configuração:', error);
        if (error.code === 'PGRST116' || error.code === 'PGRST100') {
          console.log('Tabela app_config não encontrada ou vazia, usando defaults');
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
    try {
      const { data, error } = await supabase
        .from('configuracoes_igreja')
        .select('id, nome_igreja, logo_url, subtitulo')
        .single();

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
  }, []);

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
      } catch (error: any) {
        console.error('Erro ao atualizar configuração:', error);
        toast({
          title: 'Erro',
          description: error.message || 'Não foi possível salvar as alterações.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchConfig(), fetchIgrejaConfig()]);
      setIsLoading(false);
    };
    loadAll();

    const subscription = supabase
      .channel('app_config_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_config',
        },
        () => {
          fetchConfig();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchConfig, fetchIgrejaConfig]);

  return {
    config,
    igrejaConfig,
    isLoading,
    loading: isLoading, // alias for backward compatibility
    updateConfig,
    refreshConfig: fetchConfig,
    refetch: fetchConfig, // alias for backward compatibility
  };
}
