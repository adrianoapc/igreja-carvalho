

# Plano: Normalização de Telefones com Suporte a WhatsApp

## Resumo do Problema

O sistema armazena telefones em 3 formatos diferentes:
- `17996486580` (apenas DDD + número)
- `+5517996486580` (com + e código de país)
- `5517996486580` (código de país sem +)

Isso causa:
1. **Duplicatas não detectadas** ao comparar telefones
2. **Potencial falha no envio** para a API do WhatsApp (que exige código de país)

## Solução: Duas Funções Complementares

### Arquitetura de Normalização

```text
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO DE TELEFONES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ENTRADA (qualquer formato)                                     │
│  ├── +5517996486580                                             │
│  ├── 5517996486580                                              │
│  └── 17996486580                                                │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────┐                                        │
│  │ normalizarTelefone  │  Remove +, remove 55 se > 11 dígitos   │
│  │ (para armazenamento)│                                        │
│  └─────────────────────┘                                        │
│           │                                                     │
│           ▼                                                     │
│  BANCO DE DADOS: 17996486580 (padrão único)                     │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────┐                                        │
│  │ formatarParaWhatsApp│  Adiciona 55 se não tiver              │
│  │ (para envio)        │                                        │
│  └─────────────────────┘                                        │
│           │                                                     │
│           ▼                                                     │
│  API WHATSAPP: 5517996486580 (com código país)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Alterações Técnicas

### 1. Criar Utilitário Compartilhado

**Arquivo:** `supabase/functions/_shared/telefone-utils.ts`

```typescript
/**
 * Normaliza telefone para armazenamento (sem código de país)
 * Entrada: qualquer formato
 * Saída: apenas DDD + número (10-11 dígitos)
 */
export function normalizarTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  
  let digits = telefone.replace(/\D/g, "");
  
  // Remove código de país 55 se presente e telefone tem mais de 11 dígitos
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }
  
  // Validar: deve ter 10 ou 11 dígitos
  if (digits.length < 10 || digits.length > 11) {
    console.warn(`Telefone inválido: ${telefone} -> ${digits}`);
    return digits.length > 0 ? digits : null;
  }
  
  return digits;
}

/**
 * Formata telefone para envio via API WhatsApp (com código de país)
 * Entrada: formato normalizado do banco (DDD + número)
 * Saída: 55 + DDD + número
 */
export function formatarParaWhatsApp(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  
  const digits = telefone.replace(/\D/g, "");
  
  // Se já tem código de país, retorna como está
  if (digits.startsWith("55") && digits.length > 11) {
    return digits;
  }
  
  // Adiciona código do país
  return `55${digits}`;
}
```

### 2. Atualizar Edge Functions

| Arquivo | Alteração |
|---------|-----------|
| `chatbot-triagem/index.ts` | Importar e usar `normalizarTelefone` do utilitário compartilhado |
| `chatbot-financeiro/index.ts` | Importar e usar `normalizarTelefone` do utilitário compartilhado |
| `inscricao-compartilhe/index.ts` | Importar e usar `normalizarTelefone` do utilitário compartilhado |
| `cadastro-publico/index.ts` | Importar e usar `normalizarTelefone` |
| `disparar-alerta/index.ts` | Usar `formatarParaWhatsApp` antes de enviar para API Meta |
| `disparar-escala/index.ts` | Usar `formatarParaWhatsApp` antes de enviar |

### 3. Atualizar Frontend (validators.ts)

**Arquivo:** `src/lib/validators.ts`

Adicionar mesmas funções para uso no frontend:
- `normalizarTelefone()` - para salvar no banco
- `formatarParaWhatsApp()` - (opcional, não usado no front)

### 4. Migração SQL para Corrigir Dados Existentes

```sql
-- Normalizar telefones existentes para padrão: DDD + número (10-11 dígitos)
UPDATE profiles
SET telefone = 
  CASE 
    -- Telefone com +55: remove + e 55
    WHEN telefone LIKE '+55%' 
    THEN SUBSTRING(REGEXP_REPLACE(telefone, '\D', '', 'g') FROM 3)
    -- Telefone com 55 no início e mais de 11 dígitos: remove 55
    WHEN LENGTH(REGEXP_REPLACE(telefone, '\D', '', 'g')) > 11 
     AND REGEXP_REPLACE(telefone, '\D', '', 'g') LIKE '55%'
    THEN SUBSTRING(REGEXP_REPLACE(telefone, '\D', '', 'g') FROM 3)
    -- Caso contrário: apenas remove caracteres não numéricos
    ELSE REGEXP_REPLACE(telefone, '\D', '', 'g')
  END
WHERE telefone IS NOT NULL
  AND telefone != REGEXP_REPLACE(telefone, '\D', '', 'g');
```

### 5. Melhorar Busca de Duplicatas no cadastro-publico

Antes de inserir um novo visitante, buscar em múltiplos formatos:

```typescript
const telefoneNormalizado = normalizarTelefone(visitanteData.telefone);
if (telefoneNormalizado) {
  const { data: byTelefone } = await supabase
    .from('profiles')
    .select('*')
    .in('status', ['visitante', 'frequentador', 'membro'])
    .eq('telefone', telefoneNormalizado)  // Busca exata no formato normalizado
    .limit(1);
}
```

Após a migração, todos os telefones estarão no mesmo formato, então a busca exata funcionará.

## Benefícios

1. **Formato único no banco** - Facilita comparação e evita duplicatas
2. **Compatibilidade com WhatsApp** - Função de formatação adiciona 55 apenas quando necessário
3. **Código centralizado** - Utilitário compartilhado evita duplicação
4. **Dados legados corrigidos** - Migração SQL normaliza registros antigos

## Ordem de Implementação

1. Criar `supabase/functions/_shared/telefone-utils.ts`
2. Executar migração SQL para corrigir dados existentes
3. Atualizar `cadastro-publico` para usar normalização
4. Atualizar demais edge functions
5. Atualizar `src/lib/validators.ts` no frontend
6. Atualizar formulários de cadastro manual

