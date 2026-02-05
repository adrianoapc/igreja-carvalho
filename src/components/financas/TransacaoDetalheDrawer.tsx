import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calculator, Save } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

interface TransacaoDetalheDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transacao: {
    id: string
    descricao: string
    valor: number
    valor_liquido?: number
    data_pagamento: string
    taxas_administrativas?: number
    juros?: number
    multas?: number
    desconto?: number
  }
  onUpdated?: () => void
}

export function TransacaoDetalheDrawer({
  open,
  onOpenChange,
  transacao,
  onUpdated,
}: TransacaoDetalheDrawerProps) {
  const [valorBruto, setValorBruto] = useState(transacao.valor.toFixed(2).replace('.', ','))
  const [taxas, setTaxas] = useState((transacao.taxas_administrativas || 0).toFixed(2).replace('.', ','))
  const [juros, setJuros] = useState((transacao.juros || 0).toFixed(2).replace('.', ','))
  const [multas, setMultas] = useState((transacao.multas || 0).toFixed(2).replace('.', ','))
  const [desconto, setDesconto] = useState((transacao.desconto || 0).toFixed(2).replace('.', ','))
  const [valorLiquido, setValorLiquido] = useState(
    (transacao.valor_liquido || transacao.valor).toFixed(2).replace('.', ',')
  )
  const [saving, setSaving] = useState(false)

  const parseDecimal = (value: string): number => {
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0
  }

  const formatDecimal = (value: string): string => {
    const num = parseDecimal(value)
    return num.toFixed(2).replace('.', ',')
  }

  const handleDecimalChange = (setter: (value: string) => void) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value.replace(/[^\d,]/g, '')
    setter(value)
  }

  const calcularLiquido = () => {
    const bruto = parseDecimal(valorBruto)
    const taxasNum = parseDecimal(taxas)
    const jurosNum = parseDecimal(juros)
    const multasNum = parseDecimal(multas)
    const descontoNum = parseDecimal(desconto)

    const liquido = bruto - taxasNum + jurosNum + multasNum - descontoNum
    setValorLiquido(liquido.toFixed(2).replace('.', ','))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('transacoes_financeiras')
        .update({
          valor: parseDecimal(valorBruto),
          taxas_administrativas: parseDecimal(taxas),
          juros: parseDecimal(juros),
          multas: parseDecimal(multas),
          desconto: parseDecimal(desconto),
          valor_liquido: parseDecimal(valorLiquido),
        })
        .eq('id', transacao.id)

      if (error) throw error

      toast.success('Valores atualizados com sucesso')
      onUpdated?.()
      onOpenChange(false)
    } catch (error) {
      toast.error('Erro ao atualizar: ' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Ajustar Valores da Transação</SheetTitle>
          <SheetDescription>
            Corrija taxas, juros ou descontos para bater com o extrato bancário
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Informações da Transação */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <p className="text-sm font-medium">{transacao.descricao}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(transacao.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>

          {/* Valor Bruto */}
          <div>
            <Label htmlFor="valor-bruto">Valor Bruto *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="valor-bruto"
                type="text"
                inputMode="decimal"
                value={valorBruto}
                onChange={handleDecimalChange(setValorBruto)}
                placeholder="0,00"
                className="pl-9"
              />
            </div>
          </div>

          {/* Taxas */}
          <div>
            <Label htmlFor="taxas">Taxas Administrativas</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="taxas"
                type="text"
                inputMode="decimal"
                value={taxas}
                onChange={handleDecimalChange(setTaxas)}
                placeholder="0,00"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Taxas que reduzem o valor (ex: taxa PIX, cartão)
            </p>
          </div>

          {/* Juros e Multas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="juros">Juros</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="juros"
                  type="text"
                  inputMode="decimal"
                  value={juros}
                  onChange={handleDecimalChange(setJuros)}
                  placeholder="0,00"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="multas">Multas</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="multas"
                  type="text"
                  inputMode="decimal"
                  value={multas}
                  onChange={handleDecimalChange(setMultas)}
                  placeholder="0,00"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Desconto */}
          <div>
            <Label htmlFor="desconto">Desconto</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="desconto"
                type="text"
                inputMode="decimal"
                value={desconto}
                onChange={handleDecimalChange(setDesconto)}
                placeholder="0,00"
                className="pl-9"
              />
            </div>
          </div>

          {/* Botão Calcular */}
          <Button
            variant="outline"
            className="w-full"
            onClick={calcularLiquido}
          >
            <Calculator className="w-4 h-4 mr-2" />
            Calcular Líquido
          </Button>

          {/* Valor Líquido */}
          <div>
            <Label htmlFor="valor-liquido">Valor Líquido *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="valor-liquido"
                type="text"
                inputMode="decimal"
                value={valorLiquido}
                onChange={handleDecimalChange(setValorLiquido)}
                placeholder="0,00"
                className="pl-9 font-bold"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Este é o valor que deve aparecer no extrato bancário
            </p>
          </div>

          {/* Resumo */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Valor Bruto:</span>
              <span className="font-medium">R$ {formatDecimal(valorBruto)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>(-) Taxas:</span>
              <span>R$ {formatDecimal(taxas)}</span>
            </div>
            <div className="flex justify-between text-orange-600">
              <span>(+) Juros:</span>
              <span>R$ {formatDecimal(juros)}</span>
            </div>
            <div className="flex justify-between text-orange-600">
              <span>(+) Multas:</span>
              <span>R$ {formatDecimal(multas)}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>(-) Desconto:</span>
              <span>R$ {formatDecimal(desconto)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2 border-t">
              <span>Valor Líquido:</span>
              <span>R$ {formatDecimal(valorLiquido)}</span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
