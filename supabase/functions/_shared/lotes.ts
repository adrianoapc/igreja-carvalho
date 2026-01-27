/**
 * ADR-016: Utilitários para buscar lotes ativos
 * Função compartilhada entre chatbot-triagem e inscricao-compartilhe
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface LoteAtivo {
  id: string;
  nome: string;
  valor: number;
  vagas_disponiveis: number;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
}

/**
 * Busca o lote ativo com menor valor e vagas disponíveis
 * Para um evento em uma igreja
 *
 * @param supabase - Cliente Supabase
 * @param eventoId - ID do evento
 * @param igrejaId - ID da igreja
 * @returns LoteAtivo com vagas disponíveis, ou null se nenhum disponível
 */
export async function buscarLoteAtivo(
  supabase: SupabaseClient,
  eventoId: string,
  igrejaId: string
): Promise<LoteAtivo | null> {
  try {
    const agora = new Date().toISOString();

    // Buscar lotes ativos (vigência dentro do período) ordenados por valor
    // Usa os campos corretos da tabela: vigencia_inicio, vigencia_fim, vagas_limite, vagas_utilizadas
    const { data: lotes, error: lotesError } = await supabase
      .from("evento_lotes")
      .select("id, nome, valor, vagas_limite, vagas_utilizadas, vigencia_inicio, vigencia_fim, ativo")
      .eq("evento_id", eventoId)
      .eq("igreja_id", igrejaId)
      .eq("ativo", true)
      .order("valor", { ascending: true });

    if (lotesError) {
      console.error(`[Lotes] Erro ao buscar lotes: ${lotesError.message}`);
      return null;
    }

    if (!lotes || lotes.length === 0) {
      console.log(`[Lotes] Nenhum lote encontrado para evento ${eventoId}`);
      return null;
    }

    // Filtrar lotes por vigência (campos podem ser null = sem limite)
    const lotesVigentes = lotes.filter((lote) => {
      const inicioOk = !lote.vigencia_inicio || new Date(lote.vigencia_inicio) <= new Date(agora);
      const fimOk = !lote.vigencia_fim || new Date(lote.vigencia_fim) >= new Date(agora);
      return inicioOk && fimOk;
    });

    if (lotesVigentes.length === 0) {
      console.log(`[Lotes] Nenhum lote ativo dentro da vigência para evento ${eventoId}`);
      return null;
    }

    // Para cada lote, verificar vagas disponíveis
    for (const lote of lotesVigentes) {
      // Se não há limite de vagas, está disponível
      if (!lote.vagas_limite) {
        console.log(`[Lotes] Lote disponível (sem limite): ${lote.id} - ${lote.nome}`);
        return {
          id: lote.id,
          nome: lote.nome,
          valor: lote.valor,
          vagas_disponiveis: Infinity,
          vigencia_inicio: lote.vigencia_inicio,
          vigencia_fim: lote.vigencia_fim,
        };
      }

      // Usar vagas_utilizadas que já está na tabela (atualizado por trigger)
      const vagasDisponiveis = lote.vagas_limite - (lote.vagas_utilizadas || 0);

      if (vagasDisponiveis > 0) {
        console.log(`[Lotes] Lote disponível: ${lote.id} - ${lote.nome} (${vagasDisponiveis} vagas)`);
        return {
          id: lote.id,
          nome: lote.nome,
          valor: lote.valor,
          vagas_disponiveis: vagasDisponiveis,
          vigencia_inicio: lote.vigencia_inicio,
          vigencia_fim: lote.vigencia_fim,
        };
      }

      console.log(`[Lotes] Lote esgotado: ${lote.id} - ${lote.nome}`);
    }

    console.log(`[Lotes] Todos os lotes esgotados para evento ${eventoId}`);
    return null;
  } catch (error) {
    console.error(`[Lotes] Exceção ao buscar lote ativo:`, error);
    return null;
  }
}

/**
 * Busca todos os lotes ativos de um evento (para exibir opções)
 *
 * @param supabase - Cliente Supabase
 * @param eventoId - ID do evento
 * @param igrejaId - ID da igreja
 * @returns Array de lotes ativos com vagas
 */
export async function buscarTodosLotesAtivos(
  supabase: SupabaseClient,
  eventoId: string,
  igrejaId: string
): Promise<LoteAtivo[]> {
  try {
    const agora = new Date().toISOString();

    const { data: lotes, error } = await supabase
      .from("evento_lotes")
      .select("id, nome, valor, vagas_limite, vagas_utilizadas, vigencia_inicio, vigencia_fim, ativo")
      .eq("evento_id", eventoId)
      .eq("igreja_id", igrejaId)
      .eq("ativo", true)
      .order("valor", { ascending: true });

    if (error || !lotes) {
      console.error(`[Lotes] Erro ao buscar lotes:`, error);
      return [];
    }

    const lotesComVagas: LoteAtivo[] = [];

    for (const lote of lotes) {
      // Verificar vigência
      const inicioOk = !lote.vigencia_inicio || new Date(lote.vigencia_inicio) <= new Date(agora);
      const fimOk = !lote.vigencia_fim || new Date(lote.vigencia_fim) >= new Date(agora);
      
      if (!inicioOk || !fimOk) continue;

      // Sem limite de vagas
      if (!lote.vagas_limite) {
        lotesComVagas.push({
          id: lote.id,
          nome: lote.nome,
          valor: lote.valor,
          vagas_disponiveis: Infinity,
          vigencia_inicio: lote.vigencia_inicio,
          vigencia_fim: lote.vigencia_fim,
        });
        continue;
      }

      // Com limite - usar vagas_utilizadas da tabela
      const vagasDisponiveis = lote.vagas_limite - (lote.vagas_utilizadas || 0);
      
      if (vagasDisponiveis > 0) {
        lotesComVagas.push({
          id: lote.id,
          nome: lote.nome,
          valor: lote.valor,
          vagas_disponiveis: vagasDisponiveis,
          vigencia_inicio: lote.vigencia_inicio,
          vigencia_fim: lote.vigencia_fim,
        });
      }
    }

    return lotesComVagas;
  } catch (error) {
    console.error(`[Lotes] Exceção ao buscar todos os lotes:`, error);
    return [];
  }
}
