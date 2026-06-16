# 🧪 Sistema de Testes de Navbars Móveis

Este documento explica como usar o sistema de testes de navbars sem perder a funcionalidade atual.

## 📋 Estrutura

```
src/components/layout/
├── MainLayout.tsx                    (Original - NÃO MODIFICAR)
├── MainLayoutWithNavTests.tsx        (NOVO - Com suporte a testes)
├── Sidebar.tsx                       (Original - Continua funcionando)
├── MobileNavTestsClassic.tsx         (Variante 1: Instagram/Airbnb style)
├── MobileNavTestsFintech.tsx         (Variante 2: Nubank/Ação style)
└── MobileNavTestsSpotlight.tsx       (Variante 3: Futurista)
```

## 🚀 Como Usar

### Opção 1: Testar com MainLayoutWithNavTests (Recomendado)

1. **Abra o arquivo** onde importa `MainLayout`:
   ```tsx
   // src/main.tsx ou App.tsx
   import MainLayout from '@/components/layout/MainLayout';
   
   // Mude para:
   import MainLayout from '@/components/layout/MainLayoutWithNavTests';
   ```

2. **Escolha a variante** (em `MainLayoutWithNavTests.tsx`, linha ~20):
   ```typescript
   // 0 = Desligado (Menu Padrão)
   // 1 = Clássico
   // 2 = Fintech  👈 Mude este número
   // 3 = Spotlight
   const MOBILE_NAV_VARIANT = 0;
   ```

3. **Teste no mobile** (Chrome DevTools: Ctrl+Shift+M ou Cmd+Shift+M)

### Opção 2: Modificar MainLayout Original

Se preferir testar direto no `MainLayout.tsx` original:

```tsx
// Adicione no topo:
import { BottomNavClassic } from "./MobileNavTestsClassic";
import { BottomNavFintech } from "./MobileNavTestsFintech";
import { BottomNavSpotlight } from "./MobileNavTestsSpotlight";

// Dentro do componente:
const MOBILE_NAV_VARIANT = 2; // Escolha aqui

// E adicione antes do fechamento de SidebarInset:
<div className="md:hidden">
  {MOBILE_NAV_VARIANT === 1 && <BottomNavClassic />}
  {MOBILE_NAV_VARIANT === 2 && <BottomNavFintech />}
  {MOBILE_NAV_VARIANT === 3 && <BottomNavSpotlight />}
</div>
```

## 🎨 Variantes Disponíveis

### 1️⃣ Clássico (Instagram/Airbnb)
- Ícone + Label simples
- Cores básicas
- Bom para familiaridade do usuário

### 2️⃣ Fintech (Nubank/Ação)
- Destaque visual com background
- Escalamento de ícone ativo
- Padding refinado
- Bom para modernidade

### 3️⃣ Spotlight (Futurista)
- Glassmorphism
- Efeito de foco
- Animações suaves
- Bom para diferenciação

## 🛡️ Garantias

✅ **Sem perda de dados**: A Sidebar original continua funcionando
✅ **Sem breaking changes**: Mude entre variantes sem código duplicado
✅ **Safe areas**: Todos os navs respeitam notch/home indicator do iPhone
✅ **Responsivo**: No desktop (md+), esconde nav inferior e mostra Sidebar
✅ **Fácil volta**: Mude `MOBILE_NAV_VARIANT = 0` para voltar ao padrão

## 📱 Estrutura CSS

```
Desktop (md+):
├── Sidebar (visível)
├── Header com SidebarTrigger
└── Main content

Mobile (< md):
├── Header (sem SidebarTrigger se nav teste ativo)
├── Main content (com padding-bottom para nav)
└── BottomNav (variante escolhida)
```

## 🧬 Estrutura de um NavTest

Todos seguem este padrão:

```tsx
import { useLocation, useNavigate } from "react-router-dom";

export function BottomNav[Variant]() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden z-50">
      {/* Seu layout aqui */}
      {navItems.map((item) => (
        <button onClick={() => navigate(item.path)}>
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
```

## 🔧 Adicionar Novos Testes

Para criar uma nova variante:

1. **Copie** `MobileNavTestsFintech.tsx`
2. **Renomeie** para `MobileNavTests[NovoNome].tsx`
3. **Customize** o CSS/comportamento
4. **Importe** em `MainLayoutWithNavTests.tsx`
5. **Adicione** nova condição no `if/else` do render
6. **Atualize** o `MOBILE_NAV_VARIANT` para testar

## 📊 Testes Recomendados

- [ ] iPhone 12 (375px width, notch)
- [ ] iPhone SE (375px width, sem notch)
- [ ] Android 6.5" (412px width)
- [ ] iPad (768px - deve mostrar Sidebar)
- [ ] Desktop (1024px+)

## 🚀 Deploy em Produção

Quando escolher a melhor variante:

1. **Volte** `MOBILE_NAV_VARIANT = 0` em MainLayoutWithNavTests
2. **Ou** migre o código da melhor variante para `MainLayout.tsx` original
3. **Delete** as outras variantes
4. **Commit**: `feat: Escolhe estilo de navbar móvel [Variante escolhida]`

## 📝 Notas

- As navbars usam `useLocation()` e `useNavigate()` do react-router-dom
- Todos os ícones usam lucide-react (já instalado)
- O padding-bottom do main ajusta automaticamente conforme `MOBILE_NAV_VARIANT`
- No desktop, tudo se comporta como antes (Sidebar normal)

---

**Status**: 🧪 Em testes  
**Risco**: Baixo (apenas UI, sem schema/DB changes)  
**Branch**: `feature/navbar-tests`
