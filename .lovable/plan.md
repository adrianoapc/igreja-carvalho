
# Plano: Corrigir Ações de Criação de Eventos

## Problema Identificado

### Estrutura de Rotas Atual
| Rota | Componente | Descrição |
|------|------------|-----------|
| `/eventos` | `EventosGeral` | Centro de Operações (dashboard) |
| `/eventos/geral` | `EventosGeral` | Alias do Centro de Operações |
| `/eventos/lista` | `AgendaPublica` | Visão pública simplificada |
| `/eventos/gestao` | **NÃO EXISTE** | Tela de gestão com calendário + criar/editar |

### Problemas Encontrados
1. **Botão "Agendar agora"** navega para `/eventos/lista` (Agenda Pública) - deveria abrir dialog de criação
2. **Botão "Novo Evento"** no calendário não funciona porque a tela de gestão (`EventosLista`) não tem rota
3. **Clique nos dias do calendário** não tem handler para abrir o dialog com data pré-selecionada
4. **O `EventoDialog`** não aceita uma `initialDate` para pré-preencher a data

---

## Solução

### 1. Adicionar Rota de Gestão
Criar nova rota `/eventos/gestao` que aponta para o componente `EventosLista`.

### 2. Corrigir "Agendar Agora" no Centro de Operações
Adicionar o `EventoDialog` diretamente no `Geral.tsx` para que o botão abra o dialog sem navegar.

### 3. Habilitar Clique nos Dias do Calendário
Adicionar handlers de clique no `CalendarioMensal` para criar eventos em datas específicas.

### 4. Aceitar Data Inicial no Dialog
Modificar `EventoDialog` para aceitar uma `initialDate` e pré-preencher o campo de data.

---

## Detalhes Técnicos

### Arquivo 1: `src/App.tsx`
**Adicionar nova rota** (após linha 690):
```typescript
<Route
  path="/eventos/gestao"
  element={
    <AuthGate>
      <EventosLista />
    </AuthGate>
  }
/>
```

---

### Arquivo 2: `src/pages/eventos/Geral.tsx`

**Adicionar imports** (topo do arquivo):
```typescript
import EventoDialog from "@/components/eventos/EventoDialog";
```

**Adicionar estado** (após linha 63):
```typescript
const [eventoDialogOpen, setEventoDialogOpen] = useState(false);
```

**Alterar botão "Agendar agora"** (linha 366):
```typescript
// DE:
<Button variant="link" onClick={() => navigate("/eventos/lista")}>
  Agendar agora
</Button>

// PARA:
<Button variant="link" onClick={() => setEventoDialogOpen(true)}>
  Agendar agora
</Button>
```

**Adicionar o dialog** (antes do fechamento do return):
```typescript
<EventoDialog
  open={eventoDialogOpen}
  onOpenChange={setEventoDialogOpen}
  evento={null}
  onSuccess={() => {
    loadDashboardData();
    setEventoDialogOpen(false);
  }}
/>
```

---

### Arquivo 3: `src/components/eventos/CalendarioMensal.tsx`

**Atualizar interface** (linha 36-41):
```typescript
interface CalendarioMensalProps {
  cultos: Evento[];
  escalasCount: Record<string, number>;
  onCultoClick: (culto: Evento) => void;
  onNovoEvento?: () => void;
  onDayClick?: (date: Date) => void;  // NOVO
}
```

**Adicionar onClick nos dias** (linhas 138-146):
```typescript
<div
  key={day.toISOString()}
  onClick={() => {
    // Clique simples em dia vazio abre criação
    if (dayCultos.length === 0 && onDayClick && isCurrentMonth) {
      onDayClick(day);
    }
  }}
  onDoubleClick={() => {
    // Duplo clique sempre abre criação
    if (onDayClick && isCurrentMonth) {
      onDayClick(day);
    }
  }}
  className={cn(
    "min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border rounded-lg",
    "transition-colors",
    !isCurrentMonth && "bg-muted/30",
    isToday && "border-primary bg-primary/5",
    dayCultos.length > 0 && "cursor-pointer hover:bg-accent/50",
    dayCultos.length === 0 && isCurrentMonth && "cursor-pointer hover:bg-primary/10 hover:border-primary/50"
  )}
>
```

---

### Arquivo 4: `src/pages/eventos/Eventos.tsx`

**Adicionar estado para data inicial** (após linha 138):
```typescript
const [initialDate, setInitialDate] = useState<Date | undefined>(undefined);
```

**Adicionar handler de clique no dia** (após handleNovoEvento):
```typescript
const handleDayClick = (date: Date) => {
  setInitialDate(date);
  setEditingEvento(null);
  setEventoDialogOpen(true);
};
```

**Passar prop para CalendarioMensal** (linhas 665-670):
```typescript
<CalendarioMensal
  cultos={filteredEventos as any}
  escalasCount={{}}
  onCultoClick={(e) => handleAbrirEvento(e as Evento)}
  onNovoEvento={handleNovoEvento}
  onDayClick={handleDayClick}  // NOVO
/>
```

**Passar initialDate para EventoDialog** (linhas 674-682):
```typescript
<EventoDialog
  open={eventoDialogOpen}
  onOpenChange={(open) => {
    setEventoDialogOpen(open);
    if (!open) setInitialDate(undefined);
  }}
  evento={editingEvento}
  initialDate={initialDate}  // NOVO
  onSuccess={() => {
    loadEventos();
    loadKPIs();
    setInitialDate(undefined);
  }}
/>
```

---

### Arquivo 5: `src/components/eventos/EventoDialog.tsx`

**Atualizar interface** (linhas 61-66):
```typescript
interface EventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento?: Evento | null;
  onSuccess: () => void;
  initialDate?: Date;  // NOVO
}
```

**Atualizar desestruturação do componente:**
```typescript
export default function EventoDialog({
  open,
  onOpenChange,
  evento,
  onSuccess,
  initialDate,  // NOVO
}: EventoDialogProps) {
```

**Usar initialDate nos valores default do form:**
No `useEffect` que reseta o form, usar `initialDate` como valor padrão para `data_evento` quando não há evento sendo editado.

---

## Comportamento Final Esperado

| Ação | Resultado |
|------|-----------|
| Botão "Agendar agora" | Abre dialog de criação |
| Botão "Novo Evento" no calendário | Abre dialog de criação |
| Clique em dia vazio | Abre dialog com data pré-selecionada |
| Duplo clique em qualquer dia | Abre dialog com data pré-selecionada |
| Clique em evento existente | Abre detalhes do evento |

---

## Resumo das Alterações

| Arquivo | Alteração Principal |
|---------|---------------------|
| `src/App.tsx` | Adicionar rota `/eventos/gestao` |
| `src/pages/eventos/Geral.tsx` | Adicionar `EventoDialog` + corrigir botão |
| `src/components/eventos/CalendarioMensal.tsx` | Adicionar `onDayClick` + handlers de clique |
| `src/pages/eventos/Eventos.tsx` | Adicionar `initialDate` + `handleDayClick` |
| `src/components/eventos/EventoDialog.tsx` | Aceitar `initialDate` prop |
