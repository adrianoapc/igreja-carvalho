import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseLocalDate } from '@/utils/dateUtils'

interface ExtratoSugestaoMLAProps {
  extratoId: string
  valor: number
  data: string
  descricao: string
  tipo: string
  sugestao?: {
    transacaoDescricao: string
    transacaoValor: number
    transacaoData: string
    score: number
    tipoMatch: string
    diferencaDias: number
    sugestaoId: string
    onAceitar: () => void
    onRejeitar: () => void
  }
}

export function ExtratoSugestaoMLA({ extratoId, valor, data, descricao, tipo, sugestao }: ExtratoSugestaoMLAProps) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-xs truncate">{descricao}</p>
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          {parseLocalDate(data) ? format(parseLocalDate(data)!, 'dd/MM', { locale: ptBR }) : '-'}
        </p>
        <p className={`font-bold text-xs ${tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
          {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>
      
      {sugestao && (
        <div className="mt-1 p-1.5 rounded bg-yellow-50 border border-yellow-200 space-y-1">
          {/* Descrição da Transação de forma compacta */}
          <div className="text-xs">
            <span className="text-muted-foreground">Encontrado: </span>
            <span className="font-medium text-gray-800">{sugestao.transacaoDescricao}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {sugestao.transacaoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em {parseLocalDate(sugestao.transacaoData) ? format(parseLocalDate(sugestao.transacaoData)!, 'dd/MM', { locale: ptBR }) : '-'}
          </div>
          
          {/* Badge de confiança inline com botões */}
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] bg-yellow-100 border-yellow-300 px-1 py-0">
              {Math.round(sugestao.score * 100)}%
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 hover:bg-green-200"
              onClick={(e) => {
                e.stopPropagation()
                sugestao.onAceitar()
              }}
              title="Aceitar sugestão"
            >
              <Check className="w-3 h-3 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 hover:bg-red-200"
              onClick={(e) => {
                e.stopPropagation()
                sugestao.onRejeitar()
              }}
              title="Rejeitar sugestão"
            >
              <X className="w-3 h-3 text-red-600" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
