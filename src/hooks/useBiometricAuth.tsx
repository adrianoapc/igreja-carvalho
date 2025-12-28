import { useState, useEffect, useCallback } from 'react';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_USER_KEY = 'biometric_user_id';
const BIOMETRIC_CREDENTIAL_KEY = 'biometric_credential_id';
const BIOMETRIC_REFRESH_TOKEN_KEY = 'biometric_refresh_token';
const BIOMETRIC_ACCESS_TOKEN_KEY = 'biometric_access_token';
const LAST_EMAIL_KEY = 'last_login_email';
const BIOMETRIC_TEST_MODE_KEY = 'biometric_test_mode';

// Tipos de erro específicos para WebAuthn
export type BiometricErrorType = 
  | 'NOT_ALLOWED' // Usuário cancelou ou negou
  | 'NOT_SUPPORTED' // Dispositivo não suporta
  | 'SECURITY_ERROR' // Erro de segurança (domínio, etc)
  | 'TIMEOUT' // Timeout
  | 'ABORT' // Abortado
  | 'NOT_FOUND' // Credencial não encontrada
  | 'NOT_RECOGNIZED' // Biometria não reconhecida
  | 'HARDWARE_ERROR' // Erro de hardware
  | 'UNKNOWN'; // Erro desconhecido

export interface BiometricResult {
  success: boolean;
  errorType?: BiometricErrorType;
  errorMessage?: string;
}

interface BiometricAuthState {
  isSupported: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  biometricType: 'face' | 'fingerprint' | 'unknown';
}

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Detecta tipo de biometria baseado no dispositivo
function detectBiometricType(): 'face' | 'fingerprint' | 'unknown' {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // iOS devices com Face ID (iPhone X e posteriores)
  if (/iphone/.test(userAgent)) {
    // iPhone X e posteriores geralmente usam Face ID
    // Podemos inferir pelo tamanho da tela ou modelo
    const screenHeight = window.screen.height;
    const screenWidth = window.screen.width;
    const ratio = screenHeight / screenWidth;
    
    // iPhones com Face ID têm ratio maior que 2 (notch design)
    if (ratio > 2 || screenHeight >= 812) {
      return 'face';
    }
    return 'fingerprint'; // iPhone 8 e anteriores com Touch ID
  }
  
  // iPads podem ter Face ID ou Touch ID
  if (/ipad/.test(userAgent)) {
    // iPads Pro mais recentes têm Face ID
    if (window.screen.width >= 1024) {
      return 'face';
    }
    return 'fingerprint';
  }
  
  // Android - maioria usa fingerprint
  if (/android/.test(userAgent)) {
    return 'fingerprint';
  }
  
  // MacBooks com Touch ID
  if (/macintosh/.test(userAgent)) {
    return 'fingerprint';
  }
  
  return 'unknown';
}

// Mapeia erros WebAuthn para tipos específicos
function parseWebAuthnError(error: unknown): { type: BiometricErrorType; message: string } {
  const errorName = error?.name || '';
  const errorMessage = error?.message || 'Erro desconhecido';
  
  switch (errorName) {
    case 'NotAllowedError':
      // Usuário cancelou ou negou a verificação
      if (errorMessage.includes('cancelled') || errorMessage.includes('denied')) {
        return { type: 'NOT_ALLOWED', message: 'Você cancelou a verificação biométrica.' };
      }
      return { type: 'NOT_ALLOWED', message: 'Permissão negada para usar biometria.' };
      
    case 'NotSupportedError':
      return { type: 'NOT_SUPPORTED', message: 'Seu dispositivo não suporta esta funcionalidade.' };
      
    case 'SecurityError':
      return { type: 'SECURITY_ERROR', message: 'Erro de segurança. Verifique se está em uma conexão segura.' };
      
    case 'AbortError':
      return { type: 'ABORT', message: 'A operação foi cancelada.' };
      
    case 'InvalidStateError':
      return { type: 'NOT_FOUND', message: 'Credencial não encontrada. Reconfigure a biometria.' };
      
    case 'NotFoundError':
      return { type: 'NOT_FOUND', message: 'Credencial biométrica não encontrada.' };
      
    case 'ConstraintError':
      return { type: 'HARDWARE_ERROR', message: 'Erro no sensor biométrico.' };
      
    default:
      if (errorMessage.includes('timeout')) {
        return { type: 'TIMEOUT', message: 'Tempo esgotado. Tente novamente.' };
      }
      if (errorMessage.includes('not recognized') || errorMessage.includes('failed')) {
        return { type: 'NOT_RECOGNIZED', message: 'Biometria não reconhecida. Tente novamente.' };
      }
      return { type: 'UNKNOWN', message: errorMessage };
  }
}

