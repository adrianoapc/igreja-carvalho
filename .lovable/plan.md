
# Plano: Eliminar Redundância de Edição na Página de Detalhes

## Problema Atual

Existem **duas interfaces de edição competindo**:
- Botão "Editar Evento" (header) → Dialog completo
- Card "Informações do Evento" (aba Visão Geral) → Formulário parcial com "Salvar Alterações"

Isso é confuso e redundante.

---

## Estratégia Proposta: Unificar para Dialog Completo

### Remover o formulário duplicado e manter apenas o Dialog

A aba "Visão Geral" passa a ser **somente visualização** com um botão de edição que abre o Dialog completo.

---

## Alterações no Arquivo `src/pages/EventoDetalhes.tsx`

### 1. Remover Estados de Formulário Desnecessários
```typescript
// REMOVER estes estados:
const [tema, setTema] = useState("");
const [pregador, setPregador] = useState("");
const [local, setLocal] = useState("");
const [observacoes, setObservacoes] = useState("");
const [status, setStatus] = useState("planejado");

// REMOVER função handleSave (que salva campos parciais)
```

### 2. Remover Sincronização de Estados no loadEvento
```typescript
// REMOVER estas linhas do loadEvento:
setTema(normalized.tema || "");
setPregador(normalized.pregador || "");
setLocal(normalized.local || "");
setObservacoes(normalized.observacoes || "");
setStatus(normalized.status);
```

### 3. Transformar Card de "Informações" em Visualização
Substituir o formulário editável por uma exibição limpa dos dados com botão de edição:

```
┌─────────────────────────────────────────────────────────┐
│ Informações do Evento                    [Editar ✏️]    │
├─────────────────────────────────────────────────────────┤
│ Tema: Família de Deus                                   │
│ Pregador: Pr. Carlos Silva                              │
│ Local: Templo Sede                                      │
│ Status: 🟢 Confirmado                                   │
│                                                         │
│ Observações:                                            │
│ Culto especial com participação do coral                │
└─────────────────────────────────────────────────────────┘
```

### 4. Mover Botão "Editar" do Header para o Card
O botão de edição fica **dentro do Card** de informações, não no header global.

### 5. Limpar Header
Remover o botão "Editar Evento" redundante do header, mantendo apenas:
- QR Check-in
- Notificar Escalados  
- Modo Apresentação

---

## Interface Final da Aba "Visão Geral"

```
┌─ KPI Cards ─────────────────────────────────────────────┐
│ [⏱ Duração: 90 min] [👥 Escalados: 12] [✓ Liturgia: 8] │
└─────────────────────────────────────────────────────────┘

┌─ Informações do Evento ─────────────────────────────────┐
│                                           [✏️ Editar]   │
│                                                         │
│ 📋 Tema         Família de Deus                         │
│ 🎤 Pregador     Pr. Carlos Silva                        │
│ 📍 Local        Templo Sede                             │
│ 📊 Status       🟢 Confirmado                           │
│                                                         │
│ 📝 Observações                                          │
│ Culto especial com participação do coral infantil.      │
└─────────────────────────────────────────────────────────┘
```

---

## Resumo das Alterações

| Ação | Arquivo |
|------|---------|
| Remover estados locais do formulário | `EventoDetalhes.tsx` |
| Remover função `handleSave` | `EventoDetalhes.tsx` |
| Remover botão "Editar Evento" do header | `EventoDetalhes.tsx` |
| Substituir formulário por visualização | `EventoDetalhes.tsx` |
| Adicionar botão "Editar" no CardHeader | `EventoDetalhes.tsx` |
| Manter `EventoDialog` para edição completa | `EventoDetalhes.tsx` |

---

## Benefícios

| Antes | Depois |
|-------|--------|
| 2 formas de editar (confuso) | 1 única forma (Dialog completo) |
| Formulário parcial (incompleto) | Edição completa sempre |
| Botão no header + formulário embaixo | Botão contextual no card |
| Estados duplicados | Estados limpos |

---

## Resultado Esperado

- Clicar no botão "Editar" no card → abre `EventoDialog` com todos os dados
- Salvar no Dialog → atualiza a visualização automaticamente
- Interface limpa e sem redundância
