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
  mesInicio: Date
  mesFim: Date
  onAplicar?: () => void
}

export function SugestoesML({ contaId, mesInicio, mesFim, onAplicar }: SugestoesMLProps) {
  const { igrejaId } = useIgrejaId()
  const { filialId, isAllFiliais } = useFilialId()
  const { formatValue } = useHideValues()
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Fetch sugestões pendentes
  const { data: sugestoes, isLoading } = useQuery({
    queryKey: ['sugestoes-ml', igrejaId, contaId, mesInicio, mesFim],
    queryFn: async (): Promise<SugestaoML[]> => {
      if (!igrejaId) return []

      let query = supabase
        .from('conciliacao_ml_sugestoes')
        .select('*')
        .eq('igreja_id', igrejaId)
        .eq('status', 'pendente')
        .gte('created_at', format(mesInicio, 'yyyy-MM-dd'))
        .lte('created_at', format(mesFim, 'yyyy-MM-dd'))
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

      // Atualizar status
      const { error: updateError } = await supabase
        .from('conciliacao_ml_sugestoes')
        .update({ status: 'rejeitada' })
        .eq('id', sugestaoId)

      if (updateError) throw updateError

      // Inserir feedback
      const { error: feedbackError } = await supabase.from('conciliacao_ml_feedback').insert({
        sugestao_id: sugestaoId,
        igreja_id: sugestao.igreja_id || igrejaId,
        tipo_match: sugestao.tipo_match,
        extrato_ids: sugestao.extrato_ids,
        transacao_ids: sugestao.transacao_ids,
        acao: 'rejeitada',
        score: sugestao.score,
        modelo_versao: 'v1',
        ajustes: {},
        usuario_id: (await supabase.auth.getUser()).data.user?.id,
      })

      if (feedbackError) throw feedbackError
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
                  'p-3 rounded-lg border transition-all',
                  sugestao.score >= 0.9 ? 'border-green-200 bg-green-50/50' : 'border-border bg-card',
                  expandedId === sugestao.id && 'ring-2 ring-blue-400'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {sugestao.tipo_match}
                      </Badge>
                      {getScoreBadge(sugestao.score)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sugestao.extrato_ids.length} extrato(s) • {sugestao.transacao_ids.length} transação(ões)
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => aceitarSugestao.mutate(sugestao.id)}
                      disabled={aceitarSugestao.isPending}
                      title="Aceitar sugestão"
                    >
                      {aceitarSugestao.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3 text-green-600" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => rejeitarSugestao.mutate(sugestao.id)}
                      disabled={rejeitarSugestao.isPending}
                      title="Rejeitar sugestão"
                    >
                      <X className="w-3 h-3 text-red-600" />
                    </Button>
                  </div>
                </div>

                {sugestao.features && (
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    {(sugestao.features as Record<string, unknown>).extrato_valor !== undefined && (
                      <div>Valor: {formatValue((sugestao.features as Record<string, unknown>).extrato_valor as number)}</div>
                    )}
                    {(sugestao.features as Record<string, unknown>).diferenca_dias !== undefined && (
                      <div>Diferença: {String((sugestao.features as Record<string, unknown>).diferenca_dias)} dia(s)</div>
                    )}
                    {(sugestao.features as Record<string, unknown>).match_tipo !== undefined && (
                      <div>Tipo: {(sugestao.features as Record<string, unknown>).match_tipo ? 'Compatível' : 'Diferente'}</div>
                    )}
                  </div>
                )}

                <div className="text-[9px] text-muted-foreground mt-1">
                  {format(parseISO(sugestao.created_at), "dd/MMM 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
