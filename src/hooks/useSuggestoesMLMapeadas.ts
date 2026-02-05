import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface SugestaoMLMapeada {
  extratoId: string
  transacaoId: string
  transacaoDescricao: string
  transacaoValor: number
  transacaoData: string
  score: number
  tipoMatch: string
  diferencaDias: number
  sugestaoId: string
  extrato_ids: string[]
  transacao_ids: string[]
}

export function useSuggestoesMLMapeadas(igrejaId?: string, contaId?: string) {
  const { data: sugestoesMap, isLoading, refetch } = useQuery({
    queryKey: ['sugestoes-ml-mapeadas', igrejaId, contaId],
    queryFn: async (): Promise<Record<string, SugestaoMLMapeada>> => {
      if (!igrejaId) return {}

      let query = supabase
        .from('conciliacao_ml_sugestoes')
        .select('*')
        .eq('igreja_id', igrejaId)
        .eq('status', 'pendente')
        .order('score', { ascending: false })

      if (contaId && contaId !== 'all') {
        query = query.eq('conta_id', contaId)
      }

      const { data: sugestoes, error } = await query
      if (error) throw error

      // Mapear sugestões por extrato_id
      const mapa: Record<string, SugestaoMLMapeada> = {}
      
      if (sugestoes && sugestoes.length > 0) {
        console.log('[useSuggestoesMLMapeadas] Sugestões brutes:', sugestoes)
        
        // Buscar dados das transações da tabela correta (transacoes_financeiras)
        const todasTransacaoIds = sugestoes.flatMap(s => s.transacao_ids)
        console.log('[useSuggestoesMLMapeadas] Todos transaction IDs:', todasTransacaoIds)
        
        const { data: transacoes } = await supabase
          .from('transacoes_financeiras')
          .select('id, descricao, valor, data_pagamento')
          .in('id', todasTransacaoIds)

        console.log('[useSuggestoesMLMapeadas] Transações encontradas:', transacoes)

        const transacoesMap = (transacoes || []).reduce((acc: Record<string, any>, t: any) => {
          acc[t.id] = t
          return acc
        }, {})

        sugestoes.forEach((sugestao: any) => {
          // A sugestão é 1:1 - um extrato para uma transação
          // extrato_ids[0] para transacao_ids[0]
          const extratoId = sugestao.extrato_ids[0]
          const transacaoId = sugestao.transacao_ids[0]
          const transacao = transacoesMap[transacaoId]
          
          console.log(`[useSuggestoesMLMapeadas] Processando: extratoId=${extratoId}, transacaoId=${transacaoId}, encontrou transacao?`, !!transacao)
          
          if (extratoId && transacaoId) {
            mapa[extratoId] = {
              extratoId,
              transacaoId,
              transacaoDescricao: transacao?.descricao || 'Transação não encontrada',
              transacaoValor: transacao?.valor || 0,
              transacaoData: transacao?.data_pagamento || '',
              score: sugestao.score,
              tipoMatch: sugestao.tipo_match || 'desconhecido',
              diferencaDias: sugestao.features?.diferenca_dias || 0,
              sugestaoId: sugestao.id,
              extrato_ids: sugestao.extrato_ids,
              transacao_ids: sugestao.transacao_ids,
            }
          }
        })
        
        console.log('[useSuggestoesMLMapeadas] Mapa final:', mapa)
      }

      return mapa
    },
    enabled: !!igrejaId,
  })

  return { sugestoesMap: sugestoesMap || {}, isLoading, refetch }
}
