# 📲 Guia de Integração: Notificações Push do Ministério Kids

## ✅ O que foi implementado

### 1. **Funções de Notificação no Banco (SQL)**

#### `notify_kids_diario()`
- **Trigger**: AFTER INSERT em `kids_diario`
- **Destinatário**: Responsável da criança
- **Mensagem**: "Notícia do Kids! 🎨 - O diário de [Nome] foi atualizado..."
- **Ação**: Abrir diário da criança com data do culto

#### `notify_kids_checkout()`
- **Trigger**: AFTER UPDATE em `kids_checkins`
- **Condição**: `checkout_at` transiciona de NULL para timestamp
- **Destinatário**: Responsável da criança
- **Mensagem**: "Saída Confirmada ✅ - O check-out de [Nome] foi realizado..."
- **Ação**: Mostrar detalhes do checkout

---

## 🎯 Como os Pais Recebem Notificações

### No Navegador (PWA - Web)

1. **Primeira vez que abre o app**:
   - Navegador pede permissão: "Igreja Carvalho gostaria de enviar notificações"
   - Pai clica em "Permitir" ✅

2. **Quando acontece um evento** (diário ou checkout):
   - Notificação push aparece no canto da tela com som/vibração
   - Título destacado com emoji (📔 ou ✅)
   - Mensagem curta com nome da criança

3. **Ao clicar na notificação**:
   - App abre automaticamente
   - Navega direto para o diário ou checkout (deep linking)

4. **Se não clicou**:
   - Notificação auto-fecha após 5 segundos
   - Fica registrada na aba de "Notificações" do app

### No App Mobile (React Native - Futuro)

Implementar via:
- **iOS**: `@react-native-community/push-notification-ios`
- **Android**: `firebase-messaging` ou `react-native-push-notification`

Será usado o mesmo sistema de Realtime + triggers SQL.

---

## 🔧 Integração no Código

### 1. **Hook: `useNotifications.tsx`** ✅

```typescript
const { notifications, pushEnabled, requestPushPermission } = useNotifications();
```

**Funcionalidades**:
- ✅ Carrega notificações ao iniciar
- ✅ Escuta Realtime (INSERT e UPDATE)
- ✅ Mostra push notification automaticamente
- ✅ Trata deep linking por tipo
- ✅ Evita duplicatas com `notificationProcessedRef`
- ✅ Fallback para toast se push não disponível

**Estados**:
```typescript
notifications[]     // Lista de todas as notificações
unreadCount        // Contagem de não lidas
pushEnabled        // Booleano indicando se push está ativo
loading            // Carregando notificações
```

**Métodos**:
```typescript
requestPushPermission()  // Pedir permissão ao navegador
markAsRead(id)          // Marcar uma como lida
markAllAsRead()         // Marcar todas como lidas
deleteNotification(id)  // Deletar uma notificação
```

### 2. **Componente: `NotificationBell.tsx`** ✅

Dropdown bell icon no header com:
- Lista de notificações em ordem recente
- Badge com contagem de não lidas
- Ação de marcar como lido/deletar
- Link para configurações

**Uso**:
```tsx
import { NotificationBell } from "@/components/NotificationBell";

// No navbar/header:
<NotificationBell />
```

### 3. **Componente: `NotificationSettings.tsx`** ✅

Página de configurações com:
- Status atual de notificações
- Permissão do navegador
- Tipos de notificação que serão recebidas
- Botão para ativar/desativar

**Uso**:
```tsx
import { NotificationSettings } from "@/components/NotificationSettings";

// Em /settings/notifications:
<NotificationSettings />
```

---

## 📋 Checklist de Integração

- [ ] **Aplicar migrations no Supabase**:
  ```bash
  cd supabase
  supabase migration up
  ```

- [ ] **Verificar RLS em notifications**:
  - Usuários podem LER suas próprias notificações
  - Sistema pode CRIAR notificações (SECURITY DEFINER)

- [ ] **Adicionar NotificationBell ao header**:
  ```tsx
  // src/components/layout/Header.tsx
  import { NotificationBell } from "@/components/NotificationBell";
  
  export function Header() {
    return (
      <header>
        {/* ... */}
        <NotificationBell />
        {/* ... */}
      </header>
    );
  }
  ```

