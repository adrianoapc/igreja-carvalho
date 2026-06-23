/**
 * ContatoSection — "Onde estamos"
 *
 * Usado em dois contextos:
 *   1. PublicHome.tsx  — section ancora #contato na landing
 *   2. PublicContato.tsx — página /contato (SEO + rota direta)
 *
 * O mapa do Google Maps carrega apenas após consentimento de cookies
 * (ThirdPartyGate). Antes do consentimento o usuário vê o endereço
 * completo + link direto para o Google Maps (nova aba, sem cookies).
 */

import { MapPin, Clock, Mail, MessageCircle, ExternalLink } from "lucide-react";

function InstagramIcon({ size = 16, ...props }: { size?: number; [k: string]: unknown }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YoutubeIcon({ size = 16, ...props }: { size?: number; [k: string]: unknown }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
    </svg>
  );
}
import { useConsent } from "@/contexts/CookieConsentContext";

/* ─── Dados institucionais ────────────────────────────────────────────────────
 * Edite CONTATO para atualizar informações sem tocar no layout.
 * ─────────────────────────────────────────────────────────────────────────── */
export const CONTATO = {
  endereco: {
    rua:      "Av. Gabriel Jorge Cury, 232",
    bairro:   "Jardim Municipal",
    cidade:   "São José do Rio Preto",
    uf:       "SP",
    // Link direto para o Google Maps (sem cookies, abre nova aba)
    googleMapsUrl:
      "https://maps.google.com/maps?q=Avenida+Gabriel+Jorge+Cury,+232,+Jardim+Municipal,+São+José+do+Rio+Preto,+SP",
    // Iframe embed (só carregado após consentimento)
    embedUrl:
      "https://maps.google.com/maps?q=Avenida+Gabriel+Jorge+Cury,+232,+São+José+do+Rio+Preto,+SP,+Brasil&output=embed&hl=pt-BR",
  },
  cultos: [
    { dia: "Terça-feira",   horario: "20h"    },
    { dia: "Quinta-feira",  horario: "19h30"  },
    { dia: "Domingo",       horario: "18h30"  },
  ] as const,
  whatsapp: {
    url:    "https://wa.me/5517991985016",
    label:  "(17) 99198-5016",
  },
  email: "contato@igrejacarvalho.com.br",
  redes: [
    {
      id:    "instagram",
      label: "Instagram",
      handle: "@igrejacarvalho",
      url:   "https://instagram.com/igrejacarvalho",
      Icon:  InstagramIcon,
    },
    {
      id:    "youtube",
      label: "YouTube",
      handle: "@igrejacarvalho",
      url:   "https://youtube.com/@igrejacarvalho",
      Icon:  YoutubeIcon,
    },
  ] as const,
} as const;

/* ─── Bloco de mapa com gate de consentimento ────────────────────────────────
 * Não usa ThirdPartyGate (cujo ícone é PlayCircle) para dar UX mais rica:
 * o placeholder já exibe o endereço + link externo, garantindo acesso ao
 * mapa mesmo sem aceitar cookies.
 * ─────────────────────────────────────────────────────────────────────────── */
