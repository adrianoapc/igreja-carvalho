import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardAdmin from "@/components/dashboard/DashboardAdmin";
import DashboardLeader from "@/components/dashboard/DashboardLeader";
import DashboardMember from "@/components/dashboard/DashboardMember";

type UserRole = 'admin' | 'pastor' | 'lider' | 'secretario' | 'tesoureiro' | 'membro' | 'basico';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserRoles();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

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
  if (loading || authLoading) {
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

  if (isAdminOrPastor) {
    return <DashboardAdmin />;
  }

  if (isLeader) {
    return <DashboardLeader />;
  }

  // Default: Member dashboard
  return <DashboardMember />;
}
