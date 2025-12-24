import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fingerprint, Loader2, AlertTriangle, ScanFace, ShieldCheck } from "lucide-react";
import logoCarvalho from "@/assets/logo-carvalho.png";
import { useBiometricAuth, BiometricErrorType, triggerHapticFeedback } from "@/hooks/useBiometricAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppConfig } from "@/hooks/useAppConfig";
import { cn } from "@/lib/utils";

const MAX_BIOMETRIC_ATTEMPTS = 3;
const BIOMETRIC_ATTEMPTS_KEY = 'biometric_attempts';
const ATTEMPTS_RESET_TIME = 5 * 60 * 1000; // 5 minutos

type LoadingState = 'idle' | 'awaiting_biometric' | 'authenticating' | 'restoring_session';

// Mensagens de erro contextuais por tipo
const getErrorMessage = (errorType: BiometricErrorType, biometricType: 'face' | 'fingerprint' | 'unknown'): { title: string; description: string } => {
  const biometricName = biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'impressão digital' : 'biometria';
  
  switch (errorType) {
    case 'NOT_ALLOWED':
      return {
        title: 'Verificação cancelada',
        description: 'Você cancelou a verificação. Toque no botão para tentar novamente.',
      };
    case 'NOT_RECOGNIZED':
      return {
        title: `${biometricType === 'face' ? 'Rosto' : 'Digital'} não reconhecido(a)`,
        description: `Sua ${biometricName} não foi reconhecida. Tente novamente.`,
      };
    case 'TIMEOUT':
      return {
        title: 'Tempo esgotado',
        description: `O tempo para verificar sua ${biometricName} expirou. Tente novamente.`,
      };
    case 'HARDWARE_ERROR':
      return {
        title: 'Erro no sensor',
        description: `Houve um problema com o sensor de ${biometricName}. Use sua senha.`,
      };
    case 'NOT_FOUND':
      return {
        title: 'Biometria não configurada',
        description: 'Sua biometria não está configurada. Faça login com senha para reconfigurar.',
      };
    case 'SECURITY_ERROR':
      return {
        title: 'Erro de segurança',
        description: 'Não foi possível verificar sua identidade por motivos de segurança.',
      };
    case 'NOT_SUPPORTED':
      return {
        title: 'Não suportado',
        description: 'Seu dispositivo não suporta autenticação biométrica.',
      };
    default:
      return {
        title: 'Erro na verificação',
        description: 'Ocorreu um erro inesperado. Tente novamente ou use sua senha.',
      };
  }
};

