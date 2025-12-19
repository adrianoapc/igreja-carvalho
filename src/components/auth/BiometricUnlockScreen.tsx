import { useState, useEffect } from 'react';
import { Fingerprint, KeyRound, Loader2, ScanFace, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBiometricAuth, BiometricErrorType, triggerHapticFeedback } from '@/hooks/useBiometricAuth';
import logoCarvalho from '@/assets/logo-carvalho.png';
import { cn } from '@/lib/utils';

interface BiometricUnlockScreenProps {
  onUnlocked: () => void;
  onUsePassword: () => void;
  userName?: string;
}

type UnlockState = 'idle' | 'awaiting' | 'verifying' | 'success' | 'error';

const getErrorMessage = (errorType: BiometricErrorType, biometricType: 'face' | 'fingerprint' | 'unknown'): string => {
  const biometricName = biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'impressão digital' : 'biometria';
  
  switch (errorType) {
    case 'NOT_ALLOWED':
      return 'Verificação cancelada. Toque para tentar novamente.';
    case 'NOT_RECOGNIZED':
      return `${biometricType === 'face' ? 'Rosto' : 'Digital'} não reconhecido(a). Tente novamente.`;
    case 'TIMEOUT':
      return 'Tempo esgotado. Toque para tentar novamente.';
    case 'HARDWARE_ERROR':
      return `Erro no sensor de ${biometricName}. Use sua senha.`;
    case 'NOT_FOUND':
      return 'Biometria não configurada. Use sua senha.';
    default:
      return 'Erro na verificação. Tente novamente ou use sua senha.';
  }
};

export function BiometricUnlockScreen({ 
  onUnlocked, 
  onUsePassword,
  userName 
}: BiometricUnlockScreenProps) {
  const [unlockState, setUnlockState] = useState<UnlockState>('idle');
  const [error, setError] = useState<string | null>(null);
  const { verifyBiometric, biometricType } = useBiometricAuth();

  const BiometricIcon = biometricType === 'face' ? ScanFace : Fingerprint;
  const biometricLabel = biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'Touch ID' : 'biometria';

  // Auto-trigger biometric on mount
  useEffect(() => {
    const autoTrigger = async () => {
      await handleBiometricAuth();
    };
    
    const timer = setTimeout(autoTrigger, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleBiometricAuth = async () => {
    setUnlockState('awaiting');
    setError(null);

    try {
      const result = await verifyBiometric();

      if (result.success) {
        setUnlockState('success');
        triggerHapticFeedback('success');
        // Pequeno delay para mostrar o estado de sucesso
        setTimeout(() => {
          onUnlocked();
        }, 300);
      } else {
        setUnlockState('error');
        const errorMessage = getErrorMessage(result.errorType || 'UNKNOWN', biometricType);
        setError(errorMessage);
        
        // Se for erro de hardware ou não encontrado, sugerir senha
        if (result.errorType === 'HARDWARE_ERROR' || result.errorType === 'NOT_FOUND') {
          setTimeout(() => {
            onUsePassword();
          }, 2000);
        }
      }
    } catch (err) {
      console.error('Biometric error:', err);
      setUnlockState('error');
      setError('Erro inesperado na autenticação biométrica.');
    }
  };

  const getStatusText = () => {
    switch (unlockState) {
      case 'awaiting':
        return biometricType === 'face' ? 'Olhe para a câmera...' : 'Toque no sensor...';
      case 'verifying':
        return 'Verificando...';
      case 'success':
        return 'Desbloqueado!';
      case 'error':
        return 'Toque para tentar novamente';
      default:
        return `Toque para usar ${biometricLabel}`;
    }
  };

  const isAuthenticating = unlockState === 'awaiting' || unlockState === 'verifying';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={logoCarvalho} 
              alt="Logo" 
              className="h-16 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <CardTitle className="text-xl">
              {userName ? `Olá, ${userName.split(' ')[0]}!` : 'Bem-vindo de volta!'}
            </CardTitle>
            <CardDescription className="mt-2">
              Use {biometricLabel} para desbloquear
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            size="lg"
            className={cn(
              "w-full h-28 flex-col gap-3 border-2 transition-all duration-300",
              unlockState === 'success' && "border-green-500 bg-green-50 dark:bg-green-950",
              unlockState === 'error' && "border-destructive bg-destructive/5",
              isAuthenticating && "border-primary bg-primary/5"
            )}
            onClick={handleBiometricAuth}
            disabled={isAuthenticating || unlockState === 'success'}
          >
            <div className="relative">
              {unlockState === 'success' ? (
                <ShieldCheck className="h-10 w-10 text-green-500" />
              ) : isAuthenticating ? (
                unlockState === 'awaiting' ? (
                  <BiometricIcon className="h-10 w-10 text-primary animate-pulse" />
                ) : (
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                )
              ) : (
                <BiometricIcon className={cn(
                  "h-10 w-10",
                  unlockState === 'error' ? "text-destructive" : "text-primary"
                )} />
              )}
            </div>
            <span className={cn(
              "text-sm font-medium",
              unlockState === 'success' && "text-green-600 dark:text-green-400",
              unlockState === 'error' && "text-destructive"
            )}>
              {getStatusText()}
            </span>
          </Button>

          {error && (
            <p className="text-sm text-destructive text-center animate-in fade-in slide-in-from-top-1">
              {error}
            </p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            variant="ghost"
            className="w-full"
            onClick={onUsePassword}
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Entrar com senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
