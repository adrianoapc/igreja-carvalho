/**
 * CookieConsentContext
 *
 * Gerencia a preferência de consentimento de cookies do visitante do site público.
 * Segue o padrão localStorage já usado no app (AuthContextProvider, AuthGate, etc.)
 *
 * Categorias:
 *   essential     — Turnstile, Supabase client — sempre carregam, sem opção de recusar
 *   non_essential — YouTube, Instagram e similares — só carregam com consent = "accepted"
 *
 * Valores em localStorage ("ic_cookie_consent"):
 *   "accepted" — usuário aceitou tudo
 *   "rejected" — usuário recusou não-essenciais
 *   (ausente)  — ainda não decidiu (banner exibido)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "ic_cookie_consent";

export type ConsentState = "accepted" | "rejected" | "pending";

interface CookieConsentValue {
  /** Estado atual do consentimento */
  consent: ConsentState;
  /** Aceitar cookies não-essenciais */
  accept: () => void;
  /** Recusar cookies não-essenciais */
  reject: () => void;
  /** Conveniência: true somente quando consent === "accepted" */
  nonEssentialAllowed: boolean;
}

const CookieConsentContext = createContext<CookieConsentValue | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "accepted" || stored === "rejected") return stored;
    } catch {
      // localStorage indisponível (modo privado restritivo, SSR, etc.) — trata como pending
    }
    return "pending";
  });

  const persist = useCallback((value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Falha silenciosa — preferência não persiste, banner reaparece na próxima visita
    }
    setConsent(value);
  }, []);

  const accept = useCallback(() => persist("accepted"), [persist]);
  const reject = useCallback(() => persist("rejected"), [persist]);

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        accept,
        reject,
        nonEssentialAllowed: consent === "accepted",
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useConsent(): CookieConsentValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useConsent deve ser usado dentro de CookieConsentProvider");
  return ctx;
}