export default function BiometricLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const { isEnabled, verifyBiometric, getRefreshToken, getAccessToken, clearRefreshToken, biometricType } = useBiometricAuth();
  const { config, isLoading: isConfigLoading } = useAppConfig();

  const isLoading = loadingState !== 'idle';
  const BiometricIcon = biometricType === 'face' ? ScanFace : Fingerprint;
  const biometricLabel = biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'Touch ID' : 'Biometria';

  // Verificar se já tem sessão ativa
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          navigate("/", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, [navigate]);

  const getAttemptCount = (): number => {
    const data = localStorage.getItem(BIOMETRIC_ATTEMPTS_KEY);
    if (!data) return 0;

    const { count, timestamp } = JSON.parse(data);
    const now = Date.now();

    if (now - timestamp > ATTEMPTS_RESET_TIME) {
      localStorage.removeItem(BIOMETRIC_ATTEMPTS_KEY);
      return 0;
    }

    return count;
  };

  const incrementAttempts = () => {
    const count = getAttemptCount();
    localStorage.setItem(
      BIOMETRIC_ATTEMPTS_KEY,
      JSON.stringify({
        count: count + 1,
        timestamp: Date.now(),
      })
    );
  };

  const resetAttempts = () => {
    localStorage.removeItem(BIOMETRIC_ATTEMPTS_KEY);
  };

  const getLoadingText = () => {
    switch (loadingState) {
      case 'awaiting_biometric':
        return biometricType === 'face' ? 'Olhe para a câmera...' : 'Toque no sensor...';
      case 'authenticating':
        return 'Verificando...';
      case 'restoring_session':
        return 'Entrando...';
      default:
        return 'Carregando...';
    }
  };

  const handleBiometricLogin = async () => {
    if (!isEnabled) {
      navigate("/auth", { replace: true });
      return;
    }

    const currentAttempts = getAttemptCount();

    try {
      if (currentAttempts >= MAX_BIOMETRIC_ATTEMPTS) {
        toast({
          title: "Limite de tentativas atingido",
          description: "Por favor, use sua senha para entrar.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return;
      }

      setLoadingState('awaiting_biometric');
      console.log('[BiometricLogin] Tentando verificar biometria...');
      
      const result = await verifyBiometric();

      if (result.success) {
        console.log('[BiometricLogin] Biometria verificada com sucesso!');
        setLoadingState('restoring_session');
        
        const refreshToken = getRefreshToken();
        const accessToken = getAccessToken();
        
        console.log('[BiometricLogin] Checking tokens:', {
          hasRefreshToken: !!refreshToken,
          refreshTokenLength: refreshToken ? refreshToken.length : 0,
          hasAccessToken: !!accessToken,
          accessTokenLength: accessToken ? accessToken.length : 0,
        });
        
        if (!refreshToken && !accessToken) {
          console.error('[BiometricLogin] Nenhum token armazenado');
          incrementAttempts();
          triggerHapticFeedback('error');
          toast({
            title: "Sessão não encontrada",
            description: "Faça login com sua senha para continuar.",
            variant: "destructive",
          });
          setLoadingState('idle');
          setTimeout(() => {
            navigate("/auth", { replace: true });
          }, 1000);
          return;
        }

        setLoadingState('authenticating');
        
        let sessionData = null;
        let sessionError = null;

        if (refreshToken) {
          console.log('[BiometricLogin] Attempting to refresh session...');
          const result = await supabase.auth.refreshSession({
            refresh_token: refreshToken,
          });
          sessionData = result.data;
          sessionError = result.error;

          console.log('[BiometricLogin] Refresh session result:', {
            hasSession: !!sessionData.session,
            hasUser: !!sessionData.session?.user,
            userId: sessionData.session?.user?.id,
            error: sessionError?.message,
          });
        }

        if ((!sessionData?.session || sessionError) && accessToken) {
          console.log('[BiometricLogin] Trying access_token fallback...');
          
          try {
            const result = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            if (result.error) {
              throw result.error;
            }
            
            sessionData = result.data;
            sessionError = null;
            
            console.log('[BiometricLogin] Access token fallback successful');
          } catch (fallbackError) {
            console.error('[BiometricLogin] Access token fallback failed:', fallbackError);
            sessionError = fallbackError as any;
          }
        }

        if (sessionError || !sessionData?.session) {
          console.error('[BiometricLogin] Erro ao restaurar sessão:', sessionError);
          clearRefreshToken();
          incrementAttempts();
          triggerHapticFeedback('error');
          toast({
            title: "Sessão expirada",
            description: "Por favor, faça login novamente com sua senha.",
            variant: "destructive",
          });
          setLoadingState('idle');
          setTimeout(() => {
            navigate("/auth", { replace: true });
          }, 1000);
          return;
        }

        resetAttempts();
        triggerHapticFeedback('success');
        
        toast({
          title: "Bem-vindo!",
          description: "Autenticação bem-sucedida.",
        });
        
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 500);
      } else {
        // Falha na biometria com erro específico
        console.log('[BiometricLogin] Biometria falhou:', result.errorType, result.errorMessage);
        incrementAttempts();
        const newCount = getAttemptCount();
        const remaining = MAX_BIOMETRIC_ATTEMPTS - newCount;

        const errorInfo = getErrorMessage(result.errorType || 'UNKNOWN', biometricType);

        if (remaining <= 0) {
          toast({
            title: "Limite de tentativas atingido",
            description: "Por favor, use sua senha para entrar.",
            variant: "destructive",
          });
          setLoadingState('idle');
          setTimeout(() => {
            navigate("/auth", { replace: true });
          }, 1000);
        } else {
          toast({
            title: errorInfo.title,
            description: `${errorInfo.description} (${remaining} ${remaining === 1 ? "tentativa restante" : "tentativas restantes"})`,
            variant: "destructive",
          });
          setLoadingState('idle');
        }
      }
    } catch (error: any) {
      console.error("[BiometricLogin] Erro:", error);
      incrementAttempts();
      const newCount = getAttemptCount();
      const remaining = MAX_BIOMETRIC_ATTEMPTS - newCount;
      triggerHapticFeedback('error');

      if (remaining <= 0) {
        toast({
          title: "Limite de tentativas atingido",
          description: "Por favor, use sua senha para entrar.",
          variant: "destructive",
        });
        setLoadingState('idle');
        setTimeout(() => {
          navigate("/auth", { replace: true });
        }, 1000);
      } else {
        toast({
          title: "Erro inesperado",
          description: `Algo deu errado. ${remaining} ${remaining === 1 ? "tentativa restante" : "tentativas restantes"}.`,
          variant: "destructive",
        });
        setLoadingState('idle');
      }
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-primary/10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-primary/10 flex flex-col items-center justify-center p-4">
      {/* Aviso de manutenção */}
      {!isConfigLoading && config.maintenance_mode && (
        <div className="w-full max-w-sm mb-4">
          <Card className="bg-orange-500 text-white border-0 shadow-md">
            <div className="px-3 py-2 flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Modo de manutenção ativo</p>
                <p className="text-xs opacity-90">
                  {config.maintenance_message || "O sistema está em manutenção."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="w-full max-w-sm">
        <Card className="p-8 shadow-xl">
          <div className="text-center mb-8">
            <img
              src={logoCarvalho}
              alt="Igreja Carvalho"
              className="h-16 w-auto mx-auto mb-4"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <h2 className="text-2xl font-bold text-foreground">Bem-vindo</h2>
            <p className="text-muted-foreground mt-1">Use {biometricLabel} para entrar</p>
          </div>

          {/* Botão de biometria com animação */}
          <Button
            onClick={handleBiometricLogin}
            disabled={isLoading}
            size="lg"
            variant="outline"
            className={cn(
              "w-full h-28 flex-col gap-3 border-2 transition-all duration-300",
              isLoading && "border-primary bg-primary/5",
              !isLoading && "hover:border-primary hover:bg-primary/5"
            )}
          >
            <div className={cn(
              "relative",
              isLoading && loadingState === 'awaiting_biometric' && "animate-pulse"
            )}>
              {isLoading ? (
                loadingState === 'awaiting_biometric' ? (
                  <BiometricIcon className="h-10 w-10 text-primary animate-pulse" />
                ) : loadingState === 'authenticating' ? (
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                ) : (
                  <ShieldCheck className="h-10 w-10 text-primary animate-pulse" />
                )
              ) : (
                <BiometricIcon className="h-10 w-10 text-primary" />
              )}
            </div>
            <span className="text-sm font-medium">
              {isLoading ? getLoadingText() : `Entrar com ${biometricLabel}`}
            </span>
          </Button>

          {/* Info sobre tentativas */}
          {isEnabled && getAttemptCount() > 0 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Tentativas: {getAttemptCount()}/{MAX_BIOMETRIC_ATTEMPTS}
                {getAttemptCount() >= MAX_BIOMETRIC_ATTEMPTS && (
                  <span className="text-destructive ml-2 font-medium">Limite atingido</span>
                )}
              </p>
            </div>
          )}

          {/* Link para entrar com senha */}
          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => navigate("/auth", { replace: true })}
              className="text-muted-foreground hover:text-primary"
            >
              Entrar com email e senha
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
