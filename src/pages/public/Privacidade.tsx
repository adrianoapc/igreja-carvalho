import { Seo } from "@/components/Seo";
import { PRIVACY_META, PRIVACY_SECTIONS } from "@/content/privacidade";

/**
 * Página de Política de Privacidade.
 *
 * Conteúdo editável em: src/content/privacidade.ts
 * Cada seção vira um <h2> com parágrafos — não é necessário markdown parser.
 * Use \n\n numa string para separar parágrafos dentro de uma seção.
 */
export default function Privacidade() {
  return (
    <>
      <Seo
        title="Política de Privacidade"
        description="Saiba como a Igreja Carvalho coleta, usa e protege seus dados pessoais conforme a LGPD."
        url="https://igrejacarvalho.com.br/privacidade"
      />

      {/* Cabeçalho */}
      <div className="bg-pub-green px-4 pb-10 pt-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pub-gold">
            LGPD — Lei 13.709/2018
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-pub-beige sm:text-5xl">
            Política de Privacidade
          </h1>
          <p className="mt-3 text-sm text-pub-beige/50">
            Última atualização:{" "}
            <time dateTime={PRIVACY_META.lastUpdated}>
              {PRIVACY_META.lastUpdatedLabel}
            </time>
            {" · "}
            Controladora:{" "}
            <strong className="text-pub-beige/70">{PRIVACY_META.controller}</strong>
          </p>
        </div>
      </div>

      {/* Corpo */}
      <div className="bg-pub-beige px-4 py-16">
        <div className="mx-auto max-w-3xl">
          {/* Intro rápida */}
          <p className="mb-10 rounded-xl border border-pub-green/20 bg-white px-6 py-5 text-sm leading-relaxed text-pub-bark/70">
            Esta política explica de forma clara e objetiva quais dados pessoais coletamos,
            por que, por quanto tempo os armazenamos e como você pode exercer seus direitos
            como titular, nos termos da LGPD.
          </p>

          {/* Seções */}
          <div className="flex flex-col gap-10">
            {PRIVACY_SECTIONS.map((section) => (
              <section key={section.id} id={section.id} aria-labelledby={`h-${section.id}`}>
                <h2
                  id={`h-${section.id}`}
                  className="mb-4 font-serif text-xl font-bold text-pub-bark sm:text-2xl"
                >
                  {section.title}
                </h2>
                <div className="flex flex-col gap-3">
                  {section.paragraphs.map((text, i) => (
                    <p key={i} className="text-sm leading-relaxed text-pub-bark/65">
                      {text}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Contato DPO destacado */}
          <div className="mt-14 rounded-xl bg-pub-green px-6 py-6 text-center">
            <p className="text-sm font-medium text-pub-beige/80">
              Dúvidas ou exercício de direitos?
            </p>
            <a
              href={`mailto:${PRIVACY_META.dpoEmail}`}
              className="mt-1 inline-block text-pub-gold underline underline-offset-2 hover:text-pub-gold/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-beige rounded-sm"
            >
              {PRIVACY_META.dpoEmail}
            </a>
          </div>

          {/* Âncoras de navegação rápida (visible only to larger screens) */}
          <nav
            aria-label="Ir para seção"
            className="mt-8 hidden sm:block"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-pub-bark/30">
              Navegação rápida
            </p>
            <ul className="flex flex-wrap gap-2">
              {PRIVACY_SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="rounded-full border border-pub-bark/10 bg-white px-3 py-1 text-xs text-pub-bark/50 transition-colors hover:border-pub-green hover:text-pub-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
                  >
                    {s.title.replace(/^\d+\.\s*/, "")}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
