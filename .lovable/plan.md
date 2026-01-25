
# Plano: Correção de Bugs na Navegação e Edição de Eventos

## Diagnóstico dos Problemas

Após análise detalhada, identifiquei **3 problemas principais**:

| Problema | Causa | Local |
|----------|-------|-------|
| Não permite editar evento | `EventoDialog` recebe `evento={null}` fixo | `Geral.tsx:540` |
| Botão "Novo" não funciona corretamente | Funciona, mas está na página errada (dashboard) | Navegação |
| Duplo clique no calendário não faz nada | A página Geral não tem calendário interativo | Ausência de feature |

---

## Estrutura Atual de Rotas

```
/eventos        → EventosGeral (Dashboard - Centro de Operações)
/eventos/geral  → EventosGeral (Dashboard - Centro de Operações)
/eventos/gestao → EventosLista (Gestão completa com lista/calendário)
/eventos/lista  → AgendaPublica (Visualização pública da agenda)
```

**O problema é conceitual**: O Centro de Operações (`/eventos`) é um dashboard de visão geral e não foi projetado para gestão completa. A gestão com calendário interativo está em `/eventos/gestao`.

---

## Solução Proposta

### Opção A: Unificar na mesma página (recomendado)
Adicionar capacidade de edição e calendário interativo na página principal.

### Alterações no arquivo `src/pages/eventos/Geral.tsx`:

#### 1. Adicionar estado para edição de evento
```typescript
const [editingEvento, setEditingEvento] = useState<Evento | null>(null);
const [initialDate, setInitialDate] = useState<Date | undefined>(undefined);
```

#### 2. Adicionar função de edição
```typescript
const handleEditarEvento = (evento: Evento) => {
  setEditingEvento(evento);
  setEventoDialogOpen(true);
};

const handleDayClick = (date: Date) => {
  setInitialDate(date);
  setEditingEvento(null);
  setEventoDialogOpen(true);
};
```

#### 3. Adicionar um calendário compacto (opcional)
Adicionar o componente `CalendarioMensal` na coluna direita para permitir criação rápida via clique/duplo-clique.

#### 4. Corrigir o EventoDialog
```typescript
<EventoDialog
  open={eventoDialogOpen}
  onOpenChange={(open) => {
    setEventoDialogOpen(open);
    if (!open) {
      setEditingEvento(null);
      setInitialDate(undefined);
    }
  }}
  evento={editingEvento}
  initialDate={initialDate}
  onSuccess={() => {
    loadDashboardData();
    setEventoDialogOpen(false);
    setEditingEvento(null);
    setInitialDate(undefined);
  }}
/>
```

#### 5. Permitir edição do próximo evento
Adicionar botão de edição no card do próximo evento:
```typescript
<Button
  variant="ghost"
  size="icon"
  onClick={(e) => {
    e.stopPropagation();
    handleEditarEvento(nextEvent);
  }}
>
  <Edit className="h-4 w-4" />
</Button>
```

---

## Alternativa B: Redirecionar para Gestão

Se preferir manter as páginas separadas, podemos:

1. Mudar o botão "Novo Evento" para navegar para `/eventos/gestao`
2. Adicionar link claro "Gerenciar Eventos" que leva à página de gestão

---

## Interface para Buscar Evento para Edição

Como a página Geral carrega apenas o próximo evento, precisamos:
1. Carregar dados completos do evento ao clicar
2. Ou buscar do banco quando o usuário clicar em editar

```typescript
const handleEditarEvento = async (eventoId: string) => {
  const { data } = await supabase
    .from("eventos")
    .select("*")
    .eq("id", eventoId)
    .single();
  
  if (data) {
    setEditingEvento(data);
    setEventoDialogOpen(true);
  }
};
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/eventos/Geral.tsx` | Adicionar estados `editingEvento` e `initialDate` |
| `src/pages/eventos/Geral.tsx` | Adicionar funções `handleEditarEvento` e `handleDayClick` |
| `src/pages/eventos/Geral.tsx` | Corrigir props do `EventoDialog` |
| `src/pages/eventos/Geral.tsx` | Carregar evento completo para edição |
| `src/pages/eventos/Geral.tsx` | Adicionar botão de edição no card do próximo evento |
| `src/pages/eventos/Geral.tsx` | (Opcional) Adicionar calendário compacto na coluna lateral |

---

## Resultado Esperado

| Ação | Comportamento Atual | Comportamento Após Correção |
|------|---------------------|----------------------------|
| Clicar "Novo Evento" | Abre dialog de criação | Abre dialog de criação ✓ |
| Editar próximo evento | Não é possível | Botão de edição abre dialog preenchido |
| Duplo clique no calendário | Não existe calendário | Calendário na lateral permite criar evento na data |
| Clicar no card do evento | Navega para detalhes | Navega para detalhes + botão editar disponível |
