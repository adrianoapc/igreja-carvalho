import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ExtratoSugestaoMLBProps {
  extratoId: string
  valor: number
  data: string
  descricao: string
  sugestao?: {
    transacaoDescricao: string
    transacaoValor: number
    transacaoData: string
    score: number
    tipoMatch: string
    diferencaDias: number
    onAceitar: () => void
    onRejeitar: () => void
  }
  onSelecionarManual: () => void
}

export function ExtratoSugestaoMLB({ extratoId, valor, data, descricao, sugestao, onSelecionarManual }: ExtratoSugestaoMLBProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-medium">{descricao}</span>
        <span className="font-mono text-green-700">{valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
      </div>
      <div className="text-xs text-muted-foreground">{format(new Date(data), 'dd/MMM', { locale: ptBR })}</div>
      {sugestao ? (
        <div className="mt-1 p-2 rounded bg-blue-50 border border-blue-200 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold">Sugestão ML pré-selecionada:</span>
            <Badge variant="outline" className="text-xs">
              {sugestao.tipoMatch} • {Math.round(sugestao.score * 100)}%
            </Badge>
          </div>
          <div className="text-xs">
            <span className="font-medium">{sugestao.transacaoDescricao}</span> — {sugestao.transacaoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em {format(new Date(sugestao.transacaoData), 'dd/MMM', { locale: ptBR })}
          </div>
          <div className="text-xs text-muted-foreground">
            Diferença: {sugestao.diferencaDias} dia(s)
          </div>
          <div className="flex gap-2 mt-1">
            <Button size="sm" variant="default" onClick={sugestao.onAceitar}>
              <Check className="w-4 h-4" /> Aceitar
            </Button>
            <Button size="sm" variant="destructive" onClick={sugestao.onRejeitar}>
              <X className="w-4 h-4" /> Rejeitar
            </Button>
            <Button size="sm" variant="outline" onClick={onSelecionarManual}>
              Selecionar manualmente
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={onSelecionarManual} className="mt-2">
          Selecionar manualmente
        </Button>
      )}
    </div>
  )
}
