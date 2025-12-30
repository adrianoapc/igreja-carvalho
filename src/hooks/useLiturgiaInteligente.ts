import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PlaylistItem {
  id: string;
  titulo: string;
  url?: string;
  duracao?: number;
  [key: string]: any;
}

interface AlertaEspiritual {
  tipo: string;
  titulo: string;
  mensagem: string;
  totalSentimentos?: number;
  percentualNegativos?: number;
}

interface LiturgiaPlaylist {
  alerta?: AlertaEspiritual;
  testemunhos: PlaylistItem[];
  visitantes: PlaylistItem[];
  broadcast: PlaylistItem[];
  pessoais: PlaylistItem[];
  slides?: any[]; // Slides prontos retornados pela Edge Function
}

export function useLiturgiaInteligente(eventoId?: string) {
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<LiturgiaPlaylist | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        console.log("📡 Carregando playlist da Edge Function...");

        // Chama a Edge Function enviando o evento_id
        const { data, error } = await supabase.functions.invoke(
          "playlist-oracao",
          {
            body: { evento_id: eventoId },
          }
        );

        if (error) {
          console.error("❌ Erro da Edge Function:", error);
          throw error;
        }

        console.log("✅ Playlist carregada:", data);
        setPlaylist(data);
        setError(null);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Erro desconhecido";
        console.error("❌ Erro ao carregar playlist da Edge:", e);
        setError(errorMsg);
        // Fallback com dados vazios
        setPlaylist({
          alerta: undefined,
          testemunhos: [],
          visitantes: [],
          broadcast: [],
          pessoais: [],
        });
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [eventoId]);

  return {
    loading,
    error,
    // Mapeando o retorno exato da Edge Function
    // alertaEspiritual é um objeto único, convertemos para array se existir
    alertaEspiritual: playlist?.alerta
      ? [
          {
            id: `alerta-${Date.now()}`,
            titulo: playlist.alerta.titulo,
            conteudo: playlist.alerta.mensagem,
            tipo: playlist.alerta.tipo,
            ...playlist.alerta,
          },
        ]
      : [],
    testemunhos: playlist?.testemunhos || [],
    visitantes: playlist?.visitantes || [],
    broadcast: playlist?.broadcast || [],
    pessoais: playlist?.pessoais || [],
    slides: playlist?.slides || null, // Slides prontos da Edge Function
    // Função para recarregar
    refetch: async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "playlist-oracao",
          {
            body: { evento_id: eventoId },
          }
        );
        if (error) throw error;
        setPlaylist(data);
      } catch (e) {
        console.error("Erro ao recarregar playlist:", e);
      } finally {
        setLoading(false);
      }
    },
  };
}
