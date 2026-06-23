import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { Seo } from "@/components/Seo";
import {
  ArrowRight,
  HandHeart,
  Heart,
  Megaphone,
  BookOpen,
  Users,
  Sprout,
} from "lucide-react";
import { PublicBannerCarousel } from "@/components/public/PublicBannerCarousel";
import { EventoCard } from "@/components/public/EventoCard";
import { useEventosPublicos } from "@/hooks/useEventosPublicos";
import { ContatoSection } from "@/components/public/ContatoSection";
import { InstagramSection } from "@/components/public/InstagramSection";

/* ─── Conteúdo editável ──────────────────────────────────────────────────────
 * Edite CONTENT para atualizar textos sem tocar no layout.
 * ─────────────────────────────────────────────────────────────────────────── */
const CONTENT = {
  hero: {
    slogan:    "Plantados por Deus,\nvivendo para servir!",
    // Linha de apoio abaixo do slogan — deixar vazio para ocultar
    sloganSub: "",
    verse:
      '"…será como árvore plantada junto a ribeiros de águas, que dá o seu fruto no tempo certo e cujas folhas não murcham."',
    verseRef: "Salmos 1:3",
    ctas: [
      { label: "Venha nos visitar", href: "/#contato",  anchor: true,  primary: true  },
      { label: "Assista online",    href: "/mensagens", anchor: false, primary: false },
    ] as const,
  },

  quemSomos: {
    eyebrow: "Nossa identidade",
    title:   "Quem somos",
    // Cada string vira um <p>. Edite ou adicione parágrafos livremente.
    paragraphs: [
      "A Igreja Carvalho é mais do que um local de culto: é uma comunidade viva, enraizada na Palavra de Deus e comprometida com a transformação de vidas. Como um carvalho de raízes profundas, buscamos firmar pessoas em Cristo — para que cresçam espiritualmente e produzam fruto.",
      "Acreditamos que muitos procuram um lugar de crescimento e restauração. Por isso queremos ser um lar espiritual, onde cada pessoa é acolhida com amor, cresce em comunhão e descobre seu propósito.",
      "Mais do que uma igreja, somos uma família comprometida em servir com excelência, acolher com amor e crescer em unidade — refletindo a glória de Deus ao mundo.",
    ] as const,
    missao:
      "Proclamar as boas-novas, adorar em espírito e em verdade, discipular para o crescimento espiritual, promover comunhão entre os membros e servir ao próximo, refletindo o amor e a glória de Deus ao mundo.",
    visao:
      "Ser uma igreja firmada na Palavra de Deus, reconhecida por sua profundidade espiritual, acolhimento e comprometimento com a transformação de vidas, levando pessoas a um relacionamento profundo e frutífero com Cristo.",
  },

  propositos: {
    eyebrow:  "Por que existimos",
    title:    "Nossos Propósitos",
    subtitle:
      "Como os cinco galhos de um carvalho enraizado, cada propósito expressa uma dimensão do que Deus nos chamou a ser.",
    items: [
      {
        id:     "adoracao",
        branch: 1,
        Icon:   Heart,
        label:  "Adoração",
        text:   "Adoramos a Deus em espírito e em verdade — em tudo e em todo lugar.",
      },
      {
        id:     "evangelismo",
        branch: 2,
        Icon:   Megaphone,
        label:  "Evangelismo",
        text:   "Proclamamos as boas-novas de Jesus Cristo para todas as pessoas.",
      },
      {
        id:     "discipulado",
        branch: 3,
        Icon:   BookOpen,
        label:  "Discipulado",
        text:   "Crescemos juntos na fé, enraizados na Palavra e formados para o caráter de Cristo.",
      },
      {
        id:     "comunhao",
        branch: 4,
        Icon:   Users,
        label:  "Comunhão",
        text:   "Promovemos relações de acolhimento, amor genuíno e transformação de vidas.",
      },
      {
        id:     "servico",
        branch: 5,
        Icon:   Sprout,
        label:  "Serviço",
        text:   "Servimos ao próximo e à cidade como expressão concreta do amor de Deus.",
      },
    ] as const,
  },
} as const;

