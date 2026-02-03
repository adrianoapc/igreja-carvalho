import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Sentinela {
  nome: string;
  foto: string | null;
  ate: string;
  escalaId: string;
}

interface ProximoSentinela {
  nome: string;
  inicio: string;
}

interface EventoRelogio {
  id: string;
  titulo: string;
}

interface RelogioAgoraData {
  ativo: boolean;
  agendado: boolean;
  evento: EventoRelogio | null;
  sentinelaAtual: Sentinela | null;
  proximoSentinela: ProximoSentinela | null;
  inicioEvento: string | null;
  totalTurnos: number;
  turnosSemSentinela: number;
  loading: boolean;
  eventoId?: string;
}

export function useRelogioAgora(): RelogioAgoraData {
  const { data, isLoading } = useQuery({
    queryKey: ["relogio-agora"],
    queryFn: async () => {
      const now = new Date();
      const nowISO = now.toISOString();

      const buildAgendado = async (eventoBase: {
        id: string;
        titulo: string;
        data_evento: string;
        duracao_minutos: number | null;
      }) => {
        const { data: primeiraSentinela, error: primeiraSentinelaError } =
          await supabase
            .from("escalas")
            .select(
              `
              id,
              data_hora_inicio,
              profiles:pessoa_id (
                nome
              )
            `,
            )
            .eq("evento_id", eventoBase.id)
            .order("data_hora_inicio", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (primeiraSentinelaError) throw primeiraSentinelaError;

        const { count: escalasCount, error: escalasCountError } = await supabase
          .from("escalas")
          .select("id", { count: "exact", head: true })
          .eq("evento_id", eventoBase.id);

        if (escalasCountError) throw escalasCountError;

        const totalTurnos = Math.max(
          1,
          Math.round((eventoBase.duracao_minutos || 24 * 60) / 60),
        );
        const turnosSemSentinela = Math.max(
          0,
          totalTurnos - (escalasCount || 0),
        );

        return {
          ativo: false,
          agendado: true,
          evento: {
            id: eventoBase.id,
            titulo: eventoBase.titulo,
          },
          sentinelaAtual: null,
          proximoSentinela: primeiraSentinela
            ? {
                nome: primeiraSentinela.profiles?.nome || "Desconhecido",
                inicio: format(
                  new Date(primeiraSentinela.data_hora_inicio),
                  "HH:mm",
                  { locale: ptBR },
                ),
              }
            : null,
          inicioEvento: format(
            new Date(eventoBase.data_evento),
            "dd/MM 'às' HH:mm",
            { locale: ptBR },
          ),
          totalTurnos,
          turnosSemSentinela,
        };
      };

      // 1. Buscar evento ativo do tipo RELOGIO
      const { data: evento, error: eventoError } = await supabase
        .from("eventos")
        .select("id, titulo, data_evento, duracao_minutos, status")
        .eq("tipo", "RELOGIO")
        .in("status", ["confirmado", "planejado"])
        .lte("data_evento", nowISO)
        .order("data_evento", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (eventoError) throw eventoError;

      if (!evento) {
        const { data: proximoEvento, error: proximoEventoError } =
          await supabase
            .from("eventos")
            .select("id, titulo, data_evento, duracao_minutos, status")
            .eq("tipo", "RELOGIO")
            .in("status", ["confirmado", "planejado"])
            .gt("data_evento", nowISO)
            .order("data_evento", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (proximoEventoError) throw proximoEventoError;

        if (!proximoEvento) {
          return {
            ativo: false,
            agendado: false,
            evento: null,
            sentinelaAtual: null,
            proximoSentinela: null,
            inicioEvento: null,
            totalTurnos: 0,
            turnosSemSentinela: 0,
          };
        }

        return buildAgendado(proximoEvento);
      }

      // Calcular fim do evento (data_evento + duracao_minutos)
      const dataInicio = new Date(evento.data_evento);
      const dataFim = new Date(
        dataInicio.getTime() + (evento.duracao_minutos || 24 * 60) * 60 * 1000,
      );

      // Verificar se o evento ainda está ativo
      if (now < dataInicio || now > dataFim || evento.status === "planejado") {
        const { data: proximoEvento, error: proximoEventoError } =
          await supabase
            .from("eventos")
            .select("id, titulo, data_evento, duracao_minutos, status")
            .eq("tipo", "RELOGIO")
            .in("status", ["confirmado", "planejado"])
            .gt("data_evento", nowISO)
            .order("data_evento", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (proximoEventoError) throw proximoEventoError;

        if (proximoEvento) {
          return buildAgendado(proximoEvento);
        }

        return {
          ativo: false,
          agendado: false,
          evento: null,
          sentinelaAtual: null,
          proximoSentinela: null,
          inicioEvento: null,
          totalTurnos: 0,
          turnosSemSentinela: 0,
        };
      }

      // 2. Buscar sentinela atual
      const { data: sentinelaAtual, error: sentinelaError } = await supabase
        .from("escalas")
        .select(
          `
          id,
          data_hora_inicio,
          data_hora_fim,
          profiles:pessoa_id (
            nome,
            avatar_url
          )
        `,
        )
        .eq("evento_id", evento.id)
        .lte("data_hora_inicio", nowISO)
        .gte("data_hora_fim", nowISO)
        .limit(1)
        .maybeSingle();

      if (sentinelaError) throw sentinelaError;

      // 3. Buscar próximo sentinela
      const { data: proximoSentinela, error: proximoError } = await supabase
        .from("escalas")
        .select(
          `
          id,
          data_hora_inicio,
          profiles:pessoa_id (
            nome
          )
        `,
        )
        .eq("evento_id", evento.id)
        .gt("data_hora_inicio", nowISO)
        .order("data_hora_inicio", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (proximoError) throw proximoError;

      const { count: escalasCount, error: escalasCountError } = await supabase
        .from("escalas")
        .select("id", { count: "exact", head: true })
        .eq("evento_id", evento.id);

      if (escalasCountError) throw escalasCountError;

      const totalTurnos = Math.max(
        1,
        Math.round((evento.duracao_minutos || 24 * 60) / 60),
      );
      const turnosSemSentinela = Math.max(0, totalTurnos - (escalasCount || 0));

      return {
        ativo: true,
        agendado: false,
        evento: {
          id: evento.id,
          titulo: evento.titulo,
        },
        sentinelaAtual: sentinelaAtual
          ? {
              nome: sentinelaAtual.profiles?.nome || "Desconhecido",
              foto: sentinelaAtual.profiles?.avatar_url || null,
              ate: format(new Date(sentinelaAtual.data_hora_fim), "HH:mm", {
                locale: ptBR,
              }),
              escalaId: sentinelaAtual.id,
            }
          : null,
        proximoSentinela: proximoSentinela
          ? {
              nome: proximoSentinela.profiles?.nome || "Desconhecido",
              inicio: format(
                new Date(proximoSentinela.data_hora_inicio),
                "HH:mm",
                { locale: ptBR },
              ),
            }
          : null,
        inicioEvento: format(new Date(evento.data_evento), "dd/MM 'às' HH:mm", {
          locale: ptBR,
        }),
        totalTurnos,
        turnosSemSentinela,
      };
    },
    refetchInterval: 60000, // Atualizar a cada minuto
    staleTime: 30000, // Considerar dados frescos por 30 segundos
  });

  return {
    ativo: data?.ativo || false,
    agendado: data?.agendado || false,
    evento: data?.evento || null,
    sentinelaAtual: data?.sentinelaAtual || null,
    proximoSentinela: data?.proximoSentinela || null,
    inicioEvento: data?.inicioEvento || null,
    totalTurnos: data?.totalTurnos || 0,
    turnosSemSentinela: data?.turnosSemSentinela || 0,
    loading: isLoading,
    eventoId: data?.evento?.id,
  };
}
