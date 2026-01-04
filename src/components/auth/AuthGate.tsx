import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { BiometricUnlockScreen } from './BiometricUnlockScreen';
import { useAppConfig } from '@/hooks/useAppConfig';
import { usePermissions, Permission } from '@/hooks/usePermissions'; // <--- NOVO
import { useIgrejaId } from '@/hooks/useIgrejaId';

interface AuthGateProps {
  children: React.ReactNode;
  requiredPermission?: Permission; // <--- NOVO: Prop opcional
}

const LAST_ACTIVITY_KEY = 'last_activity_timestamp';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inatividade

export function AuthGate({ children, requiredPermission }: AuthGateProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Hooks existentes preservados
  const { isEnabled, isLoading: biometricLoading, getStoredUserId, disableBiometric } = useBiometricAuth();
  const { config, isLoading: isLoadingMaintenanceConfig } = useAppConfig();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  
  // Hook de Permissões (NOVO)
  const { checkPermission, loading: permissionsLoading, isAdmin } = usePermissions();

  // Estados locais existentes
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userName, setUserName] = useState<string | undefined>();
  const [isAdminOrTecnico, setIsAdminOrTecnico] = useState<boolean | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasAuthRedirected, setHasAuthRedirected] = useState(false);
  
  // Estado para controle de permissão da rota (NOVO)
  const [isPermissionAuthorized, setIsPermissionAuthorized] = useState(true);
  const [isCheckingPermission, setIsCheckingPermission] = useState(!!requiredPermission);

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
      const events = ['click', 'keydown', 'scroll', 'touchstart'];
      events.forEach(event => {
        window.addEventListener(event, updateActivity, { passive: true });
      });
      return () => {
        events.forEach(event => {
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
    const { data: { session } } = await supabase.auth.getSession();
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
      .from('profiles')
      .select('nome')
      .eq('user_id', session.user.id)
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
    navigate('/auth');
  };

  // --- 2. BLOCO DE USUÁRIO E MANUTENÇÃO (Preservado) ---
  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setCurrentUserId(session?.user?.id ?? null);
      } finally {
        if (isMounted) setIsLoadingUser(false);
      }
    };
    loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUserId(session?.user?.id ?? null);
      setIsAdminOrTecnico(null);
    });
    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

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
    if (isLoadingUser || isPublicRoute) return;
    if (!currentUserId && !hasAuthRedirected) {
      setHasAuthRedirected(true);
      navigate('/auth', { replace: true });
    }
  }, [isLoadingUser, isPublicRoute, currentUserId, navigate, hasAuthRedirected]);

  useEffect(() => {
    let active = true;
    const checkRoles = async () => {
      if (!config.maintenance_mode) {
        setIsAdminOrTecnico(false);
        return;
      }
      if (!currentUserId || !igrejaId) {
        setIsAdminOrTecnico(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUserId)
          .eq('igreja_id', igrejaId);
        if (error) throw error;
        const roles = (data || []).map(r => r.role);
        const allowed = roles.includes('admin') || roles.includes('tecnico') || roles.includes('super_admin');
        if (active) setIsAdminOrTecnico(allowed);
      } catch (err) {
        if (active) setIsAdminOrTecnico(false);
      }
    };
    checkRoles();
    return () => { active = false; };
  }, [config.maintenance_mode, currentUserId, igrejaId]);

  // --- 3. BLOCO DE VERIFICAÇÃO DE PERMISSÃO (NOVO) ---
  useEffect(() => {
    const checkRequiredPermission = async () => {
      // Se não exige permissão, libera direto
      if (!requiredPermission) {
        setIsCheckingPermission(false);
        return;
      }
      
      // Aguardar loading do user e permissions terminarem
      if (isLoadingUser || permissionsLoading) {
        return;
      }
      
      // Se não tem usuário, não autoriza
      if (!currentUserId) {
        setIsCheckingPermission(false);
        return;
      }

      // Se é admin (vindo do hook usePermissions), libera direto
      if (isAdmin) {
        setIsPermissionAuthorized(true);
        setIsCheckingPermission(false);
        return;
      }

      // Verifica a permissão específica no banco
      const hasPerm = await checkPermission(requiredPermission);
      
      if (!hasPerm) {
        console.warn(`⛔ Acesso negado. Requer: ${requiredPermission}`);
        setIsPermissionAuthorized(false);
      } else {
        setIsPermissionAuthorized(true);
      }
      setIsCheckingPermission(false);
    };

    checkRequiredPermission();
  }, [requiredPermission, currentUserId, isLoadingUser, isAdmin, permissionsLoading, checkPermission]);


  // --- 4. RENDERIZAÇÃO E REDIRECIONAMENTOS ---

  // Redirecionamento de Manutenção
  useEffect(() => {
    if (isLoadingUser || isLoadingMaintenanceConfig) return;
    const path = location.pathname;
    const onMaintenance = config.maintenance_mode;
    const allowPublic = config.allow_public_access;

    if (isPublicRoute && allowPublic) return;

    if (onMaintenance) {
      if (isAdminOrTecnico === null && !isPublicRoute) return;
      const isMaintenancePage = path === '/maintenance';
      if (!isAdminOrTecnico && !isMaintenancePage) {
        navigate('/maintenance', { replace: true });
      }
    }
  }, [isLoadingUser, isLoadingMaintenanceConfig, location.pathname, config.maintenance_mode, config.allow_public_access, isAdminOrTecnico, isPublicRoute, navigate]);

  // Loading Geral
  const isStillCheckingPermissions = requiredPermission && (isCheckingPermission || permissionsLoading);
  if (biometricLoading || isChecking || isLoadingUser || isLoadingMaintenanceConfig || igrejaLoading || isStillCheckingPermissions) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Verificando credenciais...</p>
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
    if (location.pathname === '/maintenance') return <>{children}</>;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Redirecionando para manutenção...</p>
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
            Você não tem permissão para acessar esta área.<br/>
            Necessário: <code className="bg-muted px-1 rounded">{requiredPermission}</code>
          </p>
          <button 
            onClick={() => navigate('/')}
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
