# 🔍 Aferição: Tela Relatorio-Ofertas

## Status Atual: ⚠️ ENGESSADA E POUCO FUNCIONAL

---

## 📊 Problemas Identificados

### 1. **Formas de Pagamento - HARDCODED**

```typescript
// PROBLEMA: Busca do banco
const { data: formasPagamento } = useQuery({
  queryKey: ["formas-pagamento-oferta", igrejaId, filialId, isAllFiliais],
  queryFn: async () => {
    // ✅ CORRETO: Busca dinâmica das formas_pagamento
    let query = supabase
      .from("formas_pagamento")
      .select("id, nome")
      .eq("ativo", true)
      .eq("igreja_id", igrejaId)
      .order("nome");
    // ...
  },
});
```

**Status**: ✅ Formas vêm do banco corretamente

**Problema Real**:

- Render renderiza `grid-cols-1 md:grid-cols-2` (2 colunas fixas)
- Se tiver 10+ formas pagamento fica desorganizado
- Não há validação se forma está habilitada para ofertas

---

### 2. **Mapeamento Forma → Conta - ENGESSADO**

```typescript
// PROBLEMA: Lógica hardcoded por NOME
const nomeLower = forma.nome.toLowerCase();
const isDinheiro = nomeLower.includes("dinheiro");
const isPix = nomeLower.includes("pix");
const isCartaoCredito =
  nomeLower.includes("crédito") || nomeLower.includes("credito");

// Depois mapeia para conta assim:
let contaId = contaSantander.id; // Default Santander
if (isDinheiro) {
  contaId = contaOfertas.id; // Se nome tiver "dinheiro"
}
```

**Problemas**:

1. ❌ Busca contas por nome: `includes("oferta")` e `includes("santander")`
2. ❌ Se conta se chamar "Caixa de Ofertas" = não encontra "oferta"
3. ❌ Não existe config tabela `forma_pagamento → conta`
4. ❌ Se mudar nome da conta = quebra tudo
5. ❌ Cartão crédito sempre vai pra Santander (hardcoded)

---

### 3. **Fluxo: Salva → Gera Lançamento? ❌**

```
FLUXO ATUAL:
┌─────────────────────────┐
│ 1. Preenche form        │
│    + data, valores      │
│    + seleciona conferente│
└──────────────┬──────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 2. handleSubmit → Salva NOTIFICAÇÃO         │
│    - Cria registro em "notifications"      │
│    - metadata tem valores + totais         │
│    ❌ NÃO CRIA LANÇAMENTOS AINDA            │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 3. Conferente vê notificação pendente       │
│    - Clica em "Confirmar"                  │
│    - handleConfirmarOferta executa:        │
│      • Busca contas                        │
│      • Busca categoria "Oferta"            │
│      • Loop valores → cria transações      │
│      • Insert em transacoes_financeiras    │
│    - Marca notification como read: true    │
│    ✅ AGORA cria lançamentos                │
└──────────────┬──────────────────────────────┘
               │
               ▼
        LANÇAMENTOS CRIADOS
```

**Status**: ✅ Fluxo separado (notificação → confirmação) é correto conceitual

**Mas há problemas**:

1. ⚠️ Se conferente rejeitar: apenas marca notif como read, dados se perdem
2. ⚠️ Sem auditoria: quem rejeitou? Por quê?
3. ❌ Taxa de cartão vem do form (3.5% crédito, 2% débito) - não é dinâmica
4. ❌ Sem validação se valores são razoáveis (ex: R$ 99999999)

---

### 4. **Dados do Conferente - POUCO CLARO**

```typescript
// Busca assim:
const { data: pessoas } = useQuery({
  queryFn: async () => {
    // Busca users com role admin/tesoureiro
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "tesoureiro"]) // ← Hardcoded roles
      .eq("igreja_id", igrejaId);

    // Depois busca profiles desses users
    let query = supabase
      .from("profiles")
      .select("id, nome, user_id")
      .in("user_id", userIds)
      .neq("id", profile?.id) // Excluir quem está lançando
      .eq("igreja_id", igrejaId)
      .order("nome");
  },
});
```

**Problemas**:

1. ⚠️ Só oferece "admin" e "tesoureiro" como conferente
2. ❌ Roles hardcoded (deveria vir de config?)
3. ❌ Se user não tem profile preenchido = não aparece
4. ✅ Exclui quem está lançando (correto)

---

## 🎯 Problemas de Usabilidade

| Problema                         | Impacto                       | Dificuldade Corrigir |
| -------------------------------- | ----------------------------- | -------------------- |
| Contas mapeadas por nome         | Quebra se renomear conta      | ALTO                 |
| Taxas hardcoded no form          | Não reflete sistema           | MÉDIO                |
| Sem validação de valores         | Pode lançar valores absurdos  | BAIXO                |
| Sem histórico de rejeições       | Perda de dados                | MÉDIO                |
| Grid 2 colunas fixo              | Desorganiza com muitas formas | BAIXO                |
| Divisão forma→conta não dinâmica | Não permite config por filial | ALTO                 |

---

## 💡 Propostas de Melhoria

### Prioridade 1: Dinâmica Conta ← Forma Pagamento

**Solução**: Criar tabela `forma_pagamento_contas`

```sql
CREATE TABLE forma_pagamento_contas (
  id UUID PRIMARY KEY,
  forma_pagamento_id UUID REFERENCES formas_pagamento(id),
  conta_id UUID REFERENCES contas(id),
  igreja_id UUID REFERENCES igrejas(id),
  filial_id UUID REFERENCES filiais(id) nullable,
  created_at TIMESTAMP
);
```

**Benefício**:

- ✅ Dinâmico por filial
- ✅ Admin pode reconfigurar em Configurações
- ✅ Múltiplas contas por forma (ex: PIX pode ir pra 2 contas)

---

### Prioridade 2: Taxas Dinâmicas por Forma

**Solução**: Campo em `formas_pagamento`

```sql
ALTER TABLE formas_pagamento ADD COLUMN
  taxa_administrativa DECIMAL(5,2) DEFAULT 0;
```

**Benefício**:

- ✅ Cada forma tem sua taxa
- ✅ Atualiza sem refazer código
- ✅ Suporta PIX sem taxa, Crédito 3.5%, etc

---

### Prioridade 3: Validação de Valores

- Min: R$ 0,01
- Max: Configurável por filial (ex: máx R$ 50k por culto)
- Avisar se total > 2x da média mensal

---

### Prioridade 4: Auditoria de Rejeição

```sql
ALTER TABLE notifications ADD COLUMN
  rejected_at TIMESTAMP,
  rejected_by UUID REFERENCES profiles(id),
  rejection_reason TEXT;
```

---

### Prioridade 5: UI/UX

- [ ] Grid dinâmico (não fixo 2 cols)
- [ ] Exibir mapeamento forma→conta
- [ ] Preview de lançamentos antes confirmar
- [ ] Histórico de conferências

---

## 📋 Checklist para Desengessamento

- [ ] Criar tabela `forma_pagamento_contas`
- [ ] Atualizar `RelatorioOferta.tsx` para usar tabela
- [ ] Adicionar `taxa_administrativa` em `formas_pagamento`
- [ ] Remover hardcoding de "Santander" e "Oferta"
- [ ] Adicionar validação de valores
- [ ] Adicionar razão de rejeição
- [ ] Melhorar grid de formas
- [ ] Criar preview modal antes confirmar
