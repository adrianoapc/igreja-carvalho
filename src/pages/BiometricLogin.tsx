import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fingerprint, Loader2, AlertTriangle } from "lucide-react";
import logoCarvalho from "@/assets/logo-carvalho.png";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppConfig } from "@/hooks/useAppConfig";

const MAX_BIOMETRIC_ATTEMPTS = 3;
const BIOMETRIC_ATTEMPTS_KEY = 'biometric_attempts';
const BIOMETRIC_TIMESTAMP_KEY = 'biometric_timestamp';
const ATTEMPTS_RESET_TIME = 5 * 60 * 1000; // 5 minutos

export default function BiometricLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const { isEnabled, verifyBiometric, getRefreshToken, getAccessToken, clearRefreshToken } = useBiometricAuth();
  const { config, isLoading: isConfigLoading } = useAppConfig();

  // Verificar se já tem sessão ativa
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Usuário já autenticado, ir para dashboard
          navigate("/dashboard", { replace: true });
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

    // Reset se passou 5 minutos
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

  const handleBiometricLogin = async () => {
    // Se não tem biometria habilitada, ir para login normal
    if (!isEnabled) {
      navigate("/auth", { replace: true });
      return;
    }

    setIsLoading(true);
    const currentAttempts = getAttemptCount();

    try {
      // Se já tentou 3x, ir direto para senha
      if (currentAttempts >= MAX_BIOMETRIC_ATTEMPTS) {
        toast({
          title: "Limite de tentativas atingido",
          description: "Por favor, use sua senha para entrar.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return;
      }

      console.log('[BiometricLogin] Tentando verificar biometria...');
      
      // Tentar verificar biometria
      const success = await verifyBiometric();

      if (success) {
        console.log('[BiometricLogin] Biometria verificada com sucesso!');
        
        const refreshToken = getRefreshToken();
        const accessToken = getAccessToken();
        
        console.log('[BiometricLogin] Checking tokens:', {
          hasRefreshToken: !!refreshToken,
          refreshTokenLength: refreshToken ? refreshToken.length : 0,
          hasAccessToken: !!accessToken,
          accessTokenLength: accessToken ? accessToken.length : 0,
        });
        
        if (!refreshToken && !accessToken) {
          console.error('[BiometricLogin] Nenhum token armazenado (refresh ou access)');
          incrementAttempts();
          toast({
            title: "Erro",
            description: "Dados de autenticação não encontrados. Use sua senha.",
            variant: "destructive",
          });
          setTimeout(() => {
            navigate("/auth", { replace: true });
          }, 1000);
          return;
        }

        // Tentar com refresh token primeiro (melhor opção)
        let sessionData = null;
        let sessionError = null;

        if (refreshToken) {
          console.log('[BiometricLogin] Attempting to refresh session with refresh_token...');
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

        // Fallback para access token se refresh falhar
        if ((!sessionData?.session || sessionError) && accessToken) {
          console.log('[BiometricLogin] Refresh token failed, trying with access_token fallback...');
          
          try {
            // Usar setSession com access_token como fallback
            const result = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '', // Pode estar vazio
            });
            
            if (result.error) {
              throw result.error;
            }
            
            sessionData = result.data;
            sessionError = null;
            
            console.log('[BiometricLogin] Access token fallback successful:', {
              hasSession: !!sessionData?.session,
              hasUser: !!sessionData?.session?.user,
              userId: sessionData?.session?.user?.id,
            });
          } catch (fallbackError) {
            console.error('[BiometricLogin] Access token fallback also failed:', fallbackError);
            sessionError = fallbackError as any;
          }
        }

        if (sessionError || !sessionData?.session) {
          console.error('[BiometricLogin] Erro ao restaurar sessão:', sessionError);
          clearRefreshToken();
          incrementAttempts();
          toast({
            title: "Sessão expirada",
            description: "Por favor, use sua senha para entrar novamente.",
            variant: "destructive",
          });
          setTimeout(() => {
            navigate("/auth", { replace: true });
          }, 1000);
          return;
        }

        // Sucesso! Limpar tentativas e ir para dashboard
        resetAttempts();
        
        toast({
          title: "Bem-vindo!",
          description: "Autenticação bem-sucedida.",
        });
        
        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 500);
      } else {
        // Falha na biometria
        console.log('[BiometricLogin] Biometria falhou');
        incrementAttempts();
        const newCount = getAttemptCount();
        const remaining = MAX_BIOMETRIC_ATTEMPTS - newCount;

        if (remaining <= 0) {
          toast({
            title: "Limite de tentativas atingido",
            description: "Por favor, use sua senha para entrar.",
            variant: "destructive",
          });
          setTimeout(() => {
            navigate("/auth", { replace: true });
          }, 1000);
        } else {
          toast({
            title: "Biometria não reconhecida",
            description: `${remaining} ${remaining === 1 ? "tentativa" : "tentativas"} restantes`,
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error("[BiometricLogin] Erro:", error);
      incrementAttempts();
      const newCount = getAttemptCount();
      const remaining = MAX_BIOMETRIC_ATTEMPTS - newCount;

      if (remaining <= 0) {
        toast({
          title: "Limite de tentativas atingido",
          description: "Por favor, use sua senha para entrar.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate("/auth", { replace: true });
        }, 1000);
      } else {
        toast({
          title: "Erro",
          description: `Erro ao verificar biometria. ${remaining} ${remaining === 1 ? "tentativa" : "tentativas"} restantes`,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex flex-col items-center justify-center p-4">
      {/* Aviso de manutenção */}
      {!isConfigLoading && config.maintenance_mode && (
        <div className="w-full max-w-sm mb-4">
          <Card className="bg-orange-500 text-white border-0 shadow-md">
            <div className="px-3 py-2 flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Modo de manutenção ativo</p>
                <p className="text-xs opacity-90">
                  {config.maintenance_message || "O sistema está em manutenção. Apenas admins e técnicos têm acesso completo."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="w-full max-w-sm">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <img
              src={logoCarvalho}
              alt="Igreja Carvalho"
              className="h-16 w-auto mx-auto mb-3"
            />
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Fingerprint className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Entrar</h2>
            </div>
            <p className="text-muted-foreground">Use a biometria para acessar</p>
          </div>

          <Button
            onClick={handleBiometricLogin}
            disabled={isLoading}
            size="lg"
            className="w-full gap-2 h-12 text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Fingerprint className="h-5 w-5" />
                Entrar
              </>
            )}
          </Button>

          {/* Info sobre tentativas */}
          {isEnabled && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {getAttemptCount() > 0 && (
                  <>
                    Tentativas: {getAttemptCount()}/{MAX_BIOMETRIC_ATTEMPTS}
                    {getAttemptCount() >= MAX_BIOMETRIC_ATTEMPTS && (
                      <span className="text-destructive ml-2">Limite atingido</span>
                    )}
                  </>
                )}
              </p>
            </div>
          )}

          {/* Link para entrar com senha */}
          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => navigate("/auth", { replace: true })}
              className="text-primary hover:underline"
            >
              Entrar com email e senha
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
