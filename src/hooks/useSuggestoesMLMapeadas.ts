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

export function useSuggestoesMLMapeadas(
  igrejaId?: string,
  contaId?: string,
  extratoIds?: string[]
) {
  const extratoIdsKey = extratoIds?.slice().sort().join(',') || 'all'

  const { data: sugestoesMap, isLoading, refetch } = useQuery({
    queryKey: ['sugestoes-ml-mapeadas', igrejaId, contaId, extratoIdsKey],
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

      if (extratoIds && extratoIds.length > 0) {
        query = query.overlaps('extrato_ids', extratoIds)
      }

      const { data: sugestoes, error } = await query
      if (error) throw error

      // Filtro adicional no lado do cliente para garantir que apenas pendentes sejam processadas
      const sugestoesPendentes = (sugestoes || []).filter(s => s.status === 'pendente')

      // Mapear sugestões por extrato_id
      const mapa: Record<string, SugestaoMLMapeada> = {}
      
      if (sugestoesPendentes && sugestoesPendentes.length > 0) {
        // Buscar dados das transações da tabela correta (transacoes_financeiras)
        const todasTransacaoIds = sugestoesPendentes.flatMap(s => s.transacao_ids)
        
        const { data: transacoes } = await supabase
          .from('transacoes_financeiras')
          .select('id, descricao, valor, data_pagamento')
          .in('id', todasTransacaoIds)

        const transacoesMap = (transacoes || []).reduce((acc: Record<string, any>, t: any) => {
          acc[t.id] = t
          return acc
        }, {})

        sugestoesPendentes.forEach((sugestao: any) => {
          // A sugestão é 1:1 - um extrato para uma transação
          // extrato_ids[0] para transacao_ids[0]
          const extratoId = sugestao.extrato_ids[0]
          const transacaoId = sugestao.transacao_ids[0]
          const transacao = transacoesMap[transacaoId]
          
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
      }

      return mapa
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  return { sugestoesMap: sugestoesMap || {}, isLoading, refetch }
}
