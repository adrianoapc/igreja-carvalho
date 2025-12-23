import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type Permission = 
  | 'financeiro.view' 
  | 'financeiro.admin' 
  | 'gabinete.view' 
  | 'gabinete.admin' 
  | 'pessoas.view' 
  | 'pessoas.admin'
  | 'ministerio.view' 
  | 'configuracoes.view'
  | 'ensino.view';

export function usePermissions() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Cache para evitar spam de requests
  const [permissionsCache, setPermissionsCache] = useState<Record<string, boolean>>({});

  const checkAdminStatus = useCallback(async () => {
    if (!user) return;
    try {
      // Verifica se é admin na tabela user_roles
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!error && data && data.some(r => r.role === 'admin')) {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error("Erro ao verificar admin:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        checkAdminStatus();
      } else {
        setLoading(false); // Sem usuário, fim do loading
      }
    }
  }, [user, authLoading, checkAdminStatus]);

  // Função para verificar permissão
  const checkPermission = useCallback(async (perm: Permission): Promise<boolean> => {
    if (!user) return false;
    if (isAdmin) return true; // God Mode
    if (permissionsCache[perm] !== undefined) return permissionsCache[perm];

    try {
      const { data, error } = await supabase.rpc('has_permission', {
        _user_id: user.id,
        _permission_slug: perm
      });
      
      if (error) {
        console.error(`Erro RPC has_permission:`, error);
        return false;
      }

      const hasPerm = !!data;
      setPermissionsCache(prev => ({ ...prev, [perm]: hasPerm }));
      return hasPerm;
    } catch (error) {
      console.error(`Erro ao verificar permissão ${perm}:`, error);
      return false;
    }
  }, [user, isAdmin, permissionsCache]);

  return { 
    checkPermission, 
    isAdmin, 
    loading: loading || authLoading 
  };
}