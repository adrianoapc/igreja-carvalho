

# Plano Consolidado: Gestão Completa de Inscrições em Eventos

## Visão Geral

Este plano unifica duas funcionalidades complementares:
1. **Criação/Edição**: Permitir configurar inscrição e pagamento ao criar/editar evento
2. **Visualização**: Exibir aba de inscritos nos detalhes do evento

---

## Parte 1: EventoDialog - Campos de Inscrição e Pagamento

### Arquivo: `src/components/eventos/EventoDialog.tsx`

#### 1.1 Adicionar estados para dados financeiros
```typescript
const [categoriasFinanceiras, setCategoriasFinanceiras] = useState<{id: string; nome: string}[]>([]);
const [contasFinanceiras, setContasFinanceiras] = useState<{id: string; nome: string}[]>([]);
```

#### 1.2 Adicionar watches para controle condicional
```typescript
const tipoSelecionado = form.watch("tipo");
const requerInscricao = form.watch("requer_inscricao");
const requerPagamento = form.watch("requer_pagamento");
```

#### 1.3 Carregar categorias e contas financeiras
```typescript
const loadDadosFinanceiros = async () => {
  const [catRes, contaRes] = await Promise.all([
    supabase.from("categorias_financeiras").select("id, nome").eq("ativo", true),
    supabase.from("contas").select("id, nome").eq("ativo", true)
  ]);
  setCategoriasFinanceiras(catRes.data || []);
  setContasFinanceiras(contaRes.data || []);
};
```

#### 1.4 Nova seção de Inscrições (apenas para tipo EVENTO)

```
┌─────────────────────────────────────────────────────────┐
│ 📋 INSCRIÇÕES                                           │
├─────────────────────────────────────────────────────────┤
│ [ ] Requer Inscrição                                    │
│                                                         │
│   Limite de Vagas: [____]   Até: [__/__/__]            │
│                                                         │
│   [ ] Evento Pago                                       │
│                                                         │
│   Valor: R$ [____]                                      │
│   Categoria Financeira: [Eventos          ▼]            │
│   Conta de Destino: [Santander            ▼]            │
└─────────────────────────────────────────────────────────┘
```

#### 1.5 Atualizar payload no onSubmit
```typescript
const payload = {
  // ... campos existentes ...
  requer_inscricao: data.requer_inscricao || false,
  requer_pagamento: data.requer_pagamento || false,
  valor_inscricao: data.requer_pagamento ? data.valor_inscricao : null,
  vagas_limite: data.requer_inscricao ? data.vagas_limite : null,
  inscricoes_abertas_ate: data.requer_inscricao && data.inscricoes_abertas_ate 
    ? data.inscricoes_abertas_ate.toISOString() 
    : null,
  categoria_financeira_id: data.requer_pagamento ? data.categoria_financeira_id : null,
  conta_financeira_id: data.requer_pagamento ? data.conta_financeira_id : null,
};
```

#### 1.6 Carregar valores ao editar evento existente
Atualizar `form.reset` para incluir campos de inscrição.

---

## Parte 2: EventoDetalhes - Aba de Inscrições

### Arquivo: `src/pages/EventoDetalhes.tsx`

#### 2.1 Adicionar import do ícone
```typescript
import { Ticket } from "lucide-react";
```

#### 2.2 Adicionar variável de controle
```typescript
const mostrarInscricoes = evento?.requer_inscricao === true;
```

#### 2.3 Adicionar TabsTrigger (após Check-in)
```typescript
{mostrarInscricoes && (
  <TabsTrigger
    value="inscricoes"
    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
  >
    <Ticket className="h-4 w-4 mr-2" />
    <span className="hidden sm:inline">Inscrições</span>
  </TabsTrigger>
)}
```

#### 2.4 Adicionar TabsContent
```typescript
{mostrarInscricoes && (
  <TabsContent value="inscricoes" className="mt-6">
    <InscricoesTabContent 
      eventoId={id!} 
      evento={{
        id: evento.id,
        titulo: evento.titulo,
        requer_pagamento: evento.requer_pagamento,
        valor_inscricao: evento.valor_inscricao,
        vagas_limite: evento.vagas_limite,
        categoria_financeira_id: evento.categoria_financeira_id,
        conta_financeira_id: evento.conta_financeira_id,
      }}
    />
  </TabsContent>
)}
```

---

## Fluxo Completo do Usuário

```
1. Criar/Editar Evento
   └─> Tipo: EVENTO
       └─> Marcar "Requer Inscrição"
           └─> Definir vagas e prazo
           └─> Marcar "Evento Pago" (opcional)
               └─> Definir valor, categoria e conta

2. Visualizar Evento
   └─> Se requer_inscricao = true
       └─> Aba "Inscrições" aparece
           └─> Ver inscritos, confirmar pagamentos, adicionar manual
```

---

## Resumo das Alterações

| Arquivo | Alterações |
|---------|------------|
| `src/components/eventos/EventoDialog.tsx` | Estados, watches, carregamento de dados financeiros, nova seção UI, payload atualizado, reset com valores existentes |
| `src/pages/EventoDetalhes.tsx` | Variável de controle, TabsTrigger e TabsContent condicionais para inscrições |

---

## Resultado Esperado

| Ação | Resultado |
|------|-----------|
| Criar evento tipo EVENTO | Seção de inscrições disponível |
| Marcar "Requer Inscrição" | Campos de vagas e prazo aparecem |
| Marcar "Evento Pago" | Campos de valor e financeiro aparecem |
| Abrir detalhes de evento com inscrição | Aba "Inscrições" visível |
| Aba Inscrições | Lista inscritos, KPIs, ações de gestão |

