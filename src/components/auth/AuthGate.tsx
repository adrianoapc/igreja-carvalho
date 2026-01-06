import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { BiometricUnlockScreen } from "./BiometricUnlockScreen";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { Permission } from "@/hooks/usePermissions";

interface AuthGateProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
}

const LAST_ACTIVITY_KEY = "last_activity_timestamp";
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inatividade

export function AuthGate({ children, requiredPermission }: AuthGateProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // AuthContext unificado - única fonte de verdade
  const authContext = useAuthContext();
  
  // Safe destructuring with fallbacks
  const {
    user = null,
    igrejaId = null,
    roles = [],
    isAdmin = false,
    loading: authLoading = true
  } = authContext || {};

  // Hooks existentes preservados
  const {
    isEnabled,
    isLoading: biometricLoading,
    getStoredUserId,
    disableBiometric,
  } = useBiometricAuth();
  const { config, isLoading: isLoadingMaintenanceConfig } = useAppConfig();

  // Estados locais
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userName, setUserName] = useState<string | undefined>();
  const [isAdminOrTecnico, setIsAdminOrTecnico] = useState<boolean | null>(null);
  const [hasAuthRedirected, setHasAuthRedirected] = useState(false);
  const [isPermissionAuthorized, setIsPermissionAuthorized] = useState(true);

  // --- 1. BLOCO DE BIOMETRIA (Preservado) ---
  useEffect(() => {
    if (!biometricLoading) {
      checkLockState();
    }
  }, [biometricLoading, isEnabled]);

  useEffect(() => {
    if (!isLocked) {
      const updateActivity = () => {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      };
      updateActivity();
      const events = ["click", "keydown", "scroll", "touchstart"];
      events.forEach((event) => {
        window.addEventListener(event, updateActivity, { passive: true });
      });
      return () => {
        events.forEach((event) => {
          window.removeEventListener(event, updateActivity);
        });
      };
    }
  }, [isLocked]);

  const checkLockState = async () => {
    if (!isEnabled) {
      setIsChecking(false);
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setIsChecking(false);
      return;
    }
    const storedUserId = getStoredUserId();
    if (storedUserId !== session.user.id) {
      disableBiometric();
      setIsChecking(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", session.user.id)
      .single();
    if (profile) setUserName(profile.nome);

    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    const now = Date.now();
    if (lastActivity) {
      const elapsed = now - parseInt(lastActivity, 10);
      if (elapsed > LOCK_TIMEOUT_MS) setIsLocked(true);
    } else {
      setIsLocked(true);
    }
    setIsChecking(false);
  };

  const handleUnlocked = () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    setIsLocked(false);
  };

  const handleUsePassword = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // --- 2. ROTAS PÚBLICAS ---
  const isPublicRoute = useMemo(() => {
    const path = location.pathname;
    const publicPatterns = [
      /^\/auth(\/.*)?$/,
      /^\/biometric-login$/,
      /^\/cadastro(\/.*)?$/,
      /^\/telao(\/.*)?$/,
      /^\/checkin\//,
      /^\/maintenance$/,
      /^\/public(\/.*)?$/,
    ];
    return publicPatterns.some((re) => re.test(path));
  }, [location.pathname]);

  // Redireciona para login se não autenticado em rota não pública
  useEffect(() => {
    if (authLoading || isPublicRoute) return;
    if (!user && !hasAuthRedirected) {
      setHasAuthRedirected(true);
      navigate("/auth", { replace: true });
    }
  }, [authLoading, isPublicRoute, user, navigate, hasAuthRedirected]);

  // --- 3. VERIFICAÇÃO DE ADMIN/TECNICO PARA MANUTENÇÃO ---
  useEffect(() => {
    if (!config.maintenance_mode) {
      setIsAdminOrTecnico(false);
      return;
    }
    if (!user || !igrejaId) {
      setIsAdminOrTecnico(false);
      return;
    }
    // Usar roles do AuthContext
    const allowed =
      roles.includes("admin") ||
      roles.includes("tecnico") ||
      roles.includes("super_admin");
    setIsAdminOrTecnico(allowed);
  }, [config.maintenance_mode, user, igrejaId, roles]);

  // --- 4. VERIFICAÇÃO DE PERMISSÃO ---
  useEffect(() => {
    if (!requiredPermission) {
      setIsPermissionAuthorized(true);
      return;
    }

    if (authLoading) return;

    if (!user) {
      setIsPermissionAuthorized(false);
      return;
    }

    // Admin tem acesso a tudo
    if (isAdmin) {
      setIsPermissionAuthorized(true);
      return;
    }

    // Verificação baseada em roles
    const checkPerm = (): boolean => {
      switch (requiredPermission) {
        case "financeiro.view":
        case "financeiro.admin":
          return roles.includes("admin") || roles.includes("tesoureiro");
        case "gabinete.view":
        case "gabinete.admin":
          return roles.includes("admin") || roles.includes("pastor");
        case "pessoas.view":
        case "pessoas.admin":
          return roles.includes("admin") || roles.includes("secretario");
        case "ministerio.view":
          return (
            roles.includes("admin") ||
            roles.includes("pastor") ||
            roles.includes("lider")
          );
        case "configuracoes.view":
          return roles.includes("admin");
        case "ensino.view":
          return roles.includes("admin") || roles.includes("lider");
        case "filiais.view":
        case "filiais.manage":
          return roles.includes("admin");
        default:
          return false;
      }
    };

    const hasPerm = checkPerm();
    if (!hasPerm) {
      console.warn(`⛔ Acesso negado. Requer: ${requiredPermission}`);
    }
    setIsPermissionAuthorized(hasPerm);
  }, [requiredPermission, user, authLoading, isAdmin, roles]);

  // --- 5. REDIRECIONAMENTO DE MANUTENÇÃO ---
  useEffect(() => {
    if (authLoading || isLoadingMaintenanceConfig) return;
    const path = location.pathname;
    const onMaintenance = config.maintenance_mode;
    const allowPublic = config.allow_public_access;

    if (isPublicRoute && allowPublic) return;

    if (onMaintenance) {
      if (isAdminOrTecnico === null && !isPublicRoute) return;
      const isMaintenancePage = path === "/maintenance";
      if (!isAdminOrTecnico && !isMaintenancePage) {
        navigate("/maintenance", { replace: true });
      }
    }
  }, [
    authLoading,
    isLoadingMaintenanceConfig,
    location.pathname,
    config.maintenance_mode,
    config.allow_public_access,
    isAdminOrTecnico,
    isPublicRoute,
    navigate,
  ]);

  // --- 6. RENDERIZAÇÃO ---

  // Loading unificado - baseado apenas em authLoading
  if (biometricLoading || isChecking || authLoading || isLoadingMaintenanceConfig) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">
          Verificando credenciais...
        </p>
      </div>
    );
  }

  // Tela de Bloqueio
  if (isLocked && isEnabled) {
    return (
      <BiometricUnlockScreen
        onUnlocked={handleUnlocked}
        onUsePassword={handleUsePassword}
        userName={userName}
      />
    );
  }

  // Rotas Públicas
  if (isPublicRoute && config.allow_public_access) {
    return <>{children}</>;
  }

  // Tela de Manutenção
  if (config.maintenance_mode && isAdminOrTecnico === false) {
    if (location.pathname === "/maintenance") return <>{children}</>;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">
          Redirecionando para manutenção...
        </p>
      </div>
    );
  }

  // Bloqueio por Permissão (RBAC)
  if (requiredPermission && !isPermissionAuthorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta área.
            <br />
            Necessário:{" "}
            <code className="bg-muted px-1 rounded">{requiredPermission}</code>
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
