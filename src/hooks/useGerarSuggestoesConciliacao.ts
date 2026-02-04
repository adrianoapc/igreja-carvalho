import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function useGerarSuggestoesConciliacao() {
  const gerarSugestoes = useMutation({
    mutationFn: async (params: {
      igreja_id: string
      conta_id?: string | null
      mes_inicio?: string
      mes_fim?: string
      score_minimo?: number
    }) => {
      const { data, error } = await supabase.functions.invoke('gerar-sugestoes-ml', {
        body: params,
      })

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast.success(
        `${data.sugestoes_criadas || 0} sugestões geradas com score ≥ ${data.score_minimo || 0.7}`
      )
    },
    onError: (error) => {
      console.error('Erro ao gerar sugestões:', error)
      toast.error('Erro ao gerar sugestões ML')
    },
  })

  return { gerarSugestoes: gerarSugestoes.mutate, isPending: gerarSugestoes.isPending }
}
