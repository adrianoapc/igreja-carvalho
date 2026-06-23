import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Seo } from "@/components/Seo";
import { EventoCard } from "@/components/public/EventoCard";
import { useEventosPublicos } from "@/hooks/useEventosPublicos";

/** Agrupa eventos por mês/ano e retorna em ordem cronológica. */
function agruparPorMes(
  eventos: ReturnType<typeof useEventosPublicos>["eventos"]
) {
  const grupos: Record<string, { label: string; items: typeof eventos }> = {};

  for (const ev of eventos) {
    const data  = new Date(ev.data_evento);
    const chave = format(data, "yyyy-MM");
    const label = format(data, "MMMM 'de' yyyy", { locale: ptBR });

    if (!grupos[chave]) grupos[chave] = { label, items: [] };
    grupos[chave].items.push(ev);
  }

  return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
}

export default function PublicAgenda() {
  const { eventos, loading, error } = useEventosPublicos();
  const grupos = agruparPorMes(eventos);

  return (
    <>
      <Seo
        title="Agenda"
        description="Confira os próximos cultos, eventos e encontros da Igreja Carvalho."
        url="https://igrejacarvalho.com.br/agenda"
      />

      {/* Cabeçalho da página */}
      <div className="bg-pub-green px-4 pb-12 pt-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pub-gold">
          Venha participar
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-pub-beige sm:text-5xl">
          Agenda
        </h1>
        <p className="mt-4 text-pub-beige/60">
          Próximos cultos e eventos da Igreja Carvalho.
        </p>
      </div>

      <div className="bg-pub-beige px-4 py-16">
        <div className="mx-auto max-w-6xl">

          {/* Estado: carregando */}
          {loading && (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i}>
                  <div className="animate-pulse rounded-2xl bg-white/70 h-64" aria-hidden="true" />
                </li>
              ))}
            </ul>
          )}

          {/* Estado: erro */}
          {!loading && error && (
            <div className="rounded-2xl border-2 border-dashed border-pub-bark/10 py-16 text-center text-pub-bark/40">
              <p className="text-lg font-serif">{error}</p>
            </div>
          )}

          {/* Estado: nenhum evento */}
          {!loading && !error && eventos.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-pub-green/15 py-20 text-center">
              <p className="font-serif text-xl text-pub-bark/40">
                Nenhum evento agendado no momento.
              </p>
              <p className="mt-2 text-sm text-pub-bark/30">
                Acompanhe nossas redes sociais para novidades.
              </p>
            </div>
          )}

          {/* Grupos por mês */}
          {!loading && !error && grupos.length > 0 && (
            <div className="flex flex-col gap-14">
              {grupos.map(([chave, { label, items }]) => (
                <section key={chave} aria-labelledby={`mes-${chave}`}>
                  {/* Título do mês */}
                  <h2
                    id={`mes-${chave}`}
                    className="mb-6 font-serif text-2xl font-bold capitalize text-pub-bark"
                  >
                    {label}
                  </h2>

                  <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
                    {items.map((evento) => (
                      <li key={evento.id}>
                        <EventoCard evento={evento} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
