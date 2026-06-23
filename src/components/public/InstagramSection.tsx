import { useEffect } from "react";
import { InstagramIcon } from "./SocialIcons";

const BEHOLD_ID = import.meta.env.VITE_BEHOLD_WIDGET_ID as string | undefined;
const IG_URL    = "https://instagram.com/igrejacarvalho";

export function InstagramSection() {
  useEffect(() => {
    if (!BEHOLD_ID) return;
    if (document.getElementById("behold-script")) return;
    const s   = document.createElement("script");
    s.id      = "behold-script";
    s.src     = "https://w.behold.so/widget.js";
    s.type    = "module";
    document.head.appendChild(s);
  }, []);

  return (
    <section
      className="bg-pub-beige px-4 py-20 sm:py-28"
      aria-labelledby="instagram-heading"
    >
      <div className="mx-auto max-w-6xl">

        {/* Cabeçalho */}
        <div className="mb-10 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pub-gold">
              Nos siga
            </p>
            <h2
              id="instagram-heading"
              className="mt-2 font-serif text-3xl font-bold text-pub-bark sm:text-4xl"
            >
              No Instagram
            </h2>
          </div>
          <a
            href={IG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-pub-green hover:text-pub-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold rounded-sm"
            aria-label="Ver perfil da Igreja Carvalho no Instagram"
          >
            <InstagramIcon size={15} aria-hidden />
            @igrejacarvalho
          </a>
        </div>

        {/* Widget Behold.so ou placeholder */}
        {BEHOLD_ID ? (
          <div data-behold-id={BEHOLD_ID} />
        ) : (
          <div className="rounded-xl border-2 border-dashed border-pub-green/20 p-16 text-center">
            <InstagramIcon
              size={32}
              className="mx-auto mb-4 text-pub-bark/20"
            />
            <p className="font-serif text-lg text-pub-bark/50">Feed ainda não configurado</p>
            <p className="mt-2 text-xs text-pub-bark/30">
              Adicione{" "}
              <code className="rounded bg-white px-1 text-[11px]">VITE_BEHOLD_WIDGET_ID</code>
              {" "}nas variáveis de ambiente.
            </p>
            <a
              href="https://behold.so"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-xs text-pub-green underline underline-offset-2 hover:text-pub-gold"
            >
              Criar widget gratuito em behold.so →
            </a>
          </div>
        )}

      </div>
    </section>
  );
}
