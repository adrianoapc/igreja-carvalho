import { PlayCircle } from "lucide-react";
import { useConsent } from "@/contexts/CookieConsentContext";

interface ThirdPartyGateProps {
  /** Conteúdo real a exibir quando o consentimento for dado (iframe, embed, etc.) */
  children: React.ReactNode;
  /** Nome da plataforma de terceiros para exibição no placeholder */
  platform: string;
  /** Descrição opcional do conteúdo bloqueado */
  description?: string;
  /** Altura mínima do placeholder (padrão: 240px) */
  minHeight?: string;
}

/**
 * Gating de conteúdo de terceiros baseado em consentimento de cookies.
 *
 * - consent === "accepted" → renderiza filhos normalmente
 * - consent !== "accepted" → mostra placeholder com botão para aceitar e carregar
 *
 * O Turnstile é essencial e NÃO deve ser envolvido neste componente.
 * Usar apenas para: YouTube, Instagram, Google Maps com cookies, etc.
 *
 * Aceitar pelo placeholder define a preferência globalmente (equivale a
 * "Aceitar tudo" no banner). A ação é explícita e informada — LGPD art. 7º II.
 */
export function ThirdPartyGate({
  children,
  platform,
  description,
  minHeight = "240px",
}: ThirdPartyGateProps) {
  const { nonEssentialAllowed, accept } = useConsent();

  if (nonEssentialAllowed) return <>{children}</>;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-pub-bark/10 bg-pub-beige/60 px-6 py-10 text-center"
      style={{ minHeight }}
    >
      <PlayCircle
        size={40}
        className="mb-4 text-pub-bark/20"
        strokeWidth={1.2}
        aria-hidden="true"
      />

      <p className="text-sm font-medium text-pub-bark/60">
        Conteúdo do <strong>{platform}</strong>
      </p>

      {description && (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-pub-bark/40">
          {description}
        </p>
      )}

      <p className="mt-3 max-w-xs text-xs text-pub-bark/40">
        Este conteúdo usa cookies de terceiros ({platform}).
      </p>

      <button
        onClick={accept}
        className="mt-5 rounded-md bg-pub-green px-5 py-2 text-sm font-medium text-pub-beige transition-colors hover:bg-pub-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
      >
        Aceitar cookies e carregar
      </button>

      <p className="mt-2 text-[11px] text-pub-bark/30">
        Ao clicar, você aceita cookies de terceiros conforme nossa{" "}
        <a
          href="/privacidade"
          className="underline underline-offset-2 hover:text-pub-bark/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pub-gold rounded-sm"
        >
          Política de Privacidade
        </a>
        .
      </p>
    </div>
  );
}
