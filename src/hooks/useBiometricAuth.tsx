import { useState, useEffect, useCallback } from 'react';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_USER_KEY = 'biometric_user_id';
const BIOMETRIC_CREDENTIAL_KEY = 'biometric_credential_id';
const BIOMETRIC_REFRESH_TOKEN_KEY = 'biometric_refresh_token';
const LAST_EMAIL_KEY = 'last_login_email';
const BIOMETRIC_TEST_MODE_KEY = 'biometric_test_mode'; // Para desenvolvimento

interface BiometricAuthState {
  isSupported: boolean;
  isEnabled: boolean;
  isLoading: boolean;
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

export function useBiometricAuth() {
  const [state, setState] = useState<BiometricAuthState>({
    isSupported: false,
    isEnabled: false,
    isLoading: true,
  });

  const checkSupport = useCallback(async () => {
    // Permitir modo teste via localStorage
    const testMode = localStorage.getItem(BIOMETRIC_TEST_MODE_KEY) === 'true';

    // Check if WebAuthn is supported
    const hasWebAuthn = !!(
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential === 'function'
    );

    // Check if running in iframe (WebAuthn doesn't work in iframes)
    const isInIframe = window.self !== window.top;

    // Check if platform authenticator (Touch ID, Face ID) is available
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

    console.log('[BiometricAuth] Support check:', {
      testMode,
      hasWebAuthn,
      hasPlatformAuth,
      isInIframe,
      isSupported,
    });

    const isEnabled = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
    const storedUserId = localStorage.getItem(BIOMETRIC_USER_KEY);
    const storedCredentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);

    setState({
      isSupported,
      isEnabled: isEnabled && !!storedUserId && !!storedCredentialId && isSupported,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  const enableBiometric = useCallback(async (userId: string): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn('Biometric authentication not supported');
      return false;
    }

    try {
      const testMode = localStorage.getItem(BIOMETRIC_TEST_MODE_KEY) === 'true';

      // Em modo teste, simular biometria sem WebAuthn
      if (testMode) {
        console.log('[BiometricAuth] Test mode: simulating biometric enrollment');
        const credentialId = 'test-credential-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        localStorage.setItem(BIOMETRIC_USER_KEY, userId);
        localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
        setState(prev => ({ ...prev, isEnabled: true }));
        return true;
      }

      // Check if platform authenticator is available (fingerprint, face ID)
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      
      if (!available) {
        console.warn('Platform authenticator not available');
        return false;
      }

      // Create a challenge for biometric registration
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'App Carvalho',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(userId),
            name: 'user@app',
            displayName: 'Usuário',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
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
        return false;
      }

      // Store credential ID for later verification
      const credentialId = arrayBufferToBase64(credential.rawId);
      
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      localStorage.setItem(BIOMETRIC_USER_KEY, userId);
      localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);

      setState(prev => ({ ...prev, isEnabled: true }));
      return true;
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return false;
    }
  }, [state.isSupported]);

  const disableBiometric = useCallback(() => {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(BIOMETRIC_USER_KEY);
    localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
    setState(prev => ({ ...prev, isEnabled: false }));
  }, []);

  const verifyBiometric = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !state.isEnabled) {
      return false;
    }

    const storedCredentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
    if (!storedCredentialId) {
      return false;
    }

    try {
      const testMode = localStorage.getItem(BIOMETRIC_TEST_MODE_KEY) === 'true';

      // Em modo teste, simular verificação de biometria
      if (testMode) {
        console.log('[BiometricAuth] Test mode: simulating biometric verification');
        return true;
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Request biometric verification using stored credential
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

      return !!credential;
    } catch (error: any) {
      console.error('Biometric verification error:', error);
      return false;
    }
  }, [state.isSupported, state.isEnabled]);

  const authenticateWithBiometric = useCallback(async (): Promise<boolean> => {
    // For backward compatibility, just call verifyBiometric
    return verifyBiometric();
  }, [verifyBiometric]);

  const getStoredUserId = useCallback((): string | null => {
    return localStorage.getItem(BIOMETRIC_USER_KEY);
  }, []);

  // Refresh token storage functions (para login automático)
  const saveRefreshToken = useCallback((refreshToken: string) => {
    localStorage.setItem(BIOMETRIC_REFRESH_TOKEN_KEY, refreshToken);
  }, []);

  const getRefreshToken = useCallback((): string | null => {
    return localStorage.getItem(BIOMETRIC_REFRESH_TOKEN_KEY);
  }, []);

  const clearRefreshToken = useCallback(() => {
    localStorage.removeItem(BIOMETRIC_REFRESH_TOKEN_KEY);
  }, []);

  // Email storage functions
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
    // Refresh token functions
    saveRefreshToken,
    getRefreshToken,
    clearRefreshToken,
    // Email functions
    saveLastEmail,
    getLastEmail,
    clearLastEmail,
  };
}
