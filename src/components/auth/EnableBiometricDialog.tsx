import { useState } from 'react';
import { Fingerprint, Loader2, ScanFace, CheckCircle2, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useBiometricAuth, BiometricErrorType } from '@/hooks/useBiometricAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EnableBiometricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail?: string;
  onComplete: () => void;
}

type EnrollState = 'idle' | 'enrolling' | 'success' | 'error';

const getErrorDescription = (errorType: BiometricErrorType): string => {
  switch (errorType) {
    case 'NOT_ALLOWED':
      return 'Você cancelou ou negou a permissão. Você pode ativar depois nas configurações.';
    case 'NOT_SUPPORTED':
      return 'Seu dispositivo não suporta autenticação biométrica.';
    case 'SECURITY_ERROR':
      return 'Erro de segurança. Certifique-se de estar em uma conexão segura.';
    case 'TIMEOUT':
      return 'O tempo para registrar expirou. Tente novamente.';
    default:
      return 'Não foi possível ativar a biometria. Você pode tentar novamente mais tarde.';
  }
};

export function EnableBiometricDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  onComplete,
}: EnableBiometricDialogProps) {
  const [enrollState, setEnrollState] = useState<EnrollState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { enableBiometric, isSupported, biometricType } = useBiometricAuth();

  const BiometricIcon = biometricType === 'face' ? ScanFace : Fingerprint;
  const biometricLabel = biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'Touch ID' : 'biometria';

  const handleEnable = async () => {
    setEnrollState('enrolling');
    setErrorMessage(null);
    
    try {
      const result = await enableBiometric(userId, userEmail);
      
      if (result.success) {
        setEnrollState('success');
        toast.success(`${biometricLabel} ativado com sucesso!`);
        
        // Pequeno delay para mostrar o estado de sucesso
        setTimeout(() => {
          onOpenChange(false);
          onComplete();
        }, 1000);
      } else {
        setEnrollState('error');
        const errorDesc = getErrorDescription(result.errorType || 'UNKNOWN');
        setErrorMessage(errorDesc);
        
        // Auto-skip após 3 segundos em caso de erro não recuperável
        if (result.errorType === 'NOT_SUPPORTED' || result.errorType === 'SECURITY_ERROR') {
          setTimeout(() => {
            handleSkip();
          }, 3000);
        }
      }
    } catch (error) {
      setEnrollState('error');
      setErrorMessage('Erro inesperado ao ativar biometria.');
      
      setTimeout(() => {
        handleSkip();
      }, 2000);
    }
  };

  const handleSkip = () => {
    setEnrollState('idle');
    setErrorMessage(null);
    onOpenChange(false);
    onComplete();
  };

  const handleRetry = () => {
    setEnrollState('idle');
    setErrorMessage(null);
  };

  if (!isSupported) {
    return null;
  }

  const isEnrolling = enrollState === 'enrolling';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn(
              "p-4 rounded-full transition-colors duration-300",
              enrollState === 'success' && "bg-green-100 dark:bg-green-900",
              enrollState === 'error' && "bg-destructive/10",
              (enrollState === 'idle' || enrollState === 'enrolling') && "bg-primary/10"
            )}>
              {enrollState === 'success' ? (
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              ) : enrollState === 'error' ? (
                <XCircle className="h-12 w-12 text-destructive" />
              ) : isEnrolling ? (
                <BiometricIcon className="h-12 w-12 text-primary animate-pulse" />
              ) : (
                <BiometricIcon className="h-12 w-12 text-primary" />
              )}
            </div>
          </div>
          
          <AlertDialogTitle>
            {enrollState === 'success' 
              ? `${biometricLabel} ativado!` 
              : enrollState === 'error'
              ? 'Não foi possível ativar'
              : `Ativar ${biometricLabel}?`
            }
          </AlertDialogTitle>
          
          <AlertDialogDescription className="text-center">
            {enrollState === 'success' ? (
              'Você poderá usar sua biometria para desbloquear o app.'
            ) : enrollState === 'error' ? (
              errorMessage
            ) : isEnrolling ? (
              biometricType === 'face' 
                ? 'Olhe para a câmera para registrar seu rosto...'
                : 'Toque no sensor para registrar sua digital...'
            ) : (
              <>
                Use {biometricType === 'face' ? 'reconhecimento facial' : 'sua impressão digital'} para desbloquear 
                o app rapidamente nas próximas vezes.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          {enrollState === 'error' ? (
            <>
              <Button
                onClick={handleRetry}
                className="w-full"
              >
                Tentar novamente
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="w-full"
              >
                Continuar sem biometria
              </Button>
            </>
          ) : enrollState !== 'success' && (
            <>
              <Button
                onClick={handleEnable}
                disabled={isEnrolling}
                className="w-full"
              >
                {isEnrolling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aguardando {biometricLabel}...
                  </>
                ) : (
                  <>
                    <BiometricIcon className="h-4 w-4 mr-2" />
                    Ativar {biometricLabel}
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={isEnrolling}
                className="w-full"
              >
                Agora não
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
