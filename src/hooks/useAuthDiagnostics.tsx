/**
 * Hook para diagnóstico detalhado de tokens Supabase
 * Detecta problemas com refresh_token e access_token
 */

import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TokenDiagnostics {
  refreshToken: {
    value: string | null;
    length: number;
    isValid: boolean;
    format: "jwt" | "invalid" | "none";
  };
  accessToken: {
    value: string | null;
    length: number;
    isValid: boolean;
    format: "jwt" | "invalid" | "none";
  };
  session: {
    exists: boolean;
    userId: string | null;
    expiresAt: number | null;
    expiresIn: number | null;
  };
}

// Verificar se um token é um JWT válido
function isValidJWT(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

// Detectar formato de token
function detectTokenFormat(token: string | null): "jwt" | "invalid" | "none" {
  if (!token) return "none";
  if (isValidJWT(token)) return "jwt";
  return "invalid";
}

export function useAuthDiagnostics() {
  const diagnoseTokens = useCallback(async (): Promise<TokenDiagnostics> => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      const refreshToken = session?.refresh_token;
      const accessToken = session?.access_token;

      console.log("[Diagnostics] Raw Session Data:", {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        refreshTokenType: typeof refreshToken,
        accessTokenType: typeof accessToken,
      });

      const diagnostics: TokenDiagnostics = {
        refreshToken: {
          value: refreshToken || null,
          length: refreshToken?.length || 0,
          isValid: isValidJWT(refreshToken),
          format: detectTokenFormat(refreshToken),
        },
        accessToken: {
          value: accessToken || null,
          length: accessToken?.length || 0,
          isValid: isValidJWT(accessToken),
          format: detectTokenFormat(accessToken),
        },
        session: {
          exists: !!session,
          userId: session?.user?.id || null,
          expiresAt: session?.expires_at || null,
          expiresIn: session?.expires_in || null,
        },
      };

      console.log("[Diagnostics] Token Analysis:", {
        refreshToken: {
          ...diagnostics.refreshToken,
          value: diagnostics.refreshToken.value
            ? diagnostics.refreshToken.value.substring(0, 50) + "..."
            : null,
        },
        accessToken: {
          ...diagnostics.accessToken,
          value: diagnostics.accessToken.value
            ? diagnostics.accessToken.value.substring(0, 50) + "..."
            : null,
        },
        session: diagnostics.session,
      });

      return diagnostics;
    } catch (error) {
      console.error("[Diagnostics] Error during diagnosis:", error);
      throw error;
    }
  }, []);

  const testRefreshToken = useCallback(async (refreshToken: string | null) => {
    if (!refreshToken) {
      console.warn("[Diagnostics] No refresh token provided");
      return { success: false, error: "No refresh token provided" };
    }

    try {
      console.log("[Diagnostics] Testing refresh token:", {
        tokenLength: refreshToken.length,
        tokenStart: refreshToken.substring(0, 50),
        isJWT: isValidJWT(refreshToken),
      });

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        console.error("[Diagnostics] Refresh failed:", {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStatus: (error as unknown as Record<string, unknown>).status,
          errorCode: (error as unknown as Record<string, unknown>).code,
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      console.log("[Diagnostics] Refresh successful:", {
        hasNewSession: !!data.session,
        hasNewAccessToken: !!data.session?.access_token,
        hasNewRefreshToken: !!data.session?.refresh_token,
      });

      return { success: true, data };
    } catch (error) {
      console.error("[Diagnostics] Exception during refresh test:", error);
      return { success: false, error: String(error) };
    }
  }, []);

  const analyzeRefreshTokenProblem = useCallback(async () => {
    console.log("=== FULL AUTH DIAGNOSTICS ===");

    try {
      // 1. Current session diagnostics
      const diagnostics = await diagnoseTokens();

      // 2. Check stored tokens in localStorage
      const storedRefresh = localStorage.getItem("biometric_refresh_token");
      const storedAccess = localStorage.getItem("biometric_access_token");

      console.log("[Diagnostics] Stored Tokens:", {
        refreshToken: {
          exists: !!storedRefresh,
          length: storedRefresh?.length || 0,
          format: detectTokenFormat(storedRefresh),
        },
        accessToken: {
          exists: !!storedAccess,
          length: storedAccess?.length || 0,
          format: detectTokenFormat(storedAccess),
        },
      });

      // 3. If current session exists, test refresh
      if (diagnostics.session.exists && diagnostics.refreshToken.value) {
        const testResult = await testRefreshToken(
          diagnostics.refreshToken.value
        );
        console.log("[Diagnostics] Refresh Token Test Result:", testResult);
      }

      // 4. Summary
      console.log("[Diagnostics] SUMMARY:", {
        currentSessionValid: diagnostics.session.exists,
        accessTokenValid: diagnostics.accessToken.isValid,
        refreshTokenValid: diagnostics.refreshToken.isValid,
        storedTokensValid: {
          refresh: detectTokenFormat(storedRefresh) === "jwt",
          access: detectTokenFormat(storedAccess) === "jwt",
        },
      });

      return { diagnostics, storedRefresh, storedAccess };
    } catch (error) {
      console.error("[Diagnostics] Full analysis failed:", error);
      throw error;
    }
  }, [diagnoseTokens, testRefreshToken]);

  return {
    diagnoseTokens,
    testRefreshToken,
    analyzeRefreshTokenProblem,
    isValidJWT,
  };
}