- [ ] **Criar rota de configurações**:
  ```tsx
  // src/pages/ConfiguracoesNotificacoes.tsx
  import { NotificationSettings } from "@/components/NotificationSettings";
  
  export function ConfiguracoesNotificacoes() {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <h1>Notificações</h1>
        <NotificationSettings />
      </div>
    );
  }
  ```

- [ ] **Adicionar rota ao router**:
  ```typescript
  // src/App.tsx
  { path: "/settings/notifications", element: <ConfiguracoesNotificacoes /> }
  ```

- [ ] **Testar fluxo completo**:
  1. Pai loga no app
  2. Ativa notificações (browser pede permissão)
  3. Professor registra diário
  4. Pai recebe push (som/visual)
  5. Pai clica → abre diário automaticamente

---

## 🧪 Teste Manual

### Pré-requisito
```sql
-- Verificar que migrations foram aplicadas:
SELECT name FROM pg_proc WHERE proname IN (
  'notify_kids_diario',
  'notify_kids_checkout'
);
```

### Cenário 1: Notificação de Diário

1. Professor abre Kids Dashboard
2. Clica em "Registrar Diário" para uma criança
3. Preenche: Humor, Comportamentos, Necessidades, Observações
4. Clica "Salvar"
5. **Esperado**: Pai recebe notificação "Notícia do Kids! 🎨"

**Debug**:
```sql
-- Verificar notificação foi criada:
SELECT * FROM notifications 
WHERE type = 'kids_diario' 
ORDER BY created_at DESC LIMIT 1;
```

### Cenário 2: Notificação de Checkout

1. Pai está no app (FamilyWallet)
2. Clica "Buscar Criança" ou "Check-out"
3. Sistema registra `checkout_at`
4. **Esperado**: Pai recebe notificação "Saída Confirmada ✅"

**Debug**:
```sql
-- Verificar checkout foi registrado:
SELECT id, crianca_id, checkout_at, updated_at 
FROM kids_checkins 
WHERE checkout_at IS NOT NULL 
ORDER BY updated_at DESC LIMIT 1;

-- Verificar notificação foi criada:
SELECT * FROM notifications 
WHERE type = 'kids_checkout' 
ORDER BY created_at DESC LIMIT 1;
```

---

## 🔐 Segurança & RLS

### Políticas de Notificações

```sql
-- Usuários veem apenas suas notificações
CREATE POLICY "Usuários podem ver suas notificações"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Sistema cria notificações
CREATE POLICY "Sistema pode criar notificações"
ON public.notifications FOR INSERT
WITH CHECK (true);  -- Usa SECURITY DEFINER nas funções
```

### Responsável Vinculado

O sistema procura responsável em ordem:
1. **Tabela `familias`**: tipo_parentesco IN ('pai', 'mãe', 'responsável', 'tutor')
2. **Fallback**: campo `responsavel_id` no profile da criança
3. **Validação**: Só cria notificação se responsável tem `user_id` vinculado

---

## 📱 Deep Linking (Navegação Automática)

Quando pai clica na notificação, app abre em:

| Tipo | URL |
|------|-----|
| `kids_diario` | `/kids/diario/{crianca_id}?date={data}` |
| `kids_checkout` | `/kids/checkin/{crianca_id}` |
| `novo_visitante` | `/visitantes/{visitante_id}` |
| `promocao_status` | `/pessoas/{pessoa_id}` |

---

## 🚀 Melhorias Futuras

1. **Batch Notifications**: Agrupar múltiplas notificações por criança (ex: 1 diário + 1 checkout = 1 notificação)

2. **Smart Alerts**: 
   - Humor crítico (tristeza, choro) → notificação com urgência alta
   - Alergias/necessidades críticas → notificação marcada

3. **Preferências**:
   - Pai escolhe quais tipos quer receber
   - Horários de quiet hours

4. **Integração Firebase**: Usar Firebase Cloud Messaging para push em app mobile

5. **Analytics**: Rastrear se pai clicou, quando abriu, tempo gasto lendo

---

## 📚 Referências

- [Notifications API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Supabase Realtime - Docs](https://supabase.com/docs/guides/realtime)
- [PWA Push Notifications - Google](https://developers.google.com/web/ilt/pwa/working-with-notifications)
