import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  status: "visitante" | "frequentador" | "membro";
  data_primeira_visita: string;
  data_cadastro_membro: string | null;
  observacoes: string | null;
  avatar_url: string | null;
}

interface ModulePermission {
  module_name: string;
  access_level: "visualizar" | "criar_editar" | "aprovar_gerenciar" | "acesso_completo";
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se há token de recuperação no hash da URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get("type");
    const accessToken = hashParams.get("access_token");
    
    // Domínio de produção customizado
    const productionDomain = "app.igrejacarvalho.com.br";
    const currentHost = window.location.host;
    const isOnWrongDomain = currentHost.includes("lovable.app") || currentHost.includes("lovableproject.com");
    
    if (type === "recovery" && accessToken) {
      // Se estamos no domínio errado (Lovable), redirecionar para o domínio de produção
      if (isOnWrongDomain) {
        const redirectUrl = `https://${productionDomain}/auth/reset${window.location.hash}`;
        window.location.href = redirectUrl;
        return;
      }
      // Se estamos no domínio correto, deixar o Supabase processar o token
      // via onAuthStateChange (PASSWORD_RECOVERY event)
    }

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Detectar evento de recuperação de senha
      if (event === "PASSWORD_RECOVERY") {
        // Redirecionar para a página de reset de senha
        window.location.href = "/auth/reset";
        return;
      }

      if (session?.user) {
        // Defer Supabase calls
        setTimeout(() => {
          loadUserData(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setPermissions([]);
        setLoading(false);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      // Carregar perfil
      const { data: profileData } = await supabase.from("profiles").select("*").eq("user_id", userId).single();

      if (profileData) {
        setProfile(profileData);

        // Carregar permissões se for membro
        if (profileData.status === "membro") {
          const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);

          if (rolesData && rolesData.length > 0) {
            const roles = rolesData.map((r) => r.role);

            const { data: permissionsData } = await supabase
              .from("module_permissions")
              .select("module_name, access_level")
              .in("role", roles);

            if (permissionsData) {
              setPermissions(permissionsData);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    // Security: Clear biometric refresh token on logout to prevent session reuse
    sessionStorage.removeItem('biometric_refresh_token');
    localStorage.removeItem('biometric_refresh_token');
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setPermissions([]);
  };

  const hasAccess = (moduleName: string, requiredLevel?: string): boolean => {
    if (!profile) {
      // console.log("hasAccess: No profile found");
      return false;
    }

    console.log("hasAccess check:", {
      moduleName,
      requiredLevel,
      profileStatus: profile.status,
      permissionsCount: permissions.length,
    });

    // Visitantes e frequentadores não têm acesso
    if (profile.status !== "membro") {
      //console.log("hasAccess: User is not a member");
      return false;
    }

    // Se não especificar nível, só verifica se tem algum acesso
    if (!requiredLevel) {
      const hasAnyAccess = permissions.some((p) => p.module_name === moduleName);
      //console.log("hasAccess (any):", hasAnyAccess);
      return hasAnyAccess;
    }

    // Verificar nível específico
    const permission = permissions.find((p) => p.module_name === moduleName);
    if (!permission) {
      console.log("hasAccess: No permission found for module");
      return false;
    }

    const levels = ["visualizar", "criar_editar", "aprovar_gerenciar", "acesso_completo"];
    const requiredIndex = levels.indexOf(requiredLevel);
    const userIndex = levels.indexOf(permission.access_level);

    const hasRequiredLevel = userIndex >= requiredIndex;
    console.log("hasAccess (level):", {
      required: requiredLevel,
      user: permission.access_level,
      hasAccess: hasRequiredLevel,
    });

    return hasRequiredLevel;
  };

  return {
    user,
    session,
    profile,
    permissions,
    loading,
    signOut,
    hasAccess,
    isMember: profile?.status === "membro",
    isAuthenticated: !!user,
  };
}
