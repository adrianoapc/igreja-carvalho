import { PlayCircle, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Seo } from "@/components/Seo";
import { useYoutubeVideos } from "@/hooks/useYoutubeVideos";

const CHANNEL_ID = import.meta.env.VITE_YOUTUBE_CHANNEL_ID as string | undefined;

function VideoCard({ video }: { video: { videoId: string; title: string; publishedAt: string; thumbnail: string } }) {
  const date = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(video.publishedAt));

  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl ring-1 ring-pub-bark/8 shadow-sm bg-white transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
      aria-label={`Assistir: ${video.title}`}
    >
      <div className="relative aspect-video bg-pub-green/10 overflow-hidden">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PlayCircle className="h-12 w-12 text-pub-green/30" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-pub-bark/0 transition-colors group-hover:bg-pub-bark/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            <PlayCircle className="h-6 w-6 text-pub-green" aria-hidden />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-pub-bark/35">
          {date}
        </p>
        <h3 className="font-serif text-base font-semibold leading-snug text-pub-bark line-clamp-2">
          {video.title}
        </h3>
      </div>
    </a>
  );
}

export default function PublicMensagens() {
  const { videos, loading, error } = useYoutubeVideos(12);

  const notConfigured = error === "not-configured";
  const channelUrl = CHANNEL_ID
    ? `https://www.youtube.com/channel/${CHANNEL_ID}`
    : "https://youtube.com/@igrejacarvalho";

  return (
    <>
      <Seo
        title="Mensagens"
        description="Ouça e assista às mensagens pregadas na Igreja Carvalho."
        url="https://igrejacarvalho.com.br/mensagens"
      />

      {/* Cabeçalho */}
      <div className="bg-pub-green px-4 pb-12 pt-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pub-beige/65">
          Canal no YouTube
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-pub-beige sm:text-5xl">
          Mensagens
        </h1>
        <p className="mt-4 text-pub-beige/60">
          Sermões e pregações da Igreja Carvalho.
        </p>
      </div>

      <section
        className="bg-pub-beige/40 px-4 py-16"
        aria-labelledby="mensagens-heading"
      >
        <div className="mx-auto max-w-6xl">

          {/* Estado: carregando */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-pub-green/50" />
              <p className="text-sm text-pub-bark/40">Carregando mensagens…</p>
            </div>
          )}

          {/* Estado: não configurado */}
          {notConfigured && (
            <div className="rounded-xl border-2 border-dashed border-pub-green/20 p-16 text-center">
              <p className="font-serif text-lg text-pub-bark/50">
                Canal ainda não configurado
              </p>
              <p className="mt-2 text-xs text-pub-bark/30">
                Adicione <code className="rounded bg-pub-beige px-1 text-[11px]">VITE_YOUTUBE_API_KEY</code> e{" "}
                <code className="rounded bg-pub-beige px-1 text-[11px]">VITE_YOUTUBE_CHANNEL_ID</code> nas variáveis de ambiente.
              </p>
            </div>
          )}

          {/* Estado: erro da API */}
          {error && !notConfigured && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-pub-bark/50">
                Não foi possível carregar os vídeos. Tente novamente em instantes.
              </p>
              <a
                href={channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-pub-green hover:underline"
              >
                <ExternalLink size={14} aria-hidden />
                Ver canal no YouTube
              </a>
            </div>
          )}

          {/* Grid de vídeos */}
          {!loading && !error && videos.length > 0 && (
            <>
              <ul
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                role="list"
                aria-label="Lista de mensagens"
              >
                {videos.map((video) => (
                  <li key={video.videoId}>
                    <VideoCard video={video} />
                  </li>
                ))}
              </ul>

              <div className="mt-12 text-center">
                <a
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-pub-green px-6 py-3 text-sm font-medium text-pub-green transition-colors hover:bg-pub-green hover:text-pub-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
                >
                  <ExternalLink size={15} aria-hidden />
                  Ver todos os vídeos no YouTube
                </a>
              </div>
            </>
          )}

        </div>
      </section>
    </>
  );
}