/* ─── SVG: Carvalho estilizado com cinco galhos ──────────────────────────────
 * Cada elipse numerada representa um galho/propósito (branch 1-5).
 * viewBox 120×115: crown (x:17–103) + trunk (y:88–115)
 * Props:
 *   className  — Tailwind text-* + size (h-*, w-*)  →  fill="currentColor"
 *   showLabels — exibe números 1-5 sobre cada galho
 * ─────────────────────────────────────────────────────────────────────────── */
function OakTreeSvg({
  className,
  showLabels = false,
}: {
  className?: string;
  showLabels?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 120 115"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Tronco */}
      <rect x="55" y="88" width="10" height="24" rx="4" fill="currentColor" opacity="0.6" />
      {/* Raízes */}
      <path
        d="M47 112 Q55 107 60 112 Q65 107 73 112"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45"
      />
      {/* Ramos estruturais */}
      <path d="M60 88 L60 55"      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.40" />
      <path d="M60 75 Q55 70 42 66" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M60 75 Q65 70 78 66" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      <path d="M60 68 Q55 60 37 56" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.30" />
      <path d="M60 68 Q65 60 83 56" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.30" />

      {/* Galho 1 — Adoração: topo centro */}
      <ellipse cx="60" cy="26" rx="22" ry="18" fill="currentColor" opacity="0.95" />
      {/* Galho 2 — Evangelismo: direita superior */}
      <ellipse cx="85" cy="43" rx="18" ry="15" fill="currentColor" opacity="0.88" />
      {/* Galho 3 — Discipulado: direita inferior */}
      <ellipse cx="81" cy="67" rx="16" ry="14" fill="currentColor" opacity="0.78" />
      {/* Galho 4 — Comunhão: esquerda inferior */}
      <ellipse cx="39" cy="67" rx="16" ry="14" fill="currentColor" opacity="0.78" />
      {/* Galho 5 — Serviço: esquerda superior */}
      <ellipse cx="35" cy="43" rx="18" ry="15" fill="currentColor" opacity="0.88" />

      {showLabels && (
        <g fontFamily="Georgia, serif" fontWeight="bold" fill="white" fontSize="9" textAnchor="middle">
          <text x="60" y="29">1</text>
          <text x="85" y="47">2</text>
          <text x="81" y="71">3</text>
          <text x="39" y="71">4</text>
          <text x="35" y="47">5</text>
        </g>
      )}
    </svg>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

const PREVIEW_LIMIT = 6;

export default function PublicHome() {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();
  const { eventos, loading: loadingEventos } = useEventosPublicos({ limit: PREVIEW_LIMIT });

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  return (
    <>
      <Seo
        title="Início"
        description="Plantados por Deus, vivendo para servir. Conheça a Igreja Carvalho — uma família firme em Cristo, enraizada na Palavra."
        url="https://igrejacarvalho.com.br/"
      />

      {/* ══ 1. HERO ══════════════════════════════════════════════════════════ */}
      <section
        className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-pub-green px-4 text-center"
        aria-labelledby="hero-heading"
      >
        {/* Fundo: carvalho grande e translúcido */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
          aria-hidden="true"
        >
          <OakTreeSvg className="h-[80vmin] w-auto text-pub-beige opacity-[0.05]" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-5 max-w-3xl w-full">

          {/* Símbolo: carvalho no círculo */}
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full border border-pub-gold/30 bg-pub-beige/[0.07] ring-1 ring-inset ring-pub-beige/10"
            aria-hidden="true"
          >
            <OakTreeSvg className="h-11 w-auto text-pub-gold" />
          </div>

          {/* Slogan principal */}
          <h1
            id="hero-heading"
            className="font-serif text-4xl font-bold leading-tight text-pub-beige whitespace-pre-line sm:text-5xl lg:text-[3.5rem]"
          >
            {CONTENT.hero.slogan}
          </h1>

          {/* Linha de apoio (opcional — some quando vazio) */}
          {CONTENT.hero.sloganSub && (
            <p className="max-w-md text-pub-beige/70 text-lg leading-relaxed">
              {CONTENT.hero.sloganSub}
            </p>
          )}

          {/* Divisor dourado */}
          <div className="h-px w-14 bg-pub-gold/45" aria-hidden="true" />

          {/* Versículo */}
          <blockquote className="max-w-xl">
            <p className="text-pub-beige/55 text-sm italic leading-relaxed sm:text-base">
              {CONTENT.hero.verse}
            </p>
            <footer className="mt-2 text-[0.65rem] font-semibold tracking-[0.28em] text-pub-beige/65 uppercase">
              — {CONTENT.hero.verseRef}
            </footer>
          </blockquote>

          {/* CTAs */}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            {CONTENT.hero.ctas.map((cta) => {
              const base =
                "inline-flex items-center justify-center rounded-md px-8 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold focus-visible:ring-offset-2 focus-visible:ring-offset-pub-green";
              const variant = cta.primary
                ? `${base} bg-pub-gold text-pub-bark hover:bg-pub-gold/90`
                : `${base} border border-pub-beige/35 font-medium text-pub-beige hover:border-pub-gold hover:text-pub-gold`;
              return cta.anchor ? (
                <a key={cta.label} href={cta.href} className={variant}>
                  {cta.label}
                </a>
              ) : (
                <Link key={cta.label} to={cta.href} className={variant}>
                  {cta.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Indicador de scroll */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-pub-beige/25"
          aria-hidden="true"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* ══ 2. QUEM SOMOS ════════════════════════════════════════════════════ */}
      <section
        id="quem-somos"
        className="bg-white px-4 py-24 sm:py-32"
        aria-labelledby="about-heading"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-16 lg:grid-cols-[1fr_280px] lg:gap-20 lg:items-start">

            {/* ── Coluna de texto ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pub-gold">
                {CONTENT.quemSomos.eyebrow}
              </p>
              <h2
                id="about-heading"
                className="mt-3 font-serif text-3xl font-bold text-pub-bark sm:text-4xl"
              >
                {CONTENT.quemSomos.title}
              </h2>

              {/* Parágrafos */}
              <div className="mt-8 space-y-5 text-pub-bark/65 leading-relaxed">
                {CONTENT.quemSomos.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {/* Missão e Visão */}
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-pub-green px-6 py-6">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-pub-beige/65">
                    Missão
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-pub-beige/75">
                    {CONTENT.quemSomos.missao}
                  </p>
                </div>
                <div className="rounded-2xl bg-pub-beige px-6 py-6 ring-1 ring-pub-bark/8">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-pub-gold">
                    Visão
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-pub-bark/65">
                    {CONTENT.quemSomos.visao}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Coluna decorativa: carvalho no círculo ── */}
            <div
              className="hidden lg:flex flex-col items-center justify-start pt-4"
              aria-hidden="true"
            >
              <div className="relative flex h-64 w-64 items-center justify-center rounded-full bg-pub-beige ring-1 ring-pub-bark/8">
                {/* Anel decorativo interno */}
                <div className="absolute inset-4 rounded-full border border-pub-bark/5" />
                <OakTreeSvg className="h-48 w-auto text-pub-green" />
              </div>
              {/* Legenda abaixo */}
              <p className="mt-4 text-center text-[10px] font-medium uppercase tracking-[0.3em] text-pub-bark/25">
                Igreja Carvalho
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ══ 3. NOSSOS PROPÓSITOS ═════════════════════════════════════════════ */}
      <section
        className="bg-pub-beige px-4 py-24 sm:py-32"
        aria-labelledby="propositos-heading"
      >
        <div className="mx-auto max-w-6xl">

          {/* Cabeçalho */}
          <div className="mb-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pub-gold">
              {CONTENT.propositos.eyebrow}
            </p>
            <h2
              id="propositos-heading"
              className="mt-3 font-serif text-3xl font-bold text-pub-bark sm:text-4xl"
            >
              {CONTENT.propositos.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-pub-bark/50">
              {CONTENT.propositos.subtitle}
            </p>
          </div>

          {/* Símbolo com galhos numerados */}
          <div
            className="mx-auto mb-14 flex w-fit flex-col items-center gap-2"
            aria-hidden="true"
          >
            <OakTreeSvg className="h-40 w-auto text-pub-green" showLabels />
            <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-pub-bark/28">
              os cinco galhos
            </span>
          </div>

          {/* Grade de propósitos */}
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {CONTENT.propositos.items.map(({ id, branch, Icon, label, text }) => (
              <li key={id}>
                <article
                  className="flex h-full flex-col gap-4 rounded-2xl bg-white px-7 py-8 shadow-sm ring-1 ring-pub-bark/5"
                  aria-label={`Propósito ${branch}: ${label}`}
                >
                  {/* Badge galho */}
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pub-green/10">
                      <OakTreeSvg className="h-4 w-auto text-pub-green" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-pub-bark/35">
                      Galho {branch}
                    </span>
                  </div>

                  {/* Ícone */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pub-gold-light">
                    <Icon className="h-6 w-6 text-pub-gold" strokeWidth={1.5} />
                  </div>

                  {/* Título */}
                  <h3 className="font-serif text-xl font-semibold text-pub-bark">
                    {label}
                  </h3>

                  {/* Texto */}
                  <p className="text-sm leading-relaxed text-pub-bark/60">{text}</p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ══ 4. CARROSSEL DE BANNERS ══════════════════════════════════════════ */}
      <PublicBannerCarousel />

      {/* ══ 5. PRÓXIMOS EVENTOS ══════════════════════════════════════════════ */}
      <section
        className="bg-white px-4 py-20 sm:py-28"
        aria-labelledby="eventos-heading"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pub-gold">
                Venha participar
              </p>
              <h2
                id="eventos-heading"
                className="mt-2 font-serif text-3xl font-bold text-pub-bark sm:text-4xl"
              >
                Próximos Eventos
              </h2>
            </div>
            <Link
              to="/agenda"
              className="flex items-center gap-1.5 text-sm font-medium text-pub-green hover:text-pub-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold rounded-sm"
            >
              Ver tudo <ArrowRight size={15} aria-hidden />
            </Link>
          </div>

          {loadingEventos && (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Carregando eventos">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i}>
                  <div className="animate-pulse rounded-2xl bg-pub-beige h-64" aria-hidden />
                </li>
              ))}
            </ul>
          )}

          {!loadingEventos && eventos.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-pub-green/15 py-16 text-center text-pub-bark/35">
              <p className="text-lg font-serif">Nenhum evento agendado no momento.</p>
              <p className="mt-1 text-sm">Acompanhe nossas redes sociais para novidades.</p>
            </div>
          )}

          {!loadingEventos && eventos.length > 0 && (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {eventos.map((evento) => (
                <li key={evento.id}>
                  <EventoCard evento={evento} compact />
                </li>
              ))}
            </ul>
          )}

          {eventos.length >= PREVIEW_LIMIT && (
            <div className="mt-10 text-center">
              <Link
                to="/agenda"
                className="inline-flex items-center gap-2 rounded-md border border-pub-green px-6 py-2.5 text-sm font-medium text-pub-green hover:bg-pub-green hover:text-pub-beige transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
              >
                Ver agenda completa <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ══ 6. INSTAGRAM ════════════════════════════════════════════════════ */}
      <InstagramSection />

      {/* ══ 7. PEDIDO DE ORAÇÃO ══════════════════════════════════════════════ */}
      <section
        className="bg-pub-green px-4 py-20 sm:py-24"
        aria-labelledby="oracao-heading"
      >
        <div className="mx-auto max-w-3xl text-center">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-pub-beige/10"
            aria-hidden="true"
          >
            <HandHeart className="h-8 w-8 text-pub-gold" strokeWidth={1.5} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pub-beige/65">
            Ministério de intercessão
          </p>
          <h2
            id="oracao-heading"
            className="mt-3 font-serif text-3xl font-bold text-pub-beige sm:text-4xl"
          >
            Posso orar por você?
          </h2>
          <p className="mt-4 leading-relaxed text-pub-beige/65 max-w-lg mx-auto">
            Nossa equipe de intercessão recebe seus pedidos com cuidado e sigilo.
            Você pode enviar de forma anônima, se preferir.
          </p>
          <Link
            to="/oracao"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-pub-gold px-8 py-3 text-sm font-semibold text-pub-bark transition-colors hover:bg-pub-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-beige"
          >
            Enviar pedido de oração <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>

      {/* ══ 8. ONDE ESTAMOS / CONTATO ════════════════════════════════════════ */}
      <ContatoSection />
    </>
  );
}
