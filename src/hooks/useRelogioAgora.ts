import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Sentinela {
  nome: string;
  foto: string | null;
  ate: string;
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
  evento: EventoRelogio | null;
  sentinelaAtual: Sentinela | null;
  proximoSentinela: ProximoSentinela | null;
  loading: boolean;
}

export function useRelogioAgora(): RelogioAgoraData {
  const { data, isLoading } = useQuery({
    queryKey: ["relogio-agora"],
    queryFn: async () => {
      const now = new Date();
      const nowISO = now.toISOString();

      // 1. Buscar evento ativo do tipo RELOGIO
      const { data: evento, error: eventoError } = await supabase
        .from("eventos")
        .select("id, titulo, data_evento, duracao_minutos")
        .eq("tipo", "RELOGIO")
        .eq("status", "confirmado")
        .lte("data_evento", nowISO)
        .order("data_evento", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (eventoError) throw eventoError;

      if (!evento) {
        return {
          ativo: false,
          evento: null,
          sentinelaAtual: null,
          proximoSentinela: null,
        };
      }

      // Calcular fim do evento (data_evento + duracao_minutos)
      const dataInicio = new Date(evento.data_evento);
      const dataFim = new Date(
        dataInicio.getTime() + (evento.duracao_minutos || 24 * 60) * 60 * 1000
      );

      // Verificar se o evento ainda está ativo
      if (now < dataInicio || now > dataFim) {
        return {
          ativo: false,
          evento: null,
          sentinelaAtual: null,
          proximoSentinela: null,
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
        `
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
        `
        )
        .eq("evento_id", evento.id)
        .gt("data_hora_inicio", nowISO)
        .order("data_hora_inicio", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (proximoError) throw proximoError;

      return {
        ativo: true,
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
            }
          : null,
        proximoSentinela: proximoSentinela
          ? {
              nome: proximoSentinela.profiles?.nome || "Desconhecido",
              inicio: format(
                new Date(proximoSentinela.data_hora_inicio),
                "HH:mm",
                { locale: ptBR }
              ),
            }
          : null,
      };
    },
    refetchInterval: 60000, // Atualizar a cada minuto
    staleTime: 30000, // Considerar dados frescos por 30 segundos
  });

  return {
    ativo: data?.ativo || false,
    evento: data?.evento || null,
    sentinelaAtual: data?.sentinelaAtual || null,
    proximoSentinela: data?.proximoSentinela || null,
    loading: isLoading,
  };
}
