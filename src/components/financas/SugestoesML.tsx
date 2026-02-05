import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useIgrejaId } from '@/hooks/useIgrejaId'
import { useFilialId } from '@/hooks/useFilialId'
import { useHideValues } from '@/hooks/useHideValues'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Sparkles, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface SugestaoML {
  id: string
  tipo_match: string
  extrato_ids: string[]
  transacao_ids: string[]
  score: number
  features: Record<string, unknown> | null
  status: string
  created_at: string
  igreja_id?: string
}

interface SugestoesMLProps {
  contaId?: string
  onAplicar?: () => void
}

export function SugestoesML({ contaId, onAplicar }: SugestoesMLProps) {
  const { igrejaId } = useIgrejaId()
  const { filialId, isAllFiliais } = useFilialId()
  const { formatValue } = useHideValues()
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Fetch sugestões pendentes
  const { data: sugestoes, isLoading } = useQuery({
    queryKey: ['sugestoes-ml', igrejaId, contaId],
    queryFn: async (): Promise<SugestaoML[]> => {
      if (!igrejaId) return []

      let query = supabase
        .from('conciliacao_ml_sugestoes')
        .select('*')
        .eq('igreja_id', igrejaId)
        .eq('status', 'pendente')
        .order('score', { ascending: false })

      if (contaId && contaId !== 'all') {
        query = query.eq('conta_id', contaId)
      }

      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []) as SugestaoML[]
    },
    enabled: !!igrejaId,
  })

  // Mutation para aceitar sugestão
  const aceitarSugestao = useMutation({
    mutationFn: async (sugestaoId: string) => {
      const { data, error } = await supabase.rpc('aplicar_sugestao_conciliacao', {
        p_sugestao_id: sugestaoId,
        p_usuario_id: (await supabase.auth.getUser()).data.user?.id,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Sugestão aplicada com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['sugestoes-ml'] })
      queryClient.invalidateQueries({ queryKey: ['extratos-pendentes-inteligente'] })
      queryClient.invalidateQueries({ queryKey: ['transacoes-pendentes-inteligente'] })
      onAplicar?.()
    },
    onError: (error) => {
      toast.error('Erro ao aplicar sugestão: ' + (error as Error).message)
    },
  })

  // Mutation para rejeitar sugestão
  const rejeitarSugestao = useMutation({
    mutationFn: async (sugestaoId: string) => {
      const sugestao = sugestoes?.find((s) => s.id === sugestaoId)
      if (!sugestao) throw new Error('Sugestão não encontrada')

      // Buscar profile id do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      // Chamar RPC para rejeitar
      const { error } = await supabase.rpc('rejeitar_sugestao_conciliacao', {
        p_sugestao_id: sugestaoId,
        p_usuario_id: profile?.id || null,
      })

      if (error) throw error
    },
    onSuccess: () => {
      toast.info('Sugestão rejeitada')
      queryClient.invalidateQueries({ queryKey: ['sugestoes-ml'] })
    },
    onError: (error) => {
      toast.error('Erro ao rejeitar: ' + (error as Error).message)
    },
  })

  const getScoreBadge = (score: number) => {
    if (score >= 0.9) return <Badge className="bg-green-500">Alta ({(score * 100).toFixed(0)}%)</Badge>
    if (score >= 0.7) return <Badge className="bg-yellow-500">Média ({(score * 100).toFixed(0)}%)</Badge>
    return <Badge variant="outline">Baixa ({(score * 100).toFixed(0)}%)</Badge>
  }

  const sugestoesAltas = sugestoes?.filter((s) => s.score >= 0.9) || []

  const aplicarTodasAltas = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser()
      const userId = user.data.user?.id
      
      const promises = sugestoesAltas.map((s) =>
        supabase.rpc('aplicar_sugestao_conciliacao', {
          p_sugestao_id: s.id,
          p_usuario_id: userId,
        })
      )
      const results = await Promise.allSettled(promises)
      const erros = results.filter((r) => r.status === 'rejected')
      return { total: results.length, erros: erros.length }
    },
    onSuccess: (result) => {
      if (result.erros > 0) {
        toast.warning(`${result.total - result.erros} de ${result.total} sugestões aplicadas`)
      } else {
        toast.success(`${result.total} sugestões aplicadas automaticamente!`)
      }
      queryClient.invalidateQueries({ queryKey: ['sugestoes-ml'] })
      queryClient.invalidateQueries({ queryKey: ['extratos-pendentes-inteligente'] })
      queryClient.invalidateQueries({ queryKey: ['transacoes-pendentes-inteligente'] })
      onAplicar?.()
    },
    onError: (error) => {
      toast.error('Erro ao aplicar sugestões: ' + (error as Error).message)
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4" />
            Sugestões Inteligentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!sugestoes || sugestoes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4" />
            Sugestões Inteligentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Nenhuma sugestão disponível no momento.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            Sugestões Inteligentes
          </CardTitle>
          <div className="flex items-center gap-2">
            {sugestoesAltas.length > 0 && (
              <>
                <Badge variant="outline" className="text-xs">
                  {sugestoesAltas.length} alta confiança
                </Badge>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={() => aplicarTodasAltas.mutate()}
                  disabled={aplicarTodasAltas.isPending}
                >
                  {aplicarTodasAltas.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Aplicar Todas
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {sugestoes.map((sugestao) => (
              <div
                key={sugestao.id}
                className={cn(
                  'p-4 rounded-lg border-2 transition-all',
                  sugestao.score >= 0.9 ? 'border-green-300 bg-green-50' : 'border-yellow-200 bg-yellow-50/30',
                  expandedId === sugestao.id && 'ring-2 ring-blue-400'
                )}
              >
                {/* Cabeçalho: Score + Tipo de Match */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-700">
                        {sugestao.tipo_match === '1:1' && '1 Extrato ↔ 1 Transação'}
                        {sugestao.tipo_match === '1:N' && '1 Extrato ↔ N Transações'}
                        {sugestao.tipo_match === 'N:1' && 'N Extratos ↔ 1 Transação'}
                      </span>
                      {getScoreBadge(sugestao.score)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      className="h-8 w-8 bg-green-600 hover:bg-green-700"
                      onClick={() => aceitarSugestao.mutate(sugestao.id)}
                      disabled={aceitarSugestao.isPending}
                      title="Aceitar sugestão"
                    >
                      {aceitarSugestao.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8 bg-red-600 hover:bg-red-700"
                      onClick={() => rejeitarSugestao.mutate(sugestao.id)}
                      disabled={rejeitarSugestao.isPending}
                      title="Rejeitar sugestão"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Detalhes de IDs */}
                <div className="bg-white bg-opacity-60 rounded p-2 mb-3 border border-gray-200 text-xs space-y-1">
                  <div className="font-mono">
                    <span className="font-bold text-gray-700">Extrato IDs:</span>
                    <span className="ml-2 text-blue-700">{sugestao.extrato_ids.join(', ').substring(0, 50)}</span>
                  </div>
                  <div className="font-mono">
                    <span className="font-bold text-gray-700">Transação IDs:</span>
                    <span className="ml-2 text-purple-700">{sugestao.transacao_ids.join(', ').substring(0, 50)}</span>
                  </div>
                </div>

                {/* Features em Grid */}
                {sugestao.features && (
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    {(sugestao.features as Record<string, unknown>).extrato_valor !== undefined && (
                      <div className="bg-white bg-opacity-60 p-2 rounded border border-green-200">
                        <span className="font-bold text-gray-600">Valor:</span>
                        <div className="text-green-700 font-mono">
                          {formatValue((sugestao.features as Record<string, unknown>).extrato_valor as number)}
                        </div>
                      </div>
                    )}
                    {(sugestao.features as Record<string, unknown>).diferenca_dias !== undefined && (
                      <div className="bg-white bg-opacity-60 p-2 rounded border border-blue-200">
                        <span className="font-bold text-gray-600">Diferença:</span>
                        <div className="text-blue-700 font-mono">
                          {String((sugestao.features as Record<string, unknown>).diferenca_dias)} dia(s)
                        </div>
                      </div>
                    )}
                    {(sugestao.features as Record<string, unknown>).match_tipo !== undefined && (
                      <div className="bg-white bg-opacity-60 p-2 rounded border border-purple-200">
                        <span className="font-bold text-gray-600">Tipo:</span>
                        <div className="text-purple-700 font-mono">
                          {(sugestao.features as Record<string, unknown>).match_tipo ? '✓ Compatível' : '✗ Diferente'}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Rodapé: Timestamp */}
                <div className="text-[10px] text-gray-500 border-t border-gray-200 pt-2">
                  Criada em: {format(parseISO(sugestao.created_at), "dd/MMM/yy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
