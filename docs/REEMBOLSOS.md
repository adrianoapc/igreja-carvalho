# Sistema de Gestão de Reembolsos

## Visão Geral

O módulo de Reembolsos permite que líderes e membros lancem despesas feitas em nome da igreja em lote, agrupando-as em uma única solicitação para aprovação e pagamento pelo tesoureiro.

## Fluxo de Trabalho

```
┌─────────────┐
│  RASCUNHO   │ ← Líder está editando
└──────┬──────┘
       │ Submete
       ▼
┌─────────────┐
│  PENDENTE   │ ← Aguardando análise
└──────┬──────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
┌──────┐  ┌──────────┐
│APROV.│  │REJEITADO │
└──┬───┘  └──────────┘
   │ Tesoureiro paga
   ▼
┌──────┐
│ PAGO │ ← Finalizado
└──────┘
```

## Estrutura do Banco de Dados

### Tabela: `solicitacoes_reembolso`

Armazena o cabeçalho de cada pedido de reembolso.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único da solicitação |
| `solicitante_id` | UUID | Referência ao perfil do solicitante |
| `status` | TEXT | `rascunho`, `pendente`, `aprovado`, `pago`, `rejeitado` |
| `data_solicitacao` | DATE | Data em que foi submetida |
| `data_vencimento` | DATE | Data limite para pagamento |
| `data_pagamento` | TIMESTAMPTZ | Quando foi efetivamente pago |
| `forma_pagamento_preferida` | TEXT | `pix`, `dinheiro`, `transferencia` |
| `dados_bancarios` | TEXT | Chave PIX, conta, etc. |
| `observacoes` | TEXT | Comentários adicionais |
| `valor_total` | NUMERIC(10,2) | **Calculado automaticamente** via trigger |
| `comprovante_pagamento_url` | TEXT | Comprovante do repasse |

### Alteração em `transacoes_financeiras`

Foi adicionado o campo `solicitacao_reembolso_id` (UUID, nullable) que vincula transações individuais à solicitação de reembolso correspondente.

### View: `view_solicitacoes_reembolso`

Exibe solicitações com informações do solicitante (nome, email, avatar) via JOIN com `profiles`.

## Triggers e Funções

### `atualizar_valor_total_reembolso()`

Executa **AFTER INSERT, UPDATE, DELETE** em `transacoes_financeiras`:
- Recalcula `valor_total` da solicitação somando todos os valores das transações vinculadas
- Garante que o total sempre está sincronizado

### `validar_status_reembolso()`

Executa **BEFORE UPDATE** em `solicitacoes_reembolso`:
- Impede que usuários comuns alterem status para `aprovado`, `pago` ou `rejeitado`
- Valida transições de status baseado na role do usuário (admin/tesoureiro)

## RLS (Row Level Security)

### SELECT
- Usuários veem suas próprias solicitações
- Admin/tesoureiro/financeiro veem todas

### INSERT
- Usuários podem criar solicitações para si mesmos

### UPDATE
- Usuários podem editar suas próprias solicitações em `rascunho` ou `pendente`
- Admin/tesoureiro podem editar qualquer solicitação

### DELETE
- Usuários podem deletar apenas solicitações em `rascunho`
- Admin pode deletar qualquer

## Frontend

### Página: `src/pages/financas/Reembolsos.tsx`

#### Tabs
1. **Meus Pedidos**: Visualização do usuário comum
   - Lista todas as suas solicitações (qualquer status)
   - Botão "Nova Solicitação" abre wizard

2. **Gestão/Aprovação**: Visualização admin/tesoureiro
   - Lista solicitações `pendente` e `aprovado` de todos os usuários
   - Botão "Processar Pagamento" para efetuar repasse

#### Wizard de Criação (3 etapas)

**Etapa 1 - Informações Gerais:**
- Data de vencimento
- Forma de pagamento preferida
- Dados bancários (chave PIX, conta)
- Observações

**Etapa 2 - Itens do Reembolso:**
- Lista dinâmica de itens
- Para cada item:
  - Descrição
  - Valor
  - Categoria
  - URL do comprovante (foto da nota)
- Adicionar/remover itens
- Total calculado automaticamente

**Etapa 3 - Confirmação:**
- Resumo de todos os dados
- Valor total destacado
- Botão "Submeter Solicitação"

#### Modal de Pagamento (Tesoureiro)

- Selecionar conta de saída
- Data do pagamento
- Exibe dados bancários do solicitante
- Ao confirmar:
  - Atualiza solicitação para `pago`
  - Atualiza **todas** as transações vinculadas com:
    - `status = 'pago'`
    - `conta_id = conta_saida`
    - `data_pagamento = data_selecionada`
  - Triggers de saldo das contas são acionados automaticamente

## Status e Badges

- **Rascunho**: Badge cinza com ícone Clock
- **Pendente**: Badge amarelo com ícone Clock
- **Aprovado**: Badge verde com ícone CheckCircle
- **Pago**: Badge azul com ícone CheckCircle
- **Rejeitado**: Badge vermelho com ícone XCircle

