
# Plano: Adicionar Campo de Status no EventoDialog

## Problema Identificado

O `EventoDialog` possui o campo `status` no schema de validação, mas **não há nenhum componente de interface** para permitir que o usuário altere o status do evento. Isso impede:

1. Mudar o status de "Planejado" para "Confirmado"
2. Marcar eventos como "Realizado" ou "Cancelado"
3. Eventos com inscrições abertas serem encontrados pelo chatbot (que filtra por `status = 'confirmado'`)

---

## Solução Proposta

Adicionar um **Select** para o campo `status` no formulário do `EventoDialog`, posicionado estrategicamente para fácil acesso.

---

## Alterações Necessárias

### Arquivo: `src/components/eventos/EventoDialog.tsx`

**1. Adicionar constante com opções de status (após TIPOS_EVENTO ~linha 160):**

```typescript
const STATUS_OPTIONS = [
  { value: "planejado", label: "📝 Planejado", color: "text-muted-foreground" },
  { value: "confirmado", label: "✅ Confirmado", color: "text-green-600" },
  { value: "realizado", label: "🏁 Realizado", color: "text-blue-600" },
  { value: "cancelado", label: "❌ Cancelado", color: "text-red-600" },
];
```

**2. Adicionar FormField para Status (após o campo Título/Categoria ~linha 530):**

```typescript
<FormField
  control={form.control}
  name="status"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Status</FormLabel>
      <Select value={field.value} onValueChange={field.onChange}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {STATUS_OPTIONS.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              <span className={status.color}>{status.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## Layout Sugerido

O campo de Status será adicionado na mesma linha do Título e Subtipo, reorganizando o grid:

| Título (2 colunas) | Subtipo (1 coluna) | Status (1 coluna) |
|--------------------|--------------------|--------------------|

Ou alternativamente, em uma nova linha dedicada para maior visibilidade.

---

## Fluxo do Usuário Após Implementação

1. Usuário cria evento → Status padrão: "Planejado"
2. Usuário edita evento → Pode alterar para "Confirmado"
3. Chatbot encontra evento → Filtra por `status = 'confirmado'`
4. Inscrições funcionam corretamente

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/eventos/EventoDialog.tsx` | Adicionar constante `STATUS_OPTIONS` |
| `src/components/eventos/EventoDialog.tsx` | Adicionar `FormField` com `Select` para status |

---

## Benefício Imediato

Após a implementação, você poderá:
1. Abrir o evento "Compartilhe"
2. Alterar o status de "Planejado" para "Confirmado"
3. Testar o chatbot-triagem e ver o evento aparecer corretamente
