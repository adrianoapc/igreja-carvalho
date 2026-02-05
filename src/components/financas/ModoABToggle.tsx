import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface ModoABToggleProps {
  modo: 'A' | 'B'
  setModo: (modo: 'A' | 'B') => void
}

export function ModoABToggle({ modo, setModo }: ModoABToggleProps) {
  return (
    <div className="flex gap-2 items-center mb-2">
      <span className="text-xs font-medium">Modo A/B:</span>
      <Button
        size="sm"
        variant={modo === 'A' ? 'default' : 'outline'}
        onClick={() => setModo('A')}
      >
        A (Badge no extrato)
      </Button>
      <Button
        size="sm"
        variant={modo === 'B' ? 'default' : 'outline'}
        onClick={() => setModo('B')}
      >
        B (Sugestão pré-selecionada)
      </Button>
    </div>
  )
}
