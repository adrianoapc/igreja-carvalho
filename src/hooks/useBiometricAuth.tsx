import { useState, useEffect, useCallback } from 'react';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_USER_KEY = 'biometric_user_id';

interface BiometricAuthState {
  isSupported: boolean;
  isEnabled: boolean;
  isLoading: boolean;
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

    setState({
      isSupported,
      isEnabled: isEnabled && !!storedUserId,
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

      // Store biometric preference
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      localStorage.setItem(BIOMETRIC_USER_KEY, userId);

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
    setState(prev => ({ ...prev, isEnabled: false }));
  }, []);

  const authenticateWithBiometric = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !state.isEnabled) {
      return false;
    }

    try {
      // Create a challenge for biometric verification
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const storedUserId = localStorage.getItem(BIOMETRIC_USER_KEY);
      if (!storedUserId) {
        return false;
      }

      // Request biometric authentication using WebAuthn
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'App Carvalho',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(storedUserId),
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
          },
          timeout: 60000,
        },
      });

      return !!credential;
    } catch (error: any) {
      // User cancelled or biometric failed
      if (error.name === 'NotAllowedError') {
        console.log('Biometric authentication cancelled by user');
        return false;
      }
      console.error('Biometric authentication error:', error);
      return false;
    }
  }, [state.isSupported, state.isEnabled]);

  const verifyBiometric = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      return false;
    }

    try {
      // Simple biometric verification using platform authenticator
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      
      if (!available) {
        return false;
      }

      // Create assertion request to trigger biometric
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Use a simpler approach - just trigger the authenticator
      const result = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          rpId: window.location.hostname,
        },
      });

      return !!result;
    } catch (error: any) {
      // If no credentials exist, try creating one (first time setup verification)
      if (error.name === 'NotAllowedError') {
        return false;
      }
      
      // For other errors, fall back to simple device unlock
      try {
        return await authenticateWithBiometric();
      } catch {
        return false;
      }
    }
  }, [state.isSupported, authenticateWithBiometric]);

  const getStoredUserId = useCallback((): string | null => {
    return localStorage.getItem(BIOMETRIC_USER_KEY);
  }, []);

  return {
    ...state,
    enableBiometric,
    disableBiometric,
    authenticateWithBiometric,
    verifyBiometric,
    getStoredUserId,
    checkSupport,
  };
}