function MapBlock() {
  const { nonEssentialAllowed, accept } = useConsent();
  const { endereco } = CONTATO;

  if (nonEssentialAllowed) {
    return (
      <div className="overflow-hidden rounded-2xl ring-1 ring-pub-bark/8 shadow-sm">
        <iframe
          src={endereco.embedUrl}
          width="100%"
          height="400"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Mapa com a localização da Igreja Carvalho"
          className="block border-0"
          aria-label="Mapa interativo — Igreja Carvalho"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl ring-1 ring-pub-bark/8 shadow-sm">
      {/* Área do mapa bloqueada — fundo verde com padrão sutil */}
      <div
        className="flex min-h-[280px] flex-col items-center justify-center gap-5 bg-pub-green/5 px-6 py-10 text-center sm:min-h-[360px]"
        role="img"
        aria-label="Mapa não carregado — aguardando consentimento de cookies"
      >
        {/* Ícone */}
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-pub-green/10"
          aria-hidden="true"
        >
          <MapPin className="h-7 w-7 text-pub-green/60" strokeWidth={1.5} />
        </div>

        {/* Endereço visível mesmo sem o mapa */}
        <div>
          <p className="font-serif text-lg font-semibold text-pub-bark">
            {endereco.rua}
          </p>
          <p className="mt-0.5 text-sm text-pub-bark/55">
            {endereco.bairro} · {endereco.cidade}/{endereco.uf}
          </p>
        </div>

        {/* CTA externo — sempre disponível, sem cookies */}
        <a
          href={endereco.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-pub-green px-5 py-2.5 text-sm font-medium text-pub-green transition-colors hover:bg-pub-green hover:text-pub-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
        >
          <ExternalLink size={14} aria-hidden />
          Ver no Google Maps
        </a>

        {/* Separador */}
        <div className="flex items-center gap-3 w-full max-w-xs" aria-hidden>
          <div className="flex-1 h-px bg-pub-bark/10" />
          <span className="text-[11px] text-pub-bark/30 uppercase tracking-widest">ou</span>
          <div className="flex-1 h-px bg-pub-bark/10" />
        </div>

        {/* Aceitar cookies para carregar o mapa */}
        <div className="text-center">
          <button
            onClick={accept}
            className="rounded-md bg-pub-beige px-5 py-2 text-sm font-medium text-pub-bark/70 transition-colors hover:bg-pub-gold hover:text-pub-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
          >
            Carregar mapa interativo
          </button>
          <p className="mt-1.5 text-[11px] text-pub-bark/35 leading-relaxed">
            Requer aceitar cookies de terceiros
            {" ("}
            <a
              href="/privacidade"
              className="underline underline-offset-2 hover:text-pub-bark/55 focus-visible:outline-none"
            >
              saiba mais
            </a>
            {")."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Componente principal ────────────────────────────────────────────────────*/
export function ContatoSection() {
  const { cultos, whatsapp, email, redes, endereco } = CONTATO;

  return (
    <section
      id="contato"
      className="bg-white px-4 py-24 sm:py-32"
      aria-labelledby="contato-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-16">

          {/* ── Coluna de informações ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pub-gold">
              Venha nos visitar
            </p>
            <h2
              id="contato-heading"
              className="mt-3 font-serif text-3xl font-bold text-pub-bark sm:text-4xl"
            >
              Onde estamos
            </h2>

            <ul className="mt-10 flex flex-col gap-7" role="list" aria-label="Informações de contato">

              {/* Endereço */}
              <li className="flex items-start gap-4">
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pub-green/10"
                  aria-hidden="true"
                >
                  <MapPin className="h-5 w-5 text-pub-green" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-pub-bark/40">
                    Endereço
                  </p>
                  <address className="mt-1 not-italic text-sm leading-relaxed text-pub-bark/75">
                    {endereco.rua}<br />
                    {endereco.bairro} · {endereco.cidade}/{endereco.uf}
                  </address>
                  <a
                    href={endereco.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-pub-green hover:text-pub-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold rounded-sm"
                  >
                    <ExternalLink size={12} aria-hidden />
                    Ver no Google Maps
                  </a>
                </div>
              </li>

              {/* Horários */}
              <li className="flex items-start gap-4">
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pub-green/10"
                  aria-hidden="true"
                >
                  <Clock className="h-5 w-5 text-pub-green" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-pub-bark/40">
                    Horários de culto
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5" aria-label="Horários de culto">
                    {cultos.map(({ dia, horario }) => (
                      <li
                        key={dia}
                        className="flex items-baseline gap-2 text-sm text-pub-bark/75"
                      >
                        <span className="font-medium w-32">{dia}</span>
                        <span
                          className="flex-1 border-b border-dashed border-pub-bark/15"
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-pub-bark tabular-nums">{horario}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>

              {/* WhatsApp */}
              <li className="flex items-start gap-4">
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pub-green/10"
                  aria-hidden="true"
                >
                  <MessageCircle className="h-5 w-5 text-pub-green" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-pub-bark/40">
                    WhatsApp
                  </p>
                  <a
                    href={whatsapp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-2 rounded-md bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1ebe5d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
                  >
                    <MessageCircle size={15} aria-hidden />
                    {whatsapp.label}
                  </a>
                </div>
              </li>

              {/* E-mail */}
              <li className="flex items-start gap-4">
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pub-green/10"
                  aria-hidden="true"
                >
                  <Mail className="h-5 w-5 text-pub-green" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-pub-bark/40">
                    E-mail
                  </p>
                  <a
                    href={`mailto:${email}`}
                    className="mt-1 inline-block text-sm font-medium text-pub-bark/75 underline underline-offset-2 hover:text-pub-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold rounded-sm"
                  >
                    {email}
                  </a>
                </div>
              </li>

            </ul>

            {/* Redes sociais */}
            <div className="mt-10 border-t border-pub-bark/8 pt-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-pub-bark/40">
                Redes sociais
              </p>
              <ul className="flex flex-col gap-3 sm:flex-row sm:gap-4" role="list">
                {redes.map(({ id, label, handle, url, Icon }) => (
                  <li key={id}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label} da Igreja Carvalho`}
                      className="inline-flex items-center gap-2.5 rounded-lg border border-pub-bark/10 bg-pub-beige/50 px-4 py-2.5 text-sm font-medium text-pub-bark/70 transition-colors hover:border-pub-green hover:bg-pub-green hover:text-pub-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
                    >
                      <Icon size={16} aria-hidden />
                      <span>{label}</span>
                      <span className="text-pub-bark/40 group-hover:text-pub-beige/60">{handle}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Coluna do mapa ── */}
          <div className="flex flex-col justify-start">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-pub-bark/40">
              Localização
            </p>
            <MapBlock />
          </div>

        </div>
      </div>
    </section>
  );
}
