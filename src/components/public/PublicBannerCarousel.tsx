import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OptimizedImage } from "@/components/OptimizedImage";

interface BannerPublico {
  id: string;
  titulo: string;
  descricao: string | null;
  imagem_url: string | null;
  link_acao: string | null;
}

const AUTOPLAY_MS = 6000;

export function PublicBannerCarousel() {
  const [banners, setBanners]           = useState<BannerPublico[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPaused, setIsPaused]         = useState(false);

  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const autoplayPlugin = useRef(
    Autoplay({ delay: AUTOPLAY_MS, stopOnInteraction: false, stopOnMouseEnter: true }),
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center" },
    reducedMotion.current ? [] : [autoplayPlugin.current],
  );

  useEffect(() => {
    supabase
      .from("comunicados_publicos")
      .select("id, titulo, descricao, imagem_url, link_acao")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        setBanners(data ?? []);
        setLoading(false);
      });
  }, []);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo   = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  const togglePause = useCallback(() => {
    const ap = autoplayPlugin.current;
    if (isPaused) {
      ap.play();
      setIsPaused(false);
    } else {
      ap.stop();
      setIsPaused(true);
    }
  }, [isPaused]);

  // Pause on keyboard focus entering the carousel; resume on blur (unless manually paused)
  const handleFocus = useCallback(() => autoplayPlugin.current.stop(), []);
  const handleBlur  = useCallback(() => {
    if (!isPaused) autoplayPlugin.current.play();
  }, [isPaused]);

  if (loading) return null;
  if (banners.length === 0) {
    if (import.meta.env.DEV) {
      return (
        <div className="flex min-h-30 items-center justify-center bg-pub-bark/5 border-y border-dashed border-pub-bark/15 text-pub-bark/30 text-sm">
          Carrossel de banners — nenhum comunicado com <code className="mx-1 text-xs bg-pub-beige px-1 rounded">exibir_site = true</code> encontrado
        </div>
      );
    }
    return null;
  }

  const total = banners.length;

  return (
    <section
      aria-label="Destaques"
      aria-roledescription="carrossel"
      className="relative bg-pub-bark"
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {/* ── Viewport ─────────────────────────────────────────────────────── */}
      <div ref={emblaRef} className="overflow-hidden">
        <div aria-atomic="false" aria-live="polite" className="flex">
          {banners.map((banner, i) => (
            <div
              key={banner.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${i + 1} de ${total}: ${banner.titulo}`}
              className="min-w-0 flex-[0_0_100%]"
            >
              {banner.imagem_url ? (
                /* Slide com imagem */
                <div className="relative aspect-video md:aspect-auto md:h-[480px] overflow-hidden bg-pub-bark">
                  <OptimizedImage
                    src={banner.imagem_url}
                    alt={banner.titulo}
                    priority={i === 0}
                    className="h-full w-full object-cover"
                  />
                  {/* Gradient overlay for text legibility */}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-pub-bark/85 via-pub-bark/20 to-transparent pointer-events-none"
                    aria-hidden="true"
                  />
                  {/* Text block */}
                  <div className="absolute bottom-0 left-0 right-0 px-6 pb-14 pt-8 sm:px-10 sm:pb-16">
                    <h2 className="font-serif text-xl font-bold leading-snug text-pub-beige drop-shadow-sm line-clamp-2 sm:text-3xl">
                      {banner.titulo}
                    </h2>
                    {banner.descricao && (
                      <p className="mt-2 hidden text-sm leading-relaxed text-pub-beige/70 line-clamp-2 sm:block">
                        {banner.descricao}
                      </p>
                    )}
                    {banner.link_acao && (
                      <a
                        href={banner.link_acao}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center rounded-md border border-pub-gold px-5 py-2 text-sm font-medium text-pub-gold transition-colors hover:bg-pub-gold hover:text-pub-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold focus-visible:ring-offset-2 focus-visible:ring-offset-pub-bark"
                      >
                        Saiba mais
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                /* Slide sem imagem: fundo pub-green com texto centrado */
                <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden bg-pub-green px-8 py-16 text-center md:min-h-[380px]">
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
                    aria-hidden="true"
                  >
                    <span className="font-serif text-[40vw] font-bold leading-none text-pub-beige opacity-[0.04] md:text-[20vw]">
                      F
                    </span>
                  </div>
                  <div className="relative z-10 flex max-w-2xl flex-col items-center gap-4">
                    <div className="h-px w-12 bg-pub-gold" aria-hidden="true" />
                    <h2 className="font-serif text-2xl font-bold text-pub-beige sm:text-4xl">
                      {banner.titulo}
                    </h2>
                    {banner.descricao && (
                      <p className="leading-relaxed text-pub-beige/70">
                        {banner.descricao}
                      </p>
                    )}
                    {banner.link_acao && (
                      <a
                        href={banner.link_acao}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center rounded-md bg-pub-gold px-6 py-2.5 text-sm font-semibold text-pub-bark transition-colors hover:bg-pub-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-beige"
                      >
                        Saiba mais
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Prev / Next ──────────────────────────────────────────────────── */}
      {total > 1 && (
        <>
          <button
            aria-label="Slide anterior"
            onClick={scrollPrev}
            className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-pub-bark/50 text-pub-beige backdrop-blur-sm transition-colors hover:bg-pub-bark/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold sm:flex"
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <button
            aria-label="Próximo slide"
            onClick={scrollNext}
            className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-pub-bark/50 text-pub-beige backdrop-blur-sm transition-colors hover:bg-pub-bark/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold sm:flex"
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </>
      )}

      {/* ── Dots + Pause ─────────────────────────────────────────────────── */}
      {total > 1 && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex items-center justify-center gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              aria-label={`Ir para slide ${i + 1} de ${total}`}
              aria-current={i === selectedIndex ? "true" : undefined}
              onClick={() => scrollTo(i)}
              className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold ${
                i === selectedIndex
                  ? "w-6 bg-pub-gold"
                  : "w-1.5 bg-pub-beige/30 hover:bg-pub-beige/60"
              }`}
            />
          ))}
        </div>
      )}

      {/* Pause/Play — satisfies WCAG 2.2.2 (Pause, Stop, Hide) */}
      {!reducedMotion.current && total > 1 && (
        <button
          aria-label={
            isPaused
              ? "Retomar apresentação automática"
              : "Pausar apresentação automática"
          }
          onClick={togglePause}
          className="absolute bottom-2.5 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-pub-bark/40 text-pub-beige/60 backdrop-blur-sm transition-colors hover:bg-pub-bark/70 hover:text-pub-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
        >
          {isPaused ? <Play size={13} aria-hidden /> : <Pause size={13} aria-hidden />}
        </button>
      )}
    </section>
  );
}
