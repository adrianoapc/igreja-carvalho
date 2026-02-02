
# Transferência entre Contas — Proposta Técnica

## Resumo Executivo

Implementar funcionalidade de transferência entre contas que:
- **Cria duas transações vinculadas** (saída da origem + entrada no destino)
- **Não impacta o DRE** (usa categoria existente "Transferência entre Contas")
- **Funciona via UI e via Chatbot** (detecta comprovante de depósito)
- **É configurável** para mapeamentos automáticos (ex: "Dinheiro Ofertas" → "Banco Santander")

---

## Modelo de Dados

### Nova Tabela: `transferencias_contas`

Centraliza a operação e vincula as duas transações geradas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `conta_origem_id` | UUID FK | Conta de onde sai o dinheiro |
| `conta_destino_id` | UUID FK | Conta para onde vai o dinheiro |
| `valor` | NUMERIC | Valor transferido |
| `data_transferencia` | DATE | Quando ocorreu |
| `data_competencia` | DATE | Para relatórios (geralmente = data_transferencia) |
| `transacao_saida_id` | UUID FK | Transação de saída gerada |
| `transacao_entrada_id` | UUID FK | Transação de entrada gerada |
| `observacoes` | TEXT | Comentário livre |
| `anexo_url` | TEXT | Comprovante |
| `igreja_id` | UUID FK | Multi-tenant |
| `filial_id` | UUID FK | Escopo filial |
| `criado_por` | UUID FK | Usuário ou bot que criou |
| `sessao_id` | UUID FK | Se veio do chatbot |
| `created_at` | TIMESTAMPTZ | Auditoria |

### Alteração: `transacoes_financeiras`

Adicionar coluna para identificar transações de transferência:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `transferencia_id` | UUID FK | Referência à transferência que gerou esta transação |

Isso permite:
- Identificar rapidamente que a transação é parte de uma transferência
- Evitar que ela apareça em relatórios de movimentação real
- Facilitar estorno (cancelar ambas as pernas)

---

## Fluxo de Funcionamento

```text
1. Usuário inicia transferência
   ↓
2. Seleciona: Conta Origem, Conta Destino, Valor, Data
   ↓
3. Sistema valida:
   - Contas diferentes
   - Saldo suficiente (opcional, configurável)
   ↓
4. Sistema cria registro em transferencias_contas
   ↓
5. Sistema cria 2 transações vinculadas:
   - SAÍDA: conta_origem, categoria="Transferência entre Contas", tipo="saida"
   - ENTRADA: conta_destino, categoria="Transferência entre Contas", tipo="entrada"
   ↓
6. Saldos das contas são atualizados (trigger ou update direto)
   ↓
7. DRE não é afetado (secao_dre = "Não faz parte do DRE")
```

---

## Integração com Chatbot Financeiro

### Novo Fluxo: `TRANSFERENCIA`

Ativado quando:
- Usuário envia palavra-chave: "transferência", "depósito", "deposito"
- Ou IA detecta comprovante de depósito bancário (não nota fiscal)

### Máquina de Estados

```text
AGUARDANDO_GATILHO
  ↓ (usuário: "transferência" ou envia comprovante de depósito)
AGUARDANDO_CONTA_ORIGEM
  ↓ (usuário escolhe ou sistema sugere via OCR)
AGUARDANDO_CONTA_DESTINO
  ↓ (usuário escolhe ou sistema sugere via mapeamento)
AGUARDANDO_CONFIRMACAO
  ↓ (usuário confirma)
FINALIZADO
```

### OCR para Comprovantes de Depósito

O sistema detectaria:
- Valor depositado
- Conta destino (via CNPJ do banco ou nome)
- Data

E sugeriria automaticamente:
- "Detectei depósito de R$ 5.000 no Santander em 02/02. Confirmar saída de qual conta?"

### Mapeamentos Automáticos (Configurável)

Nova tabela `transferencias_config` ou coluna em `financeiro_config`:

