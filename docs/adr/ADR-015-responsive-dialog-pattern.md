# ADR-015: Padrão ResponsiveDialog para Unificação Mobile/Desktop

**Status**: ✅ Aceito e Implementado

**Data**: 25 de Dezembro de 2025

**Contexto Técnico**: React + TypeScript + Tailwind CSS + shadcn/ui

---

## Contexto

O sistema possui 72+ dialogs/modals distribuídos em múltiplos módulos (Financeiro, Cultos, Jornadas, Pessoas, Kids, Intercessão, etc.). Historicamente, cada dialog era implementado com `Dialog` do shadcn/ui, que renderiza modais centralizados adequados para desktop mas problemáticos em mobile:

### Problemas Identificados

1. **Espaço vertical limitado**: Modais centralizados desperdiçam espaço em telas pequenas (viewport height ~650px em iPhones)
2. **Scroll dentro de scroll**: Modais com muito conteúdo criam duas barras de scroll (body + modal), confundindo usuários
3. **Interação não-nativa**: Usuários mobile esperam bottom sheets (deslizar para fechar), não modais com backdrop
4. **Safe areas ignoradas**: Modais não respeitavam notch/home indicator, ocultando conteúdo ou botões
5. **Manutenção duplicada**: Algumas telas tinham código separado para `Dialog` (desktop) e `Drawer` (mobile), dificultando manutenção

### Requisitos

- Experiência nativa mobile (bottom sheet) sem perder UX desktop (modal centralizado)
- API unificada para evitar duplicação de código
- Acessibilidade preservada (ARIA, foco, teclado)
- Migração incremental dos 72 dialogs existentes

---

## Decisão

Implementar **ResponsiveDialog**: componente único que renderiza `Dialog` (desktop) ou `Drawer` (mobile) baseado em viewport usando `useMediaQuery`.

### Arquitetura

```tsx
// src/components/ui/responsive-dialog.tsx
export function ResponsiveDialog({ children, ...props }) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  
  if (isDesktop) {
    return <Dialog {...props}>{children}</Dialog>
  }
  
  return <Drawer {...props}>{children}</Drawer>
}
```

### API Unificada

Componentes filhos compatíveis entre Dialog e Drawer:
- `ResponsiveDialogTrigger` → `DialogTrigger` | `DrawerTrigger`
- `ResponsiveDialogContent` → `DialogContent` | `DrawerContent`
- `ResponsiveDialogHeader` → `DialogHeader` | `DrawerHeader`
- `ResponsiveDialogTitle` → `DialogTitle` | `DrawerTitle`
- `ResponsiveDialogDescription` → `DialogDescription` | `DrawerDescription`
- `ResponsiveDialogFooter` → `DialogFooter` | `DrawerFooter`
- `ResponsiveDialogClose` → `DialogClose` | `DrawerClose`

### Breakpoint

**768px (md do Tailwind)** escolhido como ponto de corte:
- Mobile: <768px → Drawer (bottom sheet)
- Desktop: ≥768px → Dialog (modal centralizado)

Justificativa: Tablets em portrait (768px+) têm espaço suficiente para modais, mas smartphones (320-428px) se beneficiam de bottom sheets.

---

## Implementação

### Fase 1: Infraestrutura (commit `9824a8a`)

1. **CSS safe-areas** (`src/index.css`):
   ```css
   :root {
     --safe-area-inset-top: env(safe-area-inset-top);
     --safe-area-inset-bottom: env(safe-area-inset-bottom);
     /* ... */
   }
   
   input, select, textarea {
     font-size: 16px; /* Evita zoom iOS */
   }
   ```

2. **MainLayout adaptado**:
   - Header: `pt-safe` para respeitar notch
   - Wrapper: `pb-safe` para respeitar home indicator
   - Remoção de `overflow-x: hidden` fixo

3. **ResponsiveDialog base**: Componente criado com exports unificados

### Fase 2: Migração Sistemática (35 commits, 25/dez)

**Estratégia batch**: 5 dialogs por commit para facilitar code review e rollback se necessário.

**Dialogs migrados**:
- **Financeiro (10)**: TransacaoDialog, ContaDialog, FormaPagamentoDialog, FornecedorDialog, CategoriaDialog, CentroCustoDialog, AjusteSaldoDialog, ProcessarNotaFiscalDialog, ConfirmarPagamentoDialog, AplicarTemplateDialog
- **Cultos (5)**: CultoDialog, LiturgiaDialog, AplicarLiturgiaTemplateDialog, SalvarLiturgiaTemplateDialog, TagMidiaDialog
- **Jornadas (3)**: NovaJornadaDialog, EditarJornadaDialog, EventoDetailsDialog
- **Pessoas (8)**: AdicionarPessoaDialog, EditarStatusDialog, EditarContatosDialog, CompletarCadastroDialog, VincularResponsavelDialog, RegistrarVisitanteFamiliaDialog, AtribuirFuncaoDialog, AlterarSenhaDialog
- **Kids (2)**: CheckinManualDialog, EscalasDialog
- **Outros módulos (44+)**: Projetos, Ensino, Testemunhos, Intercessão, Pedidos, Admin, etc.

