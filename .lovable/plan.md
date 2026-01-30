
# Correção: Itens de Reembolso Não Salvando no Banco

## Diagnóstico

**Problema identificado**: A data do comprovante vem no formato brasileiro `DD/MM/YYYY` (ex: `30/01/2023`), mas o PostgreSQL espera formato ISO `YYYY-MM-DD`. O INSERT falha silenciosamente com erro:

```text
date/time field value out of range: "30/01/2023"
```

**Evidência no banco**:
- Solicitação `#4BE6A6CB` foi criada com `valor_total: R$ 0,00`
- Tabela `itens_reembolso` está vazia (0 registros)
- Meta dados da sessão do bot mostram `itens_ids: []` (array vazio)

**Dados que deveriam ter sido salvos** (capturados pelo WhatsApp):
- Valor: R$ 1.399,90
- Fornecedor: HAVAN S.A.
- Descrição: CAIXA AMPLIFICADA PCX6
- Data: 30/01/2023

---

## Correção Necessária

### Edge Function `chatbot-financeiro/index.ts`

**Localização**: Linhas 1376-1379

**Código atual** (com bug):
```typescript
data_item:
  item.data_emissao || new Date().toISOString().split("T")[0],
```

**Código corrigido**:
```typescript
// Converter data de DD/MM/YYYY para YYYY-MM-DD
let dataItem = new Date().toISOString().split("T")[0];
if (item.data_emissao) {
  const partes = item.data_emissao.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (partes) {
    dataItem = `${partes[3]}-${partes[2]}-${partes[1]}`;
  } else if (item.data_emissao.match(/^\d{4}-\d{2}-\d{2}$/)) {
    dataItem = item.data_emissao; // Já está no formato ISO
  }
}
// ...
data_item: dataItem,
```

---

## Correções Adicionais

### 1. Adicionar Trigger para Recalcular `valor_total`

Criar trigger que recalcula automaticamente quando itens são inseridos/atualizados/deletados:

```sql
CREATE OR REPLACE FUNCTION atualizar_valor_total_solicitacao()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE solicitacoes_reembolso
  SET valor_total = (
    SELECT COALESCE(SUM(valor), 0) 
    FROM itens_reembolso 
    WHERE solicitacao_id = COALESCE(NEW.solicitacao_id, OLD.solicitacao_id)
  )
  WHERE id = COALESCE(NEW.solicitacao_id, OLD.solicitacao_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_atualizar_valor_total
AFTER INSERT OR UPDATE OR DELETE ON itens_reembolso
FOR EACH ROW
EXECUTE FUNCTION atualizar_valor_total_solicitacao();
```

### 2. Corrigir View para Contar de `itens_reembolso`

A view atual conta de `transacoes_financeiras`, mas deveria contar de `itens_reembolso`:

```sql
CREATE OR REPLACE VIEW view_solicitacoes_reembolso AS
SELECT 
  sr.*,
  p.nome AS solicitante_nome,
  p.email AS solicitante_email,
  p.telefone AS solicitante_telefone,
  p.avatar_url AS solicitante_avatar,
  (SELECT count(*) FROM itens_reembolso ir 
   WHERE ir.solicitacao_id = sr.id) AS quantidade_itens
FROM solicitacoes_reembolso sr
JOIN profiles p ON p.id = sr.solicitante_id
ORDER BY sr.created_at DESC;
```

### 3. Corrigir Filtro de `filial_id` no Frontend

Em `Reembolsos.tsx`, incluir solicitações sem filial definida:

```typescript
// Antes
query = query.eq("filial_id", filialId);

// Depois
query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
```

---

## Sequência de Implementação

1. **Edge Function**: Corrigir conversão de data (prioridade máxima)
2. **Migração SQL**: Criar trigger e atualizar view
3. **Frontend**: Ajustar filtro de filial
4. **Reprocessar dados**: Inserir o item manualmente para a solicitação existente

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/chatbot-financeiro/index.ts` | Converter data DD/MM/YYYY → YYYY-MM-DD |
| Migração SQL | Trigger + View |
| `src/pages/financas/Reembolsos.tsx` | Filtro de filial_id |

---

## Teste de Validação

Após correção:
1. Enviar novo comprovante pelo WhatsApp
2. Verificar se o item aparece em `itens_reembolso`
3. Verificar se `valor_total` é calculado automaticamente
4. Verificar se a solicitação aparece na tela de Reembolsos
