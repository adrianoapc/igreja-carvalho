import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardAdmin from "@/components/dashboard/DashboardAdmin";
import DashboardLeader from "@/components/dashboard/DashboardLeader";
import DashboardMember from "@/components/dashboard/DashboardMember";
import DashboardVisitante from "@/components/dashboard/DashboardVisitante";
import { usePermissions } from "@/hooks/usePermissions"; // <--- Importe o novo hook
import { useIgrejaId } from "@/hooks/useIgrejaId";

type UserRole = 'admin' | 'pastor' | 'lider' | 'secretario' | 'tesoureiro' | 'membro' | 'basico';

export default function Dashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

    // --- INÍCIO DO BLOCO DE TESTE RBAC ---
  const { checkPermission, isAdmin } = usePermissions();

  useEffect(() => {
    const testarPermissoes = async () => {
      if (!user) return;
      
      console.log("🔍 TESTE RBAC INICIADO para:", user.email);
      console.log("👑 É Admin?", isAdmin);

      // Teste de permissões variadas
      const podeVerFinanceiro = await checkPermission('financeiro.view');
      const podeVerGabinete = await checkPermission('gabinete.view');
      const podeVerConfig = await checkPermission('configuracoes.view');

      console.table({
        'Financeiro View': podeVerFinanceiro,
        'Gabinete View': podeVerGabinete,
        'Config View': podeVerConfig
      });
    };

    testarPermissoes();
  }, [user, isAdmin, checkPermission]);
  // --- FIM DO BLOCO DE TESTE RBAC ---
  useEffect(() => {
    if (user && igrejaId) {
      fetchUserRoles();
    } else if (!authLoading && !igrejaLoading) {
      setLoading(false);
    }
  }, [user, igrejaId, authLoading, igrejaLoading]);

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .eq('igreja_id', igrejaId);

      if (error) throw error;
      
      const roles = data?.map(r => r.role as UserRole) || [];
      setUserRoles(roles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading || authLoading || igrejaLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Role-based rendering
  const isAdminOrPastor = userRoles.includes('admin') || userRoles.includes('pastor');
  const isLeader = userRoles.includes('lider');
  const isVisitante = profile?.status === 'visitante';

  // Visitante: Dashboard específico
  if (isVisitante) {
    return <DashboardVisitante />;
  }

  if (isAdminOrPastor) {
    return <DashboardAdmin />;
  }

  if (isLeader) {
    return <DashboardLeader />;
  }

  // Default: Member dashboard
  return <DashboardMember />;
}
