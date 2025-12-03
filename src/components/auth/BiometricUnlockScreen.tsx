import { useState, useEffect } from 'react';
import { Fingerprint, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import logoCarvalho from '@/assets/logo-carvalho.png';

interface BiometricUnlockScreenProps {
  onUnlocked: () => void;
  onUsePassword: () => void;
  userName?: string;
}

export function BiometricUnlockScreen({ 
  onUnlocked, 
  onUsePassword,
  userName 
}: BiometricUnlockScreenProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { verifyBiometric, authenticateWithBiometric } = useBiometricAuth();

  // Auto-trigger biometric on mount
  useEffect(() => {
    const autoTrigger = async () => {
      await handleBiometricAuth();
    };
    
    // Small delay to ensure UI is ready
    const timer = setTimeout(autoTrigger, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleBiometricAuth = async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      // Try verification first, then authentication
      let success = await verifyBiometric();
      
      if (!success) {
        success = await authenticateWithBiometric();
      }

      if (success) {
        onUnlocked();
      } else {
        setError('Autenticação biométrica falhou. Tente novamente ou use sua senha.');
      }
    } catch (err) {
      setError('Erro na autenticação biométrica.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={logoCarvalho} 
              alt="Logo" 
              className="h-16 w-auto"
            />
          </div>
          <div>
            <CardTitle className="text-xl">
              {userName ? `Olá, ${userName.split(' ')[0]}!` : 'Bem-vindo de volta!'}
            </CardTitle>
            <CardDescription className="mt-2">
              Use sua biometria para desbloquear
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            size="lg"
            className="w-full h-24 flex-col gap-2"
            onClick={handleBiometricAuth}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm">Verificando...</span>
              </>
            ) : (
              <>
                <Fingerprint className="h-8 w-8 text-primary" />
                <span className="text-sm">Toque para desbloquear</span>
              </>
            )}
          </Button>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
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