```json
{
  "mapeamentos_transferencia": [
    {
      "conta_origem_id": "uuid-conta-dinheiro-ofertas",
      "conta_destino_id": "uuid-conta-santander",
      "nome_sugestao": "Oferta → Banco"
    }
  ]
}
```

Quando o bot detecta depósito no Santander, já sugere "Dinheiro Ofertas" como origem.

---

## Interface UI

### Opção 1: Botão "Transferir" na Tela de Contas

Na listagem de contas, um botão "Transferir" que abre modal com:
- Select: Conta Origem
- Select: Conta Destino
- Input: Valor
- DatePicker: Data
- Textarea: Observações
- Upload: Comprovante (opcional)

### Opção 2: Novo Tipo de Lançamento

No `TransacaoDialog`, adicionar tipo: `"transferencia"` além de `"unico" | "recorrente" | "parcelado"`.

Quando selecionado, mostra campos específicos de transferência.

---

## Tratamento no DRE

A categoria "Transferência entre Contas" já existe com `secao_dre = "Não faz parte do DRE"`.

A função `get_dre_anual` já filtra corretamente por `secao_dre`, então as transferências não aparecerão no DRE.

Para garantia adicional, podemos:
1. Verificar se a query do DRE exclui essa seção (já faz pelo JOIN)
2. Adicionar flag `eh_transferencia` na transação (já teremos via `transferencia_id IS NOT NULL`)

---

## Relatórios

### Novo Relatório: "Movimentações Internas"

Mostra todas as transferências com:
- Data
- Conta Origem → Conta Destino
- Valor
- Quem fez
- Status (executada, pendente, estornada)

Isso separa claramente das movimentações operacionais.

---

## Estorno de Transferência

- Usuário clica em "Estornar" na transferência
- Sistema marca `status = 'estornado'`
- Sistema estorna as duas transações vinculadas
- Saldos são revertidos

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migração SQL | Criar | Tabela `transferencias_contas`, coluna `transferencia_id` |
| `chatbot-financeiro/index.ts` | Modificar | Adicionar fluxo TRANSFERENCIA |
| `src/components/financas/TransferenciaDialog.tsx` | Criar | Modal de transferência |
| `src/pages/financas/Transferencias.tsx` | Criar | Listagem de transferências |
| `src/components/financas/ContasTab.tsx` | Modificar | Botão "Transferir" |
| `financeiro_config` | Modificar | Mapeamentos de transferência |

---

## Segurança e Validações

| Validação | Descrição |
|-----------|-----------|
| Contas diferentes | Não permite transferir para mesma conta |
| Valor positivo | Valor deve ser > 0 |
| Contas ativas | Ambas devem estar ativas |
| Permissão | Apenas tesoureiros e admins |
| Multi-tenant | RLS por `igreja_id` |

---

## Resultado Esperado

- Transferências não poluem DRE
- Fácil rastrear movimentações internas
- Bot detecta depósitos e sugere transferência
- Mapeamentos configuráveis reduzem trabalho manual
- Saldos das contas sempre corretos
- Auditoria completa (quem, quando, de onde, para onde)

---

## Alternativas Consideradas

### Usar Apenas Duas Transações Manuais
- Problema: Sem vínculo, difícil rastrear como par
- Decisão: Rejeitada por falta de integridade

### Usar Campo `transferencia_relacionada_id` em Transações
- Problema: Não centraliza metadados (observações, quem fez)
- Decisão: Tabela dedicada é mais limpa

### Não Criar Transações, Apenas Atualizar Saldos
- Problema: Perde histórico e auditoria
- Decisão: Transações são necessárias para rastreabilidade

---

## Prioridade de Implementação

1. **Fase 1**: Migração SQL + UI básica (modal de transferência)
2. **Fase 2**: Integração com chatbot (detecção de depósito)
3. **Fase 3**: Mapeamentos automáticos e sugestões inteligentes
