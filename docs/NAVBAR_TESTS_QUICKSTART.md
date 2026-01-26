# 🧪 Guia Rápido - Sistema de Testes de Navbars

## ⚡ Início Rápido

### 1. Você está na branch `feature/navbar-tests` ✅

### 2. Arquivos Criados/Disponíveis:
```
✅ src/components/layout/MainLayoutWithNavTests.tsx (NOVO)
✅ src/components/layout/MobileNavTestsClassic.tsx (Existe)
✅ src/components/layout/MobileNavTestsFintech.tsx (Existe)
✅ src/components/layout/MobileNavTestsSpotlight.tsx (Existe)
📄 docs/NAVBAR_TESTS.md (Documentação completa)
```

### 3. Como Usar Agora:

**Opção A: Sem Modificar MainLayout Original**
```tsx
// Em src/main.tsx ou App.tsx
// MUDE ESTA LINHA:
import MainLayout from '@/components/layout/MainLayout';

// PARA ESTA:
import MainLayout from '@/components/layout/MainLayoutWithNavTests';
```

Depois escolha a variante no arquivo:
```typescript
// src/components/layout/MainLayoutWithNavTests.tsx
const MOBILE_NAV_VARIANT = 0; // 0=desligado, 1=clássico, 2=fintech, 3=spotlight
```

**Opção B: Modifique MainLayout Original Diretamente**
(Se quiser integrar permanentemente depois)

## 🎨 3 Variantes para Testar:

| Variante | Estilo | Melhor Para |
|----------|--------|------------|
| 1 | Clássico (Instagram/Airbnb) | Simplicidade, familiaridade |
| 2 | Fintech (Nubank/Ação) | Modernidade, contraste |
| 3 | Spotlight (Apple/Figma) | Destaque, futurismo |

## 🧬 O que está Pronto:

- ✅ NavTests importam e funcionam
- ✅ Responsive: Desktop mostra Sidebar, mobile mostra NavTest
- ✅ Safe areas para iPhone notch
- ✅ Sem breaking changes
- ✅ Volta para padrão com `MOBILE_NAV_VARIANT = 0`

## 📱 Como Testar:

1. Rode o projeto normalmente: `npm run dev`
2. Abra em mobile (Chrome DevTools: Ctrl+Shift+M)
3. Mude `MOBILE_NAV_VARIANT` e recarregue
4. Teste em diferentes resoluções

## 🚀 Próximas Etapas:

1. **Teste as 3 variantes** com usuários
2. **Escolha a melhor**
3. **Migre para MainLayout.tsx** original
4. **Delete MainLayoutWithNavTests.tsx** e outras variantes
5. **Commit com decisão tomada**: `feat: Implementa navbar móvel [Variante Escolhida]`

## 📋 Estrutura Mantida:

```
Desktop (md+):  Sidebar original + Header + Content ✅
Mobile (<md):   Header + Content + NavBar Teste ✅
Public routes:  Sem sidebar/navbar ✅
```

## 🛟 Rollback Fácil:

Se quiser voltar ao normal:
```tsx
// Mude de volta em src/main.tsx:
import MainLayout from '@/components/layout/MainLayout';
```

Pronto! Nada foi perdido.

---

**Status**: 🧪 Pronto para testes  
**Branch**: feature/navbar-tests  
**Risco**: Baixíssimo (apenas UI, sem database changes)

Para mais detalhes, veja `docs/NAVBAR_TESTS.md` 📖
