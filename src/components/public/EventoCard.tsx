import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

export interface EventoPublico {
  id: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  local: string | null;
  endereco: string | null;
  tipo: string;
  status: string;
  requer_inscricao: boolean;
  valor_inscricao: number | null;
  vagas_limite: number | null;
  banner_url: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  CULTO:   "Culto",
  RELOGIO: "Oração",
  TAREFA:  "Tarefa",
  EVENTO:  "Evento",
  OUTRO:   "Outro",
};

interface EventoCardProps {
  evento: EventoPublico;
  /** Quando true, trunca o título e não mostra descrição (modo grade) */
  compact?: boolean;
}

export function EventoCard({ evento, compact = false }: EventoCardProps) {
  const data  = new Date(evento.data_evento);
  const dia   = format(data, "d", { locale: ptBR });
  const mes   = format(data, "MMM", { locale: ptBR }).toUpperCase();
  const hora  = format(data, "HH:mm", { locale: ptBR });
  const label = TIPO_LABEL[evento.tipo] ?? evento.tipo;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-pub-bark/5 shadow-sm transition-shadow hover:shadow-md">
      {/* Imagem do banner (opcional) */}
      {evento.banner_url ? (
        <div className="relative aspect-video overflow-hidden bg-pub-green/10">
          <img
            src={evento.banner_url}
            alt={`Arte do evento: ${evento.titulo}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {/* Badge de tipo sobre a imagem */}
          <span className="absolute left-3 top-3 rounded-full bg-pub-gold px-2.5 py-0.5 text-[11px] font-semibold text-pub-bark">
            {label}
          </span>
        </div>
      ) : (
        /* Placeholder colorido sem imagem */
        <div className="relative flex items-center justify-center bg-pub-green px-6 py-8">
          {/* Data em destaque */}
          <div className="flex flex-col items-center text-center">
            <span className="font-serif text-5xl font-bold leading-none text-pub-beige">
              {dia}
            </span>
            <span className="mt-1 text-xs font-semibold tracking-[0.2em] text-pub-beige uppercase">
              {mes}
            </span>
          </div>
          {/* Badge de tipo */}
          <span className="absolute right-3 top-3 rounded-full bg-pub-gold px-2.5 py-0.5 text-[11px] font-semibold text-pub-bark">
            {label}
          </span>
        </div>
      )}

      {/* Corpo do card */}
      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        {/* Data + hora (só aparece no modo com imagem, já que no placeholder fica no topo) */}
        {evento.banner_url && (
          <div className="flex items-center gap-1.5 text-xs text-pub-bark/50">
            <Calendar size={12} aria-hidden />
            <time dateTime={evento.data_evento}>
              {format(data, "d 'de' MMMM", { locale: ptBR })}
            </time>
            <span aria-hidden>·</span>
            <Clock size={12} aria-hidden />
            <span>{hora}</span>
          </div>
        )}

        {/* Sem banner: mostra hora embaixo da data do topo */}
        {!evento.banner_url && (
          <div className="flex items-center gap-1 text-xs text-pub-bark/40">
            <Clock size={12} aria-hidden />
            <span>{hora}</span>
          </div>
        )}

        {/* Título */}
        <h3
          className={`font-serif font-semibold text-pub-bark leading-snug ${
            compact ? "line-clamp-2 text-base" : "text-lg"
          }`}
        >
          {evento.titulo}
        </h3>

        {/* Descrição (só no modo não-compacto) */}
        {!compact && evento.descricao && (
          <p className="text-sm leading-relaxed text-pub-bark/55 line-clamp-2">
            {evento.descricao}
          </p>
        )}

        {/* Local */}
        {evento.local && (
          <div className="mt-auto flex items-start gap-1.5 text-xs text-pub-bark/50">
            <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{evento.local}</span>
          </div>
        )}

        {/* Inscrição obrigatória */}
        {evento.requer_inscricao && (
          <div className="flex items-center justify-between border-t border-pub-bark/5 pt-3">
            <span className="text-xs font-medium text-pub-green">
              {evento.valor_inscricao && evento.valor_inscricao > 0
                ? `Inscrição: R$ ${evento.valor_inscricao.toFixed(2).replace(".", ",")}`
                : "Inscrição gratuita"}
            </span>
            {evento.vagas_limite && (
              <span className="text-xs text-pub-bark/40">
                {evento.vagas_limite} vagas
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