// Haptic feedback para dispositivos móveis
export function triggerHapticFeedback(type: 'success' | 'error' | 'warning') {
  if ('vibrate' in navigator) {
    switch (type) {
      case 'success':
        navigator.vibrate(50); // Vibração curta para sucesso
        break;
      case 'error':
        navigator.vibrate([100, 50, 100]); // Padrão duplo para erro
        break;
      case 'warning':
        navigator.vibrate([50, 30, 50, 30, 50]); // Padrão triplo para aviso
        break;
    }
  }
}

export function useBiometricAuth() {
  const [state, setState] = useState<BiometricAuthState>({
    isSupported: false,
    isEnabled: false,
    isLoading: true,
    biometricType: 'unknown',
  });

  const checkSupport = useCallback(async () => {
    const testMode = localStorage.getItem(BIOMETRIC_TEST_MODE_KEY) === 'true';

    const hasWebAuthn = !!(
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential === 'function'
    );

    const isInIframe = window.self !== window.top;

    let hasPlatformAuth = false;
    if (hasWebAuthn && !isInIframe) {
      try {
        hasPlatformAuth = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch (error) {
        console.warn('Error checking platform auth availability:', error);
        hasPlatformAuth = false;
      }
    }

    const isSupported = testMode || (hasWebAuthn && hasPlatformAuth && !isInIframe);
    const biometricType = detectBiometricType();

    console.log('[BiometricAuth] Support check:', {
      testMode,
      hasWebAuthn,
      hasPlatformAuth,
      isInIframe,
      isSupported,
      biometricType,
    });

    const isEnabled = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
    const storedUserId = localStorage.getItem(BIOMETRIC_USER_KEY);
    const storedCredentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
    const storedEmail = localStorage.getItem('last_login_email');
    const storedRefreshToken = localStorage.getItem(BIOMETRIC_REFRESH_TOKEN_KEY) || sessionStorage.getItem(BIOMETRIC_REFRESH_TOKEN_KEY);

    console.log('[BiometricAuth] checkSupport - localStorage state:', {
      biometric_enabled: isEnabled,
      biometric_user_id: storedUserId,
      biometric_credential_id: storedCredentialId ? 'exists' : 'missing',
      last_login_email: storedEmail,
      biometric_refresh_token: storedRefreshToken ? 'exists' : 'missing',
    });

    setState({
      isSupported,
      isEnabled: isEnabled && !!storedUserId && !!storedCredentialId && isSupported,
      isLoading: false,
      biometricType,
    });
  }, []);

  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  const enableBiometric = useCallback(async (userId: string, userEmail?: string): Promise<BiometricResult> => {
    if (!state.isSupported) {
      console.warn('Biometric authentication not supported');
      return { success: false, errorType: 'NOT_SUPPORTED', errorMessage: 'Biometria não suportada neste dispositivo.' };
    }

    try {
      const testMode = localStorage.getItem(BIOMETRIC_TEST_MODE_KEY) === 'true';

      if (testMode) {
        console.log('[BiometricAuth] Test mode: simulating biometric enrollment');
        const credentialId = 'test-credential-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        localStorage.setItem(BIOMETRIC_USER_KEY, userId);
        localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
        setState(prev => ({ ...prev, isEnabled: true }));
        triggerHapticFeedback('success');
        return { success: true };
      }

      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      
      if (!available) {
        console.warn('Platform authenticator not available');
        return { success: false, errorType: 'NOT_SUPPORTED', errorMessage: 'Autenticador de plataforma não disponível.' };
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const displayEmail = userEmail || 'usuario@app';
      const displayName = userEmail ? userEmail.split('@')[0] : 'Usuário';

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'App Carvalho',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(userId),
            name: displayEmail,
            displayName: displayName,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;

      if (!credential) {
        return { success: false, errorType: 'NOT_ALLOWED', errorMessage: 'Nenhuma credencial foi criada.' };
      }

      const credentialId = arrayBufferToBase64(credential.rawId);
      
      console.log('[BiometricAuth] enableBiometric - Saving biometric data:', {
        userId,
        userEmail,
        credentialIdLength: credentialId.length,
      });
      
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      localStorage.setItem(BIOMETRIC_USER_KEY, userId);
      localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);

      setState(prev => ({ ...prev, isEnabled: true }));
      triggerHapticFeedback('success');
      return { success: true };
    } catch (error: unknown) {
      console.error('Error enabling biometric:', error);
      const parsed = parseWebAuthnError(error);
      triggerHapticFeedback('error');
      return { success: false, errorType: parsed.type, errorMessage: parsed.message };
    }
  }, [state.isSupported]);

  const disableBiometric = useCallback(() => {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(BIOMETRIC_USER_KEY);
    localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
    setState(prev => ({ ...prev, isEnabled: false }));
  }, []);

  const verifyBiometric = useCallback(async (): Promise<BiometricResult> => {
    if (!state.isSupported) {
      return { success: false, errorType: 'NOT_SUPPORTED', errorMessage: 'Biometria não suportada.' };
    }
    
    if (!state.isEnabled) {
      return { success: false, errorType: 'NOT_FOUND', errorMessage: 'Biometria não está habilitada.' };
    }

    const storedCredentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
    if (!storedCredentialId) {
      return { success: false, errorType: 'NOT_FOUND', errorMessage: 'Credencial não encontrada.' };
    }

    try {
      const testMode = localStorage.getItem(BIOMETRIC_TEST_MODE_KEY) === 'true';

      if (testMode) {
        console.log('[BiometricAuth] Test mode: simulating biometric verification');
        triggerHapticFeedback('success');
        return { success: true };
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          rpId: window.location.hostname,
          allowCredentials: [{
            id: base64ToArrayBuffer(storedCredentialId),
            type: 'public-key',
            transports: ['internal'],
          }],
        },
      });

      if (credential) {
        triggerHapticFeedback('success');
        return { success: true };
      }
      
      triggerHapticFeedback('error');
      return { success: false, errorType: 'NOT_RECOGNIZED', errorMessage: 'Biometria não reconhecida.' };
    } catch (error: unknown) {
      console.error('Biometric verification error:', error);
      const parsed = parseWebAuthnError(error);
      triggerHapticFeedback('error');
      return { success: false, errorType: parsed.type, errorMessage: parsed.message };
    }
  }, [state.isSupported, state.isEnabled]);

  const authenticateWithBiometric = useCallback(async (): Promise<BiometricResult> => {
    return verifyBiometric();
  }, [verifyBiometric]);

  const getStoredUserId = useCallback((): string | null => {
    return localStorage.getItem(BIOMETRIC_USER_KEY);
  }, []);

  const saveRefreshToken = useCallback((refreshToken: string) => {
    sessionStorage.setItem(BIOMETRIC_REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(BIOMETRIC_REFRESH_TOKEN_KEY, refreshToken);
  }, []);

  const getRefreshToken = useCallback((): string | null => {
    return sessionStorage.getItem(BIOMETRIC_REFRESH_TOKEN_KEY) || localStorage.getItem(BIOMETRIC_REFRESH_TOKEN_KEY);
  }, []);

  const clearRefreshToken = useCallback(() => {
    sessionStorage.removeItem(BIOMETRIC_REFRESH_TOKEN_KEY);
    localStorage.removeItem(BIOMETRIC_REFRESH_TOKEN_KEY);
  }, []);

  const saveAccessToken = useCallback((accessToken: string) => {
    sessionStorage.setItem(BIOMETRIC_ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(BIOMETRIC_ACCESS_TOKEN_KEY, accessToken);
  }, []);

  const getAccessToken = useCallback((): string | null => {
    return sessionStorage.getItem(BIOMETRIC_ACCESS_TOKEN_KEY) || localStorage.getItem(BIOMETRIC_ACCESS_TOKEN_KEY);
  }, []);

  const clearAccessToken = useCallback(() => {
    sessionStorage.removeItem(BIOMETRIC_ACCESS_TOKEN_KEY);
    localStorage.removeItem(BIOMETRIC_ACCESS_TOKEN_KEY);
  }, []);

  const saveLastEmail = useCallback((email: string) => {
    localStorage.setItem(LAST_EMAIL_KEY, email);
  }, []);

  const getLastEmail = useCallback((): string | null => {
    return localStorage.getItem(LAST_EMAIL_KEY);
  }, []);

  const clearLastEmail = useCallback(() => {
    localStorage.removeItem(LAST_EMAIL_KEY);
  }, []);

  return {
    ...state,
    enableBiometric,
    disableBiometric,
    authenticateWithBiometric,
    verifyBiometric,
    getStoredUserId,
    checkSupport,
    saveRefreshToken,
    getRefreshToken,
    clearRefreshToken,
    saveAccessToken,
    getAccessToken,
    clearAccessToken,
    saveLastEmail,
    getLastEmail,
    clearLastEmail,
  };
}
