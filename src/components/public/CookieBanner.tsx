import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { useConsent } from "@/contexts/CookieConsentContext";

/**
 * Banner de consentimento de cookies (LGPD art. 7º II).
 *
 * Exibido apenas quando o visitante ainda não escolheu (consent === "pending").
 * Fica fixo na parte inferior da tela e recebe foco automaticamente
 * para acessibilidade por teclado.
 *
 * Cookies essenciais (Turnstile, Supabase) não estão sujeitos a este aviso —
 * são necessários para o funcionamento básico do site.
 */
export function CookieBanner() {
  const { consent, accept, reject } = useConsent();
  const acceptRef = useRef<HTMLButtonElement>(null);

  // Envia foco para o primeiro botão quando o banner aparece
  useEffect(() => {
    if (consent === "pending") {
      // Pequeno delay para não disputar com o foco do carregamento da página
      const id = setTimeout(() => acceptRef.current?.focus(), 400);
      return () => clearTimeout(id);
    }
  }, [consent]);

  if (consent !== "pending") return null;

  return (
    <div
      role="region"
      aria-label="Configurações de privacidade e cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-pub-beige/10 bg-pub-bark px-4 py-4 shadow-2xl sm:py-5"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        {/* Ícone + texto */}
        <div className="flex flex-1 items-start gap-3">
          <Cookie
            size={20}
            className="mt-0.5 shrink-0 text-pub-gold"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-pub-beige/80">
            Usamos cookies essenciais para o funcionamento do site e, com seu
            consentimento, cookies de terceiros (YouTube, Instagram) para exibir
            conteúdo multimídia. Saiba mais em nossa{" "}
            <Link
              to="/privacidade"
              className="text-pub-gold underline underline-offset-2 hover:text-pub-gold/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pub-gold"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </div>

        {/* Botões */}
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            onClick={reject}
            className="rounded-md border border-pub-beige/30 px-5 py-2 text-sm font-medium text-pub-beige/70 transition-colors hover:border-pub-beige/60 hover:text-pub-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
          >
            Recusar não essenciais
          </button>
          <button
            ref={acceptRef}
            onClick={accept}
            className="rounded-md bg-pub-gold px-5 py-2 text-sm font-semibold text-pub-bark transition-colors hover:bg-pub-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-beige"
          >
            Aceitar tudo
          </button>
        </div>
      </div>
    </div>
  );
}
