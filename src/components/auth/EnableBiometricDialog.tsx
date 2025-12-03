import { useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { toast } from 'sonner';

interface EnableBiometricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onComplete: () => void;
}

export function EnableBiometricDialog({
  open,
  onOpenChange,
  userId,
  onComplete,
}: EnableBiometricDialogProps) {
  const [isEnabling, setIsEnabling] = useState(false);
  const { enableBiometric, isSupported } = useBiometricAuth();

  const handleEnable = async () => {
    setIsEnabling(true);
    
    try {
      const success = await enableBiometric(userId);
      
      if (success) {
        toast.success('Biometria ativada com sucesso!');
        onOpenChange(false);
        onComplete();
      } else {
        toast.error('Não foi possível ativar a biometria. Seu dispositivo pode não suportar esta funcionalidade.');
      }
    } catch (error) {
      toast.error('Erro ao ativar biometria.');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    onComplete();
  };

  if (!isSupported) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Fingerprint className="h-12 w-12 text-primary" />
            </div>
          </div>
          <AlertDialogTitle>Ativar Biometria?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Use sua impressão digital ou reconhecimento facial para desbloquear o app rapidamente nas próximas vezes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleEnable}
            disabled={isEnabling}
            className="w-full"
          >
            {isEnabling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Ativando...
              </>
            ) : (
              <>
                <Fingerprint className="h-4 w-4 mr-2" />
                Ativar Biometria
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isEnabling}
            className="w-full"
          >
            Agora não
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
