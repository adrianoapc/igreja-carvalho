import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { BiometricUnlockScreen } from './BiometricUnlockScreen';
import { useAppConfig } from '@/hooks/useAppConfig';

interface AuthGateProps {
  children: React.ReactNode;
}

const LAST_ACTIVITY_KEY = 'last_activity_timestamp';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inatividade

export function AuthGate({ children }: AuthGateProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isEnabled, isLoading: biometricLoading, getStoredUserId, disableBiometric } = useBiometricAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userName, setUserName] = useState<string | undefined>();
  const { config, isLoading: isLoadingMaintenanceConfig } = useAppConfig();
  const [isAdminOrTecnico, setIsAdminOrTecnico] = useState<boolean | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // Só verificar lock state quando biometria terminar de carregar
    if (!biometricLoading) {
      checkLockState();
    }
  }, [biometricLoading, isEnabled]);

  // Atualizar timestamp de atividade
  useEffect(() => {
    if (!isLocked) {
      const updateActivity = () => {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      };

      // Atualizar na montagem
      updateActivity();

      // Atualizar em interações
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
    // Se biometria não está habilitada, não bloquear
    if (!isEnabled) {
      setIsChecking(false);
      return;
    }

    // Verificar se há sessão ativa
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Sem sessão (logout), não desabilitar biometria - deixar para próxima entrada
      setIsChecking(false);
      return;
    }

    // Verificar se o user_id armazenado corresponde à sessão atual
    const storedUserId = getStoredUserId();
    if (storedUserId !== session.user.id) {
      // User diferente, desabilitar biometria e não bloquear
      disableBiometric();
      setIsChecking(false);
      return;
    }

    // Buscar nome do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('user_id', session.user.id)
      .single();

    if (profile) {
      setUserName(profile.nome);
    }

    // Verificar timeout de inatividade
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    const now = Date.now();

    if (lastActivity) {
      const elapsed = now - parseInt(lastActivity, 10);
      if (elapsed > LOCK_TIMEOUT_MS) {
        // Inativo por muito tempo, bloquear
        setIsLocked(true);
      }
    } else {
      // Primeira visita com biometria - bloquear para verificar
      setIsLocked(true);
    }

    setIsChecking(false);
  };

  const handleUnlocked = () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    setIsLocked(false);
  };

  const handleUsePassword = async () => {
    // Fazer logout e ir para tela de login
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // 1) Carregar usuário atual (para regras de manutenção)
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
      setIsAdminOrTecnico(null); // força recálculo de roles
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2) Checar roles quando em manutenção e houver usuário
  useEffect(() => {
    let active = true;
    const checkRoles = async () => {
      if (!config.maintenance_mode) {
        setIsAdminOrTecnico(false);
        return;
      }
      if (!currentUserId) {
        setIsAdminOrTecnico(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUserId);
        if (error) throw error;
        const roles = (data || []).map(r => r.role);
        const allowed = roles.includes('admin') || roles.includes('tecnico');
        if (active) setIsAdminOrTecnico(allowed);
      } catch (err) {
        if (active) setIsAdminOrTecnico(false);
      }
    };

    checkRoles();
    return () => { active = false; };
  }, [config.maintenance_mode, currentUserId]);

  // 3) Determinar se rota atual é pública
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

  // 4) Regras de redirecionamento para manutenção (sem loops)
  useEffect(() => {
    if (isLoadingUser || isLoadingMaintenanceConfig) return; // Regra 1: apenas loading

    const path = location.pathname;
    const onMaintenance = config.maintenance_mode;
    const allowPublic = config.allow_public_access;

    // Rotas públicas liberadas se allow_public_access estiver ativo
    if (isPublicRoute && allowPublic) return;

    if (onMaintenance) {
      // Se ainda não sabemos o papel e rota não é pública, aguardar
      if (isAdminOrTecnico === null && !isPublicRoute) return;

      const isMaintenancePage = path === '/maintenance';
      if (!isAdminOrTecnico && !isMaintenancePage) {
        navigate('/maintenance', { replace: true });
      }
    }
  }, [
    isLoadingUser,
    isLoadingMaintenanceConfig,
    location.pathname,
    config.maintenance_mode,
    config.allow_public_access,
    isAdminOrTecnico,
    isPublicRoute,
    navigate,
  ]);

  // Regra 1: Loading de usuário/biometria/config
  if (biometricLoading || isChecking || isLoadingUser || isLoadingMaintenanceConfig) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (isLocked && isEnabled) {
    return (
      <BiometricUnlockScreen
        onUnlocked={handleUnlocked}
        onUsePassword={handleUsePassword}
        userName={userName}
      />
    );
  }

  // Regra 2: Rotas públicas com acesso liberado
  if (isPublicRoute && config.allow_public_access) {
    return <>{children}</>;
  }

  // Regra 3: Em manutenção, somente admin/tecnico acessa
  if (config.maintenance_mode && isAdminOrTecnico === false) {
    // Se chegar aqui e estiver na /maintenance, apenas renderiza children
    if (location.pathname === '/maintenance') {
      return <>{children}</>;
    }
    // Caso contrário, tela vazia enquanto redireciona no efeito
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Redirecionando…</p>
      </div>
    );
  }

  return <>{children}</>;
}
