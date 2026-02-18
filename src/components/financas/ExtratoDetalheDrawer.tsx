import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseLocalDate } from '@/utils/dateUtils'
import { useHideValues } from '@/hooks/useHideValues'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface ExtratoDetalheDrawerProps {
  extratoId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  entradaVinculada?: {
    id: string;
    descricao: string;
    valor: number;
    data_pagamento: string;
  } | null
}

export function ExtratoDetalheDrawer({
  extratoId,
  open,
  onOpenChange,
  entradaVinculada,
}: ExtratoDetalheDrawerProps) {
  const { formatValue } = useHideValues()
  const [copiedExtratoId, setCopiedExtratoId] = useState(false)
  const [copiedTransacaoIds, setCopiedTransacaoIds] = useState<Set<string>>(
    new Set()
  )
  const { data: extrato, isLoading } = useQuery({
    queryKey: ['extrato-detalhe', extratoId],
    queryFn: async () => {
      if (!extratoId) return null

      const { data: extratoData, error: extratoError } = await supabase
        .from('extratos_bancarios')
        .select('*')
        .eq('id', extratoId)
        .single()

      if (extratoError) throw extratoError

      // Buscar transações vinculadas (1:1)
      const transacoes: Array<{
        id: string;
        descricao: string;
        valor: number;
        status?: string;
        tipo?: string;
        data_pagamento?: string;
        data_vencimento?: string;
        tipo_vinculo: string;
      }> = []
      if (extratoData.transacao_vinculada_id) {
        const { data: transacao } = await supabase
          .from('transacoes_financeiras')
          .select('*')
          .eq('id', extratoData.transacao_vinculada_id)
          .single()

        if (transacao) {
          transacoes.push({
            ...transacao,
            tipo_vinculo: '1:1',
          })
        }
      }

      // Buscar transações vinculadas em lotes (N:1)
      const { data: lotes } = await supabase
        .from('conciliacoes_lote_extratos')
        .select(
          `
          conciliacao_lote_id,
          conciliacoes_lote(
            transacao_id
          )
        `
        )
        .eq('extrato_id', extratoId)

      if (lotes && lotes.length > 0) {
        for (const lote of lotes) {
          if (lote.conciliacoes_lote?.transacao_id) {
            const { data: transacao } = await supabase
              .from('transacoes_financeiras')
              .select(
                'id, descricao, valor, status, tipo, data_pagamento, data_vencimento'
              )
              .eq('id', lote.conciliacoes_lote.transacao_id)
              .single()

            if (transacao) {
              transacoes.push({
                ...transacao,
                tipo_vinculo: 'N:1',
              })
            }
          }
        }
      }

      return {
        ...extratoData,
        transacoes_vinculadas: transacoes,
      }
    },
    enabled: open && !!extratoId,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do Extrato</SheetTitle>
        </SheetHeader>

        {/* Se houver entrada vinculada, exibir bloco especial */}
        {entradaVinculada && (
          <div className="mb-6 p-3 border-l-4 border-green-500 bg-green-50 dark:bg-green-950 rounded">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-green-700 dark:text-green-300">Movimentação de Entrada Vinculada</span>
              <span className="text-xs text-muted-foreground">(transferência entre contas)</span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span><b>Descrição:</b> {entradaVinculada.descricao}</span>
              <span><b>Valor:</b> {formatValue(entradaVinculada.valor)}</span>
              <span><b>Data:</b> {format(parseLocalDate(entradaVinculada.data_pagamento) || new Date(), 'dd/MM/yyyy', { locale: ptBR })}</span>
              <span><b>ID:</b> <span className="font-mono text-xs">{entradaVinculada.id}</span></span>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ) : !extrato ? (
          <div className="mt-6 text-sm text-muted-foreground">
            Extrato não encontrado
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Informações Básicas */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Informações Básicas</h3>

              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm text-muted-foreground">Descrição</span>
                  <span className="text-sm font-medium text-right max-w-[250px] break-words">
                    {extrato.descricao}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className="text-sm font-bold text-green-600">
                    {formatValue(extrato.valor)}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm text-muted-foreground">Data</span>
                  <span className="text-sm font-medium">
                    {format(
                      parseLocalDate(extrato.data_transacao) || new Date(),
                      'dd/MM/yyyy',
                      { locale: ptBR }
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant={extrato.reconciliado ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {extrato.reconciliado ? 'Conciliado' : 'Pendente'}
                  </Badge>
                </div>

                {extrato.tipo && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-sm text-muted-foreground">Tipo</span>
                    <Badge variant="outline" className="text-xs">
                      {extrato.tipo === 'credito' ? 'Crédito' : 'Débito'}
                    </Badge>
                  </div>
                )}

                {extrato.id && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm text-muted-foreground">ID</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(String(extrato.id))
                        setCopiedExtratoId(true)
                        setTimeout(() => setCopiedExtratoId(false), 2000)
                        toast.success('ID copiado!')
                      }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="font-mono">
                        {String(extrato.id).substring(0, 8)}...
                      </span>
                      {copiedExtratoId ? (
                        <Check className="w-3 h-3 text-green-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}


              </div>
            </div>

            {/* Transações Vinculadas */}
            {extrato.transacoes_vinculadas &&
              extrato.transacoes_vinculadas.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">
                    Transações Vinculadas (
                    {extrato.transacoes_vinculadas.length})
                  </h3>

                  <div className="space-y-2">
                    {extrato.transacoes_vinculadas.map(
                      (transacao, idx) => (
                        <div
                          key={`${transacao.id}-${idx}`}
                          className="p-3 border rounded-lg bg-muted/30"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium truncate">
                                {transacao.descricao}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {transacao.tipo === 'entrada'
                                  ? 'Entrada'
                                  : 'Saída'}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-xs whitespace-nowrap"
                            >
                              {transacao.tipo_vinculo}
                            </Badge>
                          </div>

                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-muted-foreground">
                                ID
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    String(transacao.id)
                                  )
                                  const newCopied = new Set(copiedTransacaoIds)
                                  newCopied.add(transacao.id)
                                  setCopiedTransacaoIds(newCopied)
                                  setTimeout(() => {
                                    const updated = new Set(copiedTransacaoIds)
                                    updated.delete(transacao.id)
                                    setCopiedTransacaoIds(updated)
                                  }, 2000)
                                  toast.success('ID copiado!')
                                }}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <span className="font-mono truncate text-right max-w-[100px]">
                                  {String(transacao.id).substring(0, 8)}...
                                </span>
                                {copiedTransacaoIds.has(transacao.id) ? (
                                  <Check className="w-2.5 h-2.5 text-green-600 flex-shrink-0" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 flex-shrink-0" />
                                )}
                              </button>
                            </div>

                            <div className="flex justify-between items-center gap-2">
                              <span className="text-muted-foreground">
                                Valor
                              </span>
                              <span className="font-semibold">
                                {formatValue(transacao.valor)}
                              </span>
                            </div>

                            <div className="flex justify-between items-center gap-2">
                              <span className="text-muted-foreground">
                                Status
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-xs"
                              >
                                {transacao.status === 'pendente'
                                  ? 'Pendente'
                                  : 'Pago'}
                              </Badge>
                            </div>

                            {transacao.data_pagamento && (
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-muted-foreground">
                                  Pagamento
                                </span>
                                <span>
                                  {format(
                                    parseLocalDate(
                                      transacao.data_pagamento
                                    ) || new Date(),
                                    'dd/MM/yyyy',
                                    { locale: ptBR }
                                  )}
                                </span>
                              </div>
                            )}

                            {transacao.data_vencimento && (
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-muted-foreground">
                                  Vencimento
                                </span>
                                <span>
                                  {format(
                                    parseLocalDate(
                                      transacao.data_vencimento
                                    ) || new Date(),
                                    'dd/MM/yyyy',
                                    { locale: ptBR }
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Metadados */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold text-sm">Metadados</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-[10px] truncate">
                    {extrato.id}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">Criado em</span>
                  <span>
                    {format(
                      new Date(extrato.created_at),
                      'dd/MM/yyyy HH:mm',
                      { locale: ptBR }
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