## Permissões

As seguintes roles podem aprovar e processar pagamentos:
- `admin`
- `tesoureiro`

## Navegação

**Menu Principal → Finanças → Reembolsos**

Ícone: Receipt (lucide-react)

## Próximos Passos

### 1. Aplicar Migração ao Banco de Dados

A migração já foi criada em:
```
supabase/migrations/20251209_reembolsos.sql
```

**Opções para aplicar:**

**a) Via Supabase Dashboard:**
1. Acesse seu projeto no https://app.supabase.com
2. Vá em `SQL Editor`
3. Cole o conteúdo do arquivo `20251209_reembolsos.sql`
4. Execute o SQL

**b) Via CLI (se instalado):**
```bash
supabase db push
```

### 2. Regenerar Tipos TypeScript

Após aplicar a migração, execute:

```bash
npx supabase gen types typescript --project-id SEU_PROJECT_ID > src/integrations/supabase/types.ts
```

Ou use o Supabase CLI para gerar os tipos atualizados.

### 3. Remover Type Assertions Temporárias

No arquivo `src/pages/financas/Reembolsos.tsx`, procure por:
- `as any`
- `as unknown`

E remova-os após regenerar os tipos. O TypeScript deverá reconhecer automaticamente:
- `solicitacoes_reembolso`
- `view_solicitacoes_reembolso`
- `categorias_financeiras` (ou verificar nome correto)
- `contas_bancarias` (ou criar se não existir)

### 4. Criar Tabela `contas_bancarias` (se não existir)

Verificar se a tabela existe no banco. Se não, criar com estrutura similar a:

```sql
CREATE TABLE contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'conta_corrente', 'poupanca', 'caixa'
  saldo NUMERIC(10,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. Adicionar Campo `quantidade_itens` à View (Opcional)

Para exibir a contagem de itens, alterar a view:

```sql
CREATE OR REPLACE VIEW view_solicitacoes_reembolso AS
SELECT 
  sr.*,
  p.nome AS solicitante_nome,
  p.email AS solicitante_email,
  p.avatar_url AS solicitante_avatar,
  COUNT(tf.id) AS quantidade_itens
FROM solicitacoes_reembolso sr
LEFT JOIN profiles p ON sr.solicitante_id = p.id
LEFT JOIN transacoes_financeiras tf ON tf.solicitacao_reembolso_id = sr.id
GROUP BY sr.id, p.nome, p.email, p.avatar_url;
```

### 6. Testar Fluxo Completo

1. **Como Líder:**
   - Criar nova solicitação
   - Adicionar múltiplos itens
   - Submeter
   - Verificar status pendente

2. **Como Tesoureiro:**
   - Ver solicitação na aba "Gestão"
   - Clicar em "Processar Pagamento"
   - Selecionar conta de saída
   - Confirmar pagamento
   - Verificar que todas as transações foram atualizadas

3. **Verificar Integridade:**
   - `valor_total` deve ser a soma exata dos itens
   - Saldo da conta deve ter sido debitado corretamente
   - Status deve ser `pago` tanto na solicitação quanto nas transações

## Observações Técnicas

- **Type Safety**: Temporariamente usando `as any` até os tipos serem regenerados
- **Validação**: Backend (RLS + Triggers) + Frontend (React Hook Form)
- **Performance**: Índices criados em `solicitante_id`, `status`, `data_solicitacao`
- **Auditoria**: Campos `created_at` e `updated_at` em todas as tabelas
- **Cascata**: DELETE em `solicitacoes_reembolso` propaga com SET NULL para transações

## Arquitetura de Dados

```
┌────────────────────────┐
│ solicitacoes_reembolso │
│  - id (PK)             │
│  - solicitante_id (FK) │
│  - status              │
│  - valor_total ◄───────┼─── TRIGGER atualiza automaticamente
└───────┬────────────────┘
        │
        │ 1:N
        ▼
┌────────────────────────┐
│ transacoes_financeiras │
│  - id (PK)             │
│  - solicitacao_...     │◄─── FK para solicitacoes_reembolso
│  - tipo = 'despesa'    │
│  - valor (negativo)    │
│  - categoria_id        │
│  - conta_id            │
└────────────────────────┘
```

## Integração com Módulo Financeiro

- Cada item do reembolso vira uma **transação financeira individual**
- Permite rastreamento detalhado por categoria
- Compatível com relatórios financeiros existentes
- Trigger de saldo de contas funciona normalmente

## Segurança

- RLS ativo em todas as tabelas
- Validação de roles no backend
- Transições de status controladas por trigger
- Usuários não podem aprovar seus próprios reembolsos

---

**Implementado em**: 09/12/2024
**Branch**: `feature/financeiro-improvements`
**Próximo passo**: Aplicar migração e testar
