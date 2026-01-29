
# Plano: Correção da Forma de Pagamento e Descrição de Ofertas

## Problema Identificado

### 1. Inconsistência no Campo `forma_pagamento`

Há uma incompatibilidade entre como diferentes partes do sistema salvam e leem o campo `forma_pagamento`:

| Local | O que salva/espera |
|-------|-------------------|
| `RelatorioOferta.tsx` | Salva **ID** (UUID) ✅ |
| `TransacaoDialog.tsx` (Select) | Usa **nome** como `value` ❌ |
| `TransacaoDialog.tsx` (ao criar) | Salva **nome** (string) ❌ |

Por isso, ao editar uma transação criada pelo Relatório de Ofertas, o Select não encontra o valor (ID) na lista de opções (que usam nomes).

### 2. Descrição Genérica (conforme discutido anteriormente)
A descrição não inclui a forma de pagamento nem diferencia físico/digital.

---

## Solução Proposta

### Mudança 1: Padronizar `forma_pagamento` para usar ID

Atualizar o `TransacaoDialog.tsx` para usar **ID** em vez de **nome**:

**Linha 1182 (Antes):**
```tsx
<SelectItem key={f.id} value={f.nome}>
  {f.nome}
</SelectItem>
```

**Linha 1182 (Depois):**
```tsx
<SelectItem key={f.id} value={f.id}>
  {f.nome}
</SelectItem>
```

Isso corrige:
- A exibição ao editar (o ID salvo será encontrado)
- O salvamento no dialog (passará a salvar ID em vez de nome)

### Mudança 2: Corrigir Descrição no RelatorioOferta

Alterar o formato da descrição em 3 locais:

**Formato atual:**
```
"Oferta - Culto 05/10/2025"
"Digital - Culto 05/10/2025"
```

**Formato novo:**
```
"Físico (Dinheiro) - Oferta - Culto 05/10/2025"
"Digital (PIX) - Culto 05/10/2025"
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `TransacaoDialog.tsx` (linha 1182) | Mudar `value={f.nome}` para `value={f.id}` |
| `RelatorioOferta.tsx` (linha 907) | Atualizar descrição em `handleConfirmarOferta` |
| `RelatorioOferta.tsx` (linha 2082) | Atualizar descrição para lançamentos físicos diretos |
| `RelatorioOferta.tsx` (linha 2131) | Atualizar descrição para lançamentos digitais diretos |

---

## Detalhamento Técnico

### TransacaoDialog.tsx - Correção do Select

```tsx
// Antes (usa nome)
<SelectItem key={f.id} value={f.nome}>
  {f.nome}
</SelectItem>

// Depois (usa ID)
<SelectItem key={f.id} value={f.id}>
  {f.nome}
</SelectItem>
```

### RelatorioOferta.tsx - handleConfirmarOferta (linha 904-910)

```tsx
// Antes
descricao: `Oferta - Culto ${format(new Date(metadata.data_evento), "dd/MM/yyyy")}`

// Depois
descricao: `${forma.is_digital ? "Digital" : "Físico"} (${forma.nome}) - Oferta - Culto ${format(new Date(metadata.data_evento), "dd/MM/yyyy")}`
```

### RelatorioOferta.tsx - Lançamentos Físicos Diretos (linhas 2079-2085)

```tsx
// Antes
descricao: `${(l.tipo || "oferta").charAt(0).toUpperCase() + (l.tipo || "oferta").slice(1)} - Culto ${format(dataCulto, "dd/MM/yyyy")}`

// Depois
descricao: `Físico (${forma?.nome || "N/A"}) - ${(l.tipo || "Oferta").charAt(0).toUpperCase() + (l.tipo || "oferta").slice(1)} - Culto ${format(dataCulto, "dd/MM/yyyy")}`
```

### RelatorioOferta.tsx - Lançamentos Digitais Diretos (linhas 2128-2134)

```tsx
// Antes
descricao: `Digital - Culto ${format(dataCulto, "dd/MM/yyyy")}`

// Depois
descricao: `Digital (${forma?.nome || "N/A"}) - Culto ${format(dataCulto, "dd/MM/yyyy")}`
```

---

## Impacto

### Dados Existentes
- Transações criadas pelo TransacaoDialog (salvam nome) → Continuarão funcionando pois o Select agora busca por ID, mas transações antigas salvas com nome não terão match. 
- **Sugestão**: Após implementar, podemos rodar uma query para corrigir registros antigos que usam nome → ID.

### Resultado Final

1. Campo "Forma de pgto" aparecerá corretamente preenchido
2. Descrições serão mais claras: `"Digital (PIX) - Culto 05/10/2025"`
3. Sistema consistente usando IDs para referência de formas de pagamento