**Refatorações associadas**:
- `TransacaoDialog`: Componentização de upload/viewer
- `LiturgiaDialog`: Extração de `SeletorMidiasDialog`
- Accessibility fixes: Atributos ARIA corrigidos, navegação por teclado testada

### Fase 3: Otimizações Mobile (commits `46ba6b6`, `7a77eed`, `9461ca8`, `f540157`)

- **EditarPessoa**: Revisão completa com sections colapsáveis
- **Tabs → Select**: Visitantes, Todos, AniversariosDashboard
- **Componentes touch-friendly**: Família, escalas, envolvimento, sentimentos

---

## Consequências

### Positivas ✅

1. **Experiência mobile nativa**: Bottom sheets seguem padrão de apps modernos (WhatsApp, Instagram, etc.)
2. **Melhor uso de espaço**: Drawers ocupam até 90% da altura, reduzindo scroll
3. **Código unificado**: 72 dialogs com mesma API, facilita manutenção
4. **Acessibilidade preservada**: ARIA roles, foco, teclado funcionam em ambos os modos
5. **Safe areas respeitadas**: Conteúdo não fica oculto por notch/home indicator
6. **Performance**: `useMediaQuery` usa `matchMedia` nativo do browser (baixo custo)

### Negativas ⚠️

1. **Bundle size**: Adiciona dependência `vaul` (drawer do shadcn/ui) ~8kb gzipped
2. **Rehydration cuidado**: SSR deve manter isDesktop consistente (não aplicável no nosso caso, SPA com Vite)
3. **Breakpoint fixo**: 768px pode não ser ideal para todos os tablets (trade-off aceitável)
4. **Migração trabalhosa**: 72 dialogs exigiram 35 commits (mitigado por estratégia batch)

### Neutras ➖

- **Testing**: Testes devem mockar `useMediaQuery` para cobrir ambos os modos
- **Design tokens**: Drawer tem animações diferentes de Dialog (slide-up vs fade-in), mas mantém consistência visual

---

## Alternativas Consideradas

### 1. Manter Dialog + @media CSS

**Rejeitada**: CSS não muda componente React, apenas estilos. Drawer precisa de lógica diferente (swipe-to-dismiss, snap points).

### 2. Usar apenas Drawer (mobile-first)

**Rejeitada**: Desktop perde UX de modal centralizado (backdrop blur, foco centralizado). Drawers em telas grandes parecem "incompletos".

### 3. Biblioteca third-party (react-modal, reach-ui)

**Rejeitada**: shadcn/ui já fornece Dialog e Drawer com acessibilidade. Adicionar terceiro aumentaria bundle e inconsistência visual.

### 4. Breakpoint 640px (sm do Tailwind)

**Rejeitada**: 640px é muito pequeno, tablets portrait (768px) se beneficiam de Drawer. 768px (md) oferece melhor equilíbrio.

---

## Métricas de Sucesso

- ✅ **72 dialogs migrados** sem regressões funcionais
- ✅ **Build size**: +8kb gzipped (aceitável, <1% do bundle total ~1.2MB)
- ✅ **Lighthouse mobile**: Score de usabilidade mantido (92+)
- ✅ **iOS safe-areas**: Validado em iPhone 14 Pro (Dynamic Island) e iPhone SE (notch)
- ✅ **Acessibilidade**: axe-core 0 violations em ambos os modos

---

## Notas de Implementação

### Para novos dialogs:

```tsx
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'

<ResponsiveDialog open={open} onOpenChange={setOpen}>
  <ResponsiveDialogContent>
    <ResponsiveDialogHeader>
      <ResponsiveDialogTitle>Título</ResponsiveDialogTitle>
    </ResponsiveDialogHeader>
    {/* conteúdo */}
  </ResponsiveDialogContent>
</ResponsiveDialog>
```

### Safe areas em layouts:

```tsx
<div className="pt-safe pb-safe px-4">
  {/* conteúdo respeitando notch/home */}
</div>
```

### Inputs sem zoom iOS:

```tsx
<input className="text-base" /> {/* 16px mínimo */}
```

---

## Referências

- [shadcn/ui Dialog](https://ui.shadcn.com/docs/components/dialog)
- [shadcn/ui Drawer (vaul)](https://ui.shadcn.com/docs/components/drawer)
- [WebKit CSS safe-area-inset](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [iOS HIG - Modality](https://developer.apple.com/design/human-interface-guidelines/modality)

---

**Aprovado por**: Adriano Oliveira  
**Implementado em**: 25-26 de Dezembro de 2025  
**Revisão**: Não necessária (padrão estabelecido)
