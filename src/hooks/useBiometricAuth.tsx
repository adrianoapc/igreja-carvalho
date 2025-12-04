import { useState, useEffect, useCallback } from 'react';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_USER_KEY = 'biometric_user_id';
const BIOMETRIC_CREDENTIAL_KEY = 'biometric_credential_id';
const LAST_EMAIL_KEY = 'last_login_email';

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

  useEffect(() => {
    checkSupport();
  }, []);

  const checkSupport = useCallback(() => {
    // Check if WebAuthn is supported
    const isSupported = !!(
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential === 'function'
    );

    const isEnabled = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
    const storedUserId = localStorage.getItem(BIOMETRIC_USER_KEY);
    const storedCredentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);

    setState({
      isSupported,
      isEnabled: isEnabled && !!storedUserId && !!storedCredentialId,
      isLoading: false,
    });
  }, []);

  const enableBiometric = useCallback(async (userId: string): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn('Biometric authentication not supported');
      return false;
    }

    try {
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
    // Email functions
    saveLastEmail,
    getLastEmail,
    clearLastEmail,
  };
}
