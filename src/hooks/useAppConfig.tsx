import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AppConfig {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  allow_public_access: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  maintenance_mode: false,
  maintenance_message: null,
  allow_public_access: true,
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
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
        // Se tabela não existe ou está vazia, usa defaults
        if (error.code === 'PGRST116' || error.code === 'PGRST100') {
          console.log('Tabela app_config não encontrada ou vazia, usando defaults');
        }
        setConfig(DEFAULT_CONFIG);
      } else if (data) {
        setConfig({
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
    } finally {
      setIsLoading(false);
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
    fetchConfig();

    // Subscrever a mudanças na configuração
    const subscription = supabase
      .channel('app_config_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_config',
        },
        (payload) => {
          console.log('Config atualizada:', payload);
          fetchConfig();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchConfig]);

  return {
    config,
    isLoading,
    updateConfig,
    refreshConfig: fetchConfig,
  };
}
