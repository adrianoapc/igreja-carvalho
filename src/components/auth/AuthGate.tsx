import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { BiometricUnlockScreen } from './BiometricUnlockScreen';

interface AuthGateProps {
  children: React.ReactNode;
}

const LAST_ACTIVITY_KEY = 'last_activity_timestamp';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inatividade

export function AuthGate({ children }: AuthGateProps) {
  const navigate = useNavigate();
  const { isEnabled, isLoading: biometricLoading, getStoredUserId, disableBiometric } = useBiometricAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userName, setUserName] = useState<string | undefined>();

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
      // Sem sessão, redirecionar para login
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

  if (biometricLoading || isChecking) {
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

  return <>{children}</>;
}
