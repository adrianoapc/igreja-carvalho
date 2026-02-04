import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useIgrejaId } from '@/hooks/useIgrejaId'
import { useFilialId } from '@/hooks/useFilialId'
import { useHideValues } from '@/hooks/useHideValues'
import { useGerarSuggestoesConciliacao } from '@/hooks/useGerarSuggestoesConciliacao'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Plus, Loader2, Search, Eye, EyeOff, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from 'lucide-react'
import { QuickCreateTransacaoDialog } from './QuickCreateTransacaoDialog'
import { SugestoesML } from './SugestoesML'
import { toast } from 'sonner'
import { anonymizePixDescription } from '@/utils/anonymization'

interface ExtratoItem {
  id: string
  data_transacao: string
  descricao: string
  valor: number
  tipo: 'credito' | 'debito'
  conta_id: string
}

interface TransacaoItem {
  id: string
  data_pagamento: string
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
}

interface Conta {
  id: string
  nome: string
}

export function ConciliacaoInteligente() {
  const { formatValue, hideValues, toggleHideValues } = useHideValues()
  const { igrejaId, loading: igrejaLoading } = useIgrejaId()
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId()
  const queryClient = useQueryClient()
  const { gerarSugestoes, isPending: gerando } = useGerarSuggestoesConciliacao()

  const [selectedExtratos, setSelectedExtratos] = useState<string[]>([])
  const [selectedTransacoes, setSelectedTransacoes] = useState<string[]>([])
  const [quickCreateDialogOpen, setQuickCreateDialogOpen] = useState(false)
  const [extratoParaQuickCreate, setExtratoParaQuickCreate] = useState<ExtratoItem | null>(null)
  
  // Filtros gerais
  const [contaFiltro, setContaFiltro] = useState<string>('all')
  const [tipoFiltro, setTipoFiltro] = useState<string>('all')
  const [searchExtrato, setSearchExtrato] = useState('')
  
  
  // Month pickers independentes
  const [mesExtratos, setMesExtratos] = useState(new Date())
  const [mesTransacoes, setMesTransacoes] = useState(new Date())

  // Gerar sugestões ao abrir a tela
  useEffect(() => {
    if (igrejaId) {
      gerarSugestoes({
        igreja_id: igrejaId,
        conta_id: contaFiltro !== 'all' ? contaFiltro : undefined,
        mes_inicio: format(startOfMonth(mesExtratos), 'yyyy-MM-dd'),
        mes_fim: format(endOfMonth(mesExtratos), 'yyyy-MM-dd'),
        score_minimo: 0.7,
      })
    }
  }, [igrejaId, contaFiltro, mesExtratos])

  // Fetch accounts
  const { data: contas } = useQuery<Conta[]>({
    queryKey: ['contas-conciliacao', igrejaId],
    queryFn: async () => {
      if (!igrejaId) return []
      const { data } = await supabase
        .from('contas')
        .select('id, nome')
        .eq('igreja_id', igrejaId)
        .eq('ativo', true)
      return data || []
    },
    enabled: !!igrejaId,
  })

  // Fetch pending statements
  const { data: extratos, isLoading: loadingExtratos } = useQuery<ExtratoItem[]>({
    queryKey: ['extratos-pendentes-inteligente', igrejaId, filialId, isAllFiliais, mesExtratos],
    queryFn: async () => {
      if (!igrejaId) return []
      
      const inicio = startOfMonth(mesExtratos)
      const fim = endOfMonth(mesExtratos)
      
      let query = supabase
        .from('extratos_bancarios')
        .select('id, data_transacao, descricao, valor, tipo, conta_id')
        .eq('igreja_id', igrejaId)
        .eq('reconciliado', false)
        .is('transacao_vinculada_id', null)
        .not('descricao', 'ilike', '%contamax%')
        .gte('data_transacao', format(inicio, 'yyyy-MM-dd'))
        .lte('data_transacao', format(fim, 'yyyy-MM-dd'))
        .order('data_transacao', { ascending: false })

      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId)
      }
      if (contaFiltro !== 'all') {
        query = query.eq('conta_id', contaFiltro)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  })

  // Fetch unreconciled transactions
  const { data: transacoes, isLoading: loadingTransacoes } = useQuery<TransacaoItem[]>({
    queryKey: ['transacoes-pendentes-inteligente', igrejaId, filialId, isAllFiliais, mesTransacoes, contaFiltro],
    queryFn: async () => {
      if (!igrejaId) return []
      
      const inicio = startOfMonth(mesTransacoes)
      const fim = endOfMonth(mesTransacoes)
      
      // Buscar IDs de transações já vinculadas (conciliação 1:1 ou N:1)
      const { data: extratosVinculados } = await supabase
        .from('extratos_bancarios')
        .select('transacao_vinculada_id')
        .eq('igreja_id', igrejaId)
        .not('transacao_vinculada_id', 'is', null)
      
      const { data: lotesVinculados } = await supabase
        .from('conciliacoes_lote')
        .select('transacao_id')
        .eq('igreja_id', igrejaId)
      
      const idsJaConciliados = new Set([
        ...(extratosVinculados || []).map(e => e.transacao_vinculada_id),
        ...(lotesVinculados || []).map(l => l.transacao_id)
      ])
      
      let query = supabase
        .from('transacoes_financeiras')
        .select('id, data_pagamento, descricao, valor, tipo, conta_id')
        .eq('igreja_id', igrejaId)
        .eq('status', 'pago')
        .gte('data_pagamento', format(inicio, 'yyyy-MM-dd'))
        .lte('data_pagamento', format(fim, 'yyyy-MM-dd'))
        .order('data_pagamento', { ascending: false })

      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId)
      }
      if (contaFiltro !== 'all') {
        query = query.eq('conta_id', contaFiltro)
      }
      
      const { data, error } = await query
      if (error) throw error
      
      // Filtrar transações já conciliadas
      return (data || []).filter(t => !idsJaConciliados.has(t.id))
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  })

  // Filter extratos
  const extratosFiltrados = useMemo(() => {
    if (!extratos) return []
    
    return extratos.filter((e) => {
      if (searchExtrato && !e.descricao.toLowerCase().includes(searchExtrato.toLowerCase())) {
        return false
      }
      if (tipoFiltro !== 'all') {
        // Mapear: entrada = credito, saida = debito
        if (tipoFiltro === 'entrada' && e.tipo !== 'credito') return false
        if (tipoFiltro === 'saida' && e.tipo !== 'debito') return false
      }
      return true
    })
  }, [extratos, searchExtrato, tipoFiltro])

  // Filter transacoes
  const transacoesFiltradas = useMemo(() => {
    if (!transacoes) return []
    return transacoes.filter((t) => {
      if (tipoFiltro !== 'all' && t.tipo !== tipoFiltro) return false
      return true
    })
  }, [transacoes, tipoFiltro])

  const sortedTransacoes = useMemo(() => {
    if (!transacoesFiltradas) return []
    if (selectedExtratos.length !== 1) {
      return transacoesFiltradas.map((t) => ({ ...t, isSuggestion: false }))
    }

    const singleExtrato = extratosFiltrados?.find((e) => e.id === selectedExtratos[0])
    if (!singleExtrato) {
      return transacoesFiltradas.map((t) => ({ ...t, isSuggestion: false }))
    }

    const extratoDate = parseISO(singleExtrato.data_transacao)
    const extratoValue = singleExtrato.valor
    const extratoTipo = singleExtrato.tipo === 'credito' ? 'entrada' : 'saida'

    return [...transacoesFiltradas]
      .map((transacao) => {
        const transacaoDate = parseISO(transacao.data_pagamento)
        const dateDiff = Math.abs(differenceInDays(extratoDate, transacaoDate))
        const valueDiff = Math.abs(extratoValue - transacao.valor)
        const typeMatch = extratoTipo === transacao.tipo

        let score = 0
        if (typeMatch) {
          if (dateDiff <= 3) score += 50
          else if (dateDiff <= 30) score += 25
          if (valueDiff === 0) score += 50
          else if (valueDiff < 50) score += 20
        }

        return { ...transacao, score, isSuggestion: score > 40 }
      })
      .sort((a, b) => b.score - a.score)
  }, [transacoesFiltradas, selectedExtratos, extratosFiltrados])

  const handleSelectExtrato = (id: string) => {
    setSelectedExtratos((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSelectTransacao = (id: string) => {
    setSelectedTransacoes((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleOpenQuickCreate = (e: React.MouseEvent, extrato: ExtratoItem) => {
    e.stopPropagation()
    setExtratoParaQuickCreate(extrato)
    setQuickCreateDialogOpen(true)
  }

  const handleQuickCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['extratos-pendentes-inteligente'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes-pendentes-inteligente'] })
  }

  const confirmarConciliacao = useMutation({
    mutationFn: async () => {
      if (selectedExtratos.length === 0 || selectedTransacoes.length === 0) {
        throw new Error('Selecione pelo menos um item de cada lado')
      }

      if (selectedTransacoes.length === 1) {
        const transacaoId = selectedTransacoes[0]
        for (const extratoId of selectedExtratos) {
          const { error } = await supabase
            .from('extratos_bancarios')
            .update({
              reconciliado: true,
              transacao_vinculada_id: transacaoId,
            })
            .eq('id', extratoId)

          if (error) throw error
        }
      } else {
        if (selectedExtratos.length === 1) {
          const extratoId = selectedExtratos[0]

          await supabase
            .from('extratos_bancarios')
            .update({ reconciliado: true })
            .eq('id', extratoId)

          const lotes = selectedTransacoes.map((transacaoId) => ({
            extrato_id: extratoId,
            transacao_id: transacaoId,
            igreja_id: igrejaId,
          }))

          const { error } = await supabase.from('conciliacoes_lote').insert(lotes)
          if (error) throw error
        } else {
          throw new Error('Múltiplos extratos com múltiplas transações não é suportado')
        }
      }
    },
    onSuccess: () => {
      toast.success(`${selectedExtratos.length} extrato(s) conciliado(s) com sucesso!`)
      setSelectedExtratos([])
      setSelectedTransacoes([])
      queryClient.invalidateQueries({ queryKey: ['extratos-pendentes-inteligente'] })
      queryClient.invalidateQueries({ queryKey: ['transacoes-pendentes-inteligente'] })
    },
    onError: (error) => {
      toast.error('Erro ao conciliar: ' + (error as Error).message)
    },
  })

  const { totalExtratos, totalTransacoes, diferenca } = useMemo(() => {
    const totalExtratos =
      extratosFiltrados
        ?.filter((e) => selectedExtratos.includes(e.id))
        .reduce((acc, item) => {
          return acc + (item.tipo === 'credito' ? item.valor : -item.valor)
        }, 0) ?? 0

    const totalTransacoes =
      transacoesFiltradas
        ?.filter((t) => selectedTransacoes.includes(t.id))
        .reduce((acc, item) => {
          return acc + (item.tipo === 'entrada' ? item.valor : -item.valor)
        }, 0) ?? 0

    const diferenca = totalExtratos - totalTransacoes
    return { totalExtratos, totalTransacoes, diferenca }
  }, [selectedExtratos, selectedTransacoes, extratosFiltrados, transacoesFiltradas])

  return (
    <div className="space-y-4">
      {/* Sugestões ML */}
      <SugestoesML
        contaId={contaFiltro}
        mesInicio={startOfMonth(mesExtratos)}
        mesFim={endOfMonth(mesExtratos)}
        onAplicar={() => {
          setSelectedExtratos([])
          setSelectedTransacoes([])
        }}
      />

      {/* Filtros Globais */}
      <div className="flex gap-2 items-center p-3 bg-card border rounded-lg flex-shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar extrato..."
            value={searchExtrato}
            onChange={(e) => setSearchExtrato(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={contaFiltro} onValueChange={setContaFiltro}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {contas?.map((conta) => (
              <SelectItem key={conta.id} value={conta.id}>
                {conta.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="entrada">Entrada (Crédito)</SelectItem>
            <SelectItem value="saida">Saída (Débito)</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="outline"
          onClick={() => gerarSugestoes({
            igreja_id: igrejaId!,
            conta_id: contaFiltro !== 'all' ? contaFiltro : undefined,
            mes_inicio: format(startOfMonth(mesExtratos), 'yyyy-MM-dd'),
            mes_fim: format(endOfMonth(mesExtratos), 'yyyy-MM-dd'),
            score_minimo: 0.7,
          })}
          disabled={gerando}
          title="Regenerar sugestões ML"
        >
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        </Button>
      </div>

      {/* Painéis com Layout Fixo */}
      <div className="flex gap-3 h-[calc(100vh-280px)]">
        {/* Painel Esquerdo - Extratos */}
        <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-card">
          {/* Header com Month Picker */}
          <div className="flex-shrink-0 px-3 py-1.5 border-b bg-muted/30">
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="font-semibold text-sm">Banco</h3>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setMesExtratos(new Date(mesExtratos.getFullYear(), mesExtratos.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-medium w-20 text-center">
                  {format(mesExtratos, 'MMM/yy', { locale: ptBR })}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setMesExtratos(new Date(mesExtratos.getFullYear(), mesExtratos.getMonth() + 1, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setSelectedExtratos([])}
                  title="Limpar seleção"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Extratos Pendentes</p>
          </div>

          {/* ScrollArea */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loadingExtratos && (
                <p className="text-xs text-muted-foreground px-2 py-1">Carregando...</p>
              )}
              {extratosFiltrados && extratosFiltrados.length === 0 && !loadingExtratos && (
                <div className="text-xs text-muted-foreground px-2 py-1">
                  <p>Nenhum extrato pendente</p>
                  {extratos && extratos.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Total: {extratos.length} (filtrado: {extratosFiltrados.length})
                    </p>
                  )}
                </div>
              )}
              {extratosFiltrados?.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectExtrato(item.id)}
                  className={cn(
                    'px-2 py-1.5 rounded border cursor-pointer transition-colors group text-xs',
                    selectedExtratos.includes(item.id)
                      ? 'bg-blue-100 dark:bg-blue-900 border-blue-400'
                      : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  <p className="font-medium truncate">{anonymizePixDescription(item.descricao)}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(item.data_transacao), 'dd/MM')}
                    </p>
                    <p
                      className={cn(
                        'font-bold text-xs',
                        selectedExtratos.includes(item.id)
                          ? 'text-blue-700 dark:text-blue-300'
                          : item.tipo === 'credito' ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {formatValue(item.valor)}
                    </p>
                  </div>
                  <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={(e) => handleOpenQuickCreate(e, item)}
                      title="Criar transação rápida"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Barra de Balanço - No Meio */}
        <div className="flex-shrink-0 w-32 flex flex-col items-center justify-center gap-2 p-3 bg-card rounded-lg border">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">Banco</p>
            <p className="font-bold text-xs text-green-600">{formatValue(totalExtratos)}</p>
          </div>
          <div className="w-full h-px bg-border"></div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">Diferença</p>
            <p
              className={cn(
                'font-bold text-sm',
                diferenca === 0 && (selectedExtratos.length > 0 || selectedTransacoes.length > 0)
                  ? 'text-green-600'
                  : 'text-red-600'
              )}
            >
              {formatValue(diferenca)}
            </p>
          </div>
          <div className="w-full h-px bg-border"></div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">Sistema</p>
            <p className="font-bold text-xs text-blue-600">{formatValue(totalTransacoes)}</p>
          </div>
          <Button 
            className="w-full mt-2"
            size="sm"
            disabled={diferenca !== 0 || (selectedExtratos.length === 0 && selectedTransacoes.length === 0) || confirmarConciliacao.isPending}
            onClick={() => confirmarConciliacao.mutate()}
          >
            {confirmarConciliacao.isPending ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                <span className="text-xs">Aguarde...</span>
              </>
            ) : (
              <span className="text-xs">Confirmar</span>
            )}
          </Button>
        </div>

        {/* Painel Direito - Transações */}
        <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-card">
          {/* Header com Month Picker */}
          <div className="flex-shrink-0 px-3 py-1.5 border-b bg-muted/30">
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="font-semibold text-sm">Sistema</h3>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setMesTransacoes(new Date(mesTransacoes.getFullYear(), mesTransacoes.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-medium w-20 text-center">
                  {format(mesTransacoes, 'MMM/yy', { locale: ptBR })}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setMesTransacoes(new Date(mesTransacoes.getFullYear(), mesTransacoes.getMonth() + 1, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setSelectedTransacoes([])}
                  title="Limpar seleção"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-none">Transações Pendentes</p>
          </div>

          {/* ScrollArea */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loadingTransacoes && (
                <p className="text-xs text-muted-foreground px-2 py-1">Carregando...</p>
              )}
              {sortedTransacoes && sortedTransacoes.length === 0 && !loadingTransacoes && (
                <p className="text-xs text-muted-foreground px-2 py-1">Nenhuma transação pendente</p>
              )}
              {sortedTransacoes?.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectTransacao(item.id)}
                  className={cn(
                    'px-2 py-1.5 rounded border cursor-pointer transition-colors text-xs',
                    selectedTransacoes.includes(item.id)
                      ? 'bg-blue-100 dark:bg-blue-900 border-blue-400'
                      : item.isSuggestion
                      ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/40'
                      : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  <p className="font-medium truncate">{item.descricao}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(item.data_pagamento), 'dd/MM')}
                    </p>
                    <p
                      className={cn(
                        'font-bold text-xs',
                        selectedTransacoes.includes(item.id)
                          ? 'text-blue-700 dark:text-blue-300'
                          : item.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {formatValue(item.valor)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      <QuickCreateTransacaoDialog
        open={quickCreateDialogOpen}
        onOpenChange={setQuickCreateDialogOpen}
        extratoItem={extratoParaQuickCreate}
        onSuccess={handleQuickCreateSuccess}
      />
    </div>
  )
}
