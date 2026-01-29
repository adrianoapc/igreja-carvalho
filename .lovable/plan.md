
# Plano: Arquitetura de Webhooks e WhatsApp com Permissões Globais e Read-Only

## Resumo do Requisito

Implementar um sistema onde:
1. **Webhooks e WhatsApp podem ser globais** (de todo o sistema, não apenas da igreja)
2. **Fallback em 3 níveis**: Filial → Igreja → Sistema
3. **Segurança**: Usuários normais só visualizam configs globais (read-only), apenas super_admin pode editar

---

## Arquitetura de Permissões

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           MATRIZ DE PERMISSÕES                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  CENÁRIO 1: Igreja tem config própria                                                   │
│  ─────────────────────────────────────                                                  │
│  → Admin da igreja pode VER e EDITAR                                                    │
│  → Botões de salvar/editar HABILITADOS                                                  │
│                                                                                         │
│  CENÁRIO 2: Igreja usa config global do sistema                                         │
│  ──────────────────────────────────────────────                                         │
│  → Admin da igreja pode apenas VER (read-only)                                          │
│  → Botões de salvar/editar DESABILITADOS                                                │
│  → Badge visual: "Usando configuração global do sistema"                                │
│  → Tooltip: "Entre em contato com o suporte para personalizar"                          │
│                                                                                         │
│  CENÁRIO 3: Super Admin                                                                 │
│  ─────────────────────────────                                                          │
│  → Pode VER e EDITAR todas as configs (globais e por igreja)                            │
│  → Acesso a painel especial para gerenciar configs globais do sistema                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Alterações no Banco de Dados

### 1. Tornar igreja_id nullable nas tabelas

```sql
-- WEBHOOKS: permitir registros globais do sistema
ALTER TABLE webhooks ALTER COLUMN igreja_id DROP NOT NULL;

-- Adicionar coluna para vincular número WhatsApp remetente
ALTER TABLE webhooks ADD COLUMN whatsapp_numero_id uuid REFERENCES whatsapp_numeros(id);

-- WHATSAPP_NUMEROS: permitir números globais do sistema
ALTER TABLE whatsapp_numeros ALTER COLUMN igreja_id DROP NOT NULL;
```

### 2. Criar índices para consultas com fallback

```sql
-- Webhooks globais do sistema (fallback final)
CREATE INDEX idx_webhooks_global_sistema ON webhooks(tipo) 
  WHERE igreja_id IS NULL AND filial_id IS NULL;

-- Webhooks globais da igreja
CREATE INDEX idx_webhooks_global_igreja ON webhooks(igreja_id, tipo) 
  WHERE filial_id IS NULL;

-- WhatsApp números globais do sistema
CREATE INDEX idx_whatsapp_numeros_global_sistema ON whatsapp_numeros(provider) 
  WHERE igreja_id IS NULL AND filial_id IS NULL;
```

### 3. Atualizar políticas RLS

```sql
-- WEBHOOKS: Leitura inclui globais do sistema
DROP POLICY IF EXISTS "Igreja pode ver webhooks" ON webhooks;
CREATE POLICY "Igreja pode ver webhooks" ON webhooks FOR SELECT
USING (
  -- Próprios da igreja
  igreja_id = (NULLIF(current_setting('request.jwt.claim.igreja_id', true), ''))::uuid
  OR
  -- Globais do sistema (leitura permitida para todos autenticados)
  igreja_id IS NULL
);

-- WEBHOOKS: Edição apenas de registros da própria igreja
-- (globais do sistema só podem ser editados via super_admin)
DROP POLICY IF EXISTS "Admins podem atualizar webhooks" ON webhooks;
CREATE POLICY "Admins podem atualizar webhooks" ON webhooks FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND igreja_id IS NOT NULL  -- Bloqueia edição de globais do sistema
  AND igreja_id = (NULLIF(current_setting('request.jwt.claim.igreja_id', true), ''))::uuid
)
WITH CHECK (
  igreja_id IS NOT NULL 
  AND igreja_id = (NULLIF(current_setting('request.jwt.claim.igreja_id', true), ''))::uuid
);

-- WEBHOOKS: Inserção apenas com igreja_id preenchido (usuário normal)
DROP POLICY IF EXISTS "Admins podem inserir webhooks" ON webhooks;
CREATE POLICY "Admins podem inserir webhooks" ON webhooks FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND igreja_id IS NOT NULL  -- Usuário normal não pode criar globais
  AND igreja_id = (NULLIF(current_setting('request.jwt.claim.igreja_id', true), ''))::uuid
);

-- WEBHOOKS: Super Admin pode tudo
CREATE POLICY "Super admin pode gerenciar webhooks" ON webhooks
FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Mesma lógica para WHATSAPP_NUMEROS
DROP POLICY IF EXISTS "Igreja pode ver whatsapp numeros" ON whatsapp_numeros;
CREATE POLICY "Igreja pode ver whatsapp numeros" ON whatsapp_numeros FOR SELECT
USING (
  igreja_id = (((auth.jwt() -> 'app_metadata') ->> 'igreja_id'))::uuid
  OR igreja_id IS NULL
);

DROP POLICY IF EXISTS "Admins podem atualizar whatsapp numeros" ON whatsapp_numeros;
CREATE POLICY "Admins podem atualizar whatsapp numeros" ON whatsapp_numeros FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND igreja_id IS NOT NULL
  AND igreja_id = (((auth.jwt() -> 'app_metadata') ->> 'igreja_id'))::uuid
)
WITH CHECK (
  igreja_id IS NOT NULL 
  AND igreja_id = (((auth.jwt() -> 'app_metadata') ->> 'igreja_id'))::uuid
);

DROP POLICY IF EXISTS "Admins podem inserir whatsapp numeros" ON whatsapp_numeros;
CREATE POLICY "Admins podem inserir whatsapp numeros" ON whatsapp_numeros FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND igreja_id IS NOT NULL
  AND igreja_id = (((auth.jwt() -> 'app_metadata') ->> 'igreja_id'))::uuid
);

DROP POLICY IF EXISTS "Admins podem remover whatsapp numeros" ON whatsapp_numeros;
CREATE POLICY "Admins podem remover whatsapp numeros" ON whatsapp_numeros FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND igreja_id IS NOT NULL
  AND igreja_id = (((auth.jwt() -> 'app_metadata') ->> 'igreja_id'))::uuid
);

CREATE POLICY "Super admin pode gerenciar whatsapp numeros" ON whatsapp_numeros
FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
```

---

## Alterações na Interface (UI)

### 1. Webhooks.tsx - Modo Read-Only para Configs Globais

**Lógica a implementar:**

```typescript
// Buscar configs da igreja E globais do sistema
const { data: webhooks } = await supabase
  .from("webhooks_safe")
  .select("tipo, url, secret_masked, has_secret, enabled, igreja_id")
  .or(`igreja_id.eq.${igrejaId},igreja_id.is.null`);

// Determinar se está usando config global
const isUsingGlobalConfig = (tipo: string) => {
  const igrejaConfig = webhooks?.find(w => w.tipo === tipo && w.igreja_id === igrejaId);
  const globalConfig = webhooks?.find(w => w.tipo === tipo && w.igreja_id === null);
  return !igrejaConfig && !!globalConfig;
};

// Estado read-only
const isReadOnly = isUsingGlobalConfig(tipo) && !isSuperAdmin;
```

**Alterações visuais:**

- Adicionar Badge "Configuração Global do Sistema" quando usando fallback
- Desabilitar inputs e botões de salvar quando read-only
- Mostrar tooltip explicativo: "Configure um webhook personalizado ou entre em contato com o suporte"
- Botão "Personalizar" que cria uma cópia local para a igreja

### 2. WhatsAppNumeros.tsx - Mesma Lógica

- Listar números da igreja + números globais do sistema
- Números globais aparecem com badge "Global do Sistema" e são read-only
- Apenas super_admin pode editar números globais

### 3. Indicador Visual de Origem

```typescript
// Componente de badge para indicar origem
const ConfigOriginBadge = ({ igreja_id }: { igreja_id: string | null }) => {
  if (igreja_id === null) {
    return (
      <Badge variant="secondary" className="bg-purple-100 text-purple-700">
        <Globe className="h-3 w-3 mr-1" />
        Global do Sistema
      </Badge>
    );
  }
  return null;
};
```

---

## Alterações nas Edge Functions

### 1. Função Compartilhada de Resolução

Arquivo: `supabase/functions/_shared/webhook-resolver.ts`

```typescript
interface WebhookResolucao {
  webhookUrl: string;
  webhookNivel: 'filial' | 'igreja' | 'sistema';
  whatsappRemetente: string | null;
  whatsappSenderId: string | null;
}

export async function resolverWebhookComRemetente(
  supabase: SupabaseClient,
  igrejaId: string,
  filialId: string | null,
  tipoWebhook: string
): Promise<WebhookResolucao | null> {
  
  // NÍVEL 1: Webhook específico da filial
  if (filialId) {
    const { data } = await supabase
      .from('webhooks')
      .select('url, whatsapp_numero_id')
      .eq('igreja_id', igrejaId)
      .eq('filial_id', filialId)
      .eq('tipo', tipoWebhook)
      .eq('enabled', true)
      .maybeSingle();
    
    if (data?.url) {
      const remetente = await resolverRemetente(supabase, data.whatsapp_numero_id, igrejaId, filialId);
      return { webhookUrl: data.url, webhookNivel: 'filial', ...remetente };
    }
  }
  
  // NÍVEL 2: Webhook global da igreja
  const { data: igrejaWebhook } = await supabase
    .from('webhooks')
    .select('url, whatsapp_numero_id')
    .eq('igreja_id', igrejaId)
    .is('filial_id', null)
    .eq('tipo', tipoWebhook)
    .eq('enabled', true)
    .maybeSingle();
  
  if (igrejaWebhook?.url) {
    const remetente = await resolverRemetente(supabase, igrejaWebhook.whatsapp_numero_id, igrejaId, filialId);
    return { webhookUrl: igrejaWebhook.url, webhookNivel: 'igreja', ...remetente };
  }
  
  // NÍVEL 3: Webhook GLOBAL DO SISTEMA
  const { data: sistemaWebhook } = await supabase
    .from('webhooks')
    .select('url, whatsapp_numero_id')
    .is('igreja_id', null)
    .is('filial_id', null)
    .eq('tipo', tipoWebhook)
    .eq('enabled', true)
    .maybeSingle();
  
  if (sistemaWebhook?.url) {
    // Para webhook global do sistema, remetente vem da hierarquia da igreja
    const remetente = await resolverRemetente(supabase, sistemaWebhook.whatsapp_numero_id, igrejaId, filialId);
    return { webhookUrl: sistemaWebhook.url, webhookNivel: 'sistema', ...remetente };
  }
  
  return null;
}

async function resolverRemetente(
  supabase: SupabaseClient,
  whatsappNumeroId: string | null,
  igrejaId: string,
  filialId: string | null
) {
  // 1. Número vinculado ao webhook
  if (whatsappNumeroId) {
    const { data } = await supabase
      .from('whatsapp_numeros')
      .select('display_phone_number, phone_number_id')
      .eq('id', whatsappNumeroId)
      .maybeSingle();
    
    if (data?.display_phone_number) {
      return {
        whatsappRemetente: data.display_phone_number,
        whatsappSenderId: data.phone_number_id,
      };
    }
  }
  
  // 2. Número da filial
  if (filialId) {
    const { data } = await supabase
      .from('whatsapp_numeros')
      .select('display_phone_number, phone_number_id')
      .eq('igreja_id', igrejaId)
      .eq('filial_id', filialId)
      .eq('enabled', true)
      .maybeSingle();
    
    if (data?.display_phone_number) {
      return {
        whatsappRemetente: data.display_phone_number,
        whatsappSenderId: data.phone_number_id,
      };
    }
  }
  
  // 3. Número global da igreja
  const { data: igrejaNumero } = await supabase
    .from('whatsapp_numeros')
    .select('display_phone_number, phone_number_id')
    .eq('igreja_id', igrejaId)
    .is('filial_id', null)
    .eq('enabled', true)
    .maybeSingle();
  
  if (igrejaNumero?.display_phone_number) {
    return {
      whatsappRemetente: igrejaNumero.display_phone_number,
      whatsappSenderId: igrejaNumero.phone_number_id,
    };
  }
  
  // 4. Número global do SISTEMA
  const { data: sistemaNumero } = await supabase
    .from('whatsapp_numeros')
    .select('display_phone_number, phone_number_id')
    .is('igreja_id', null)
    .is('filial_id', null)
    .eq('enabled', true)
    .maybeSingle();
  
  return {
    whatsappRemetente: sistemaNumero?.display_phone_number || null,
    whatsappSenderId: sistemaNumero?.phone_number_id || null,
  };
}
```

### 2. Atualizar Edge Functions Existentes

Modificar `disparar-alerta`, `disparar-escala`, `notificar-liturgia-make` para:
- Usar a nova função `resolverWebhookComRemetente`
- Incluir `whatsapp_remetente` e `whatsapp_sender_id` no payload
- Logar o nível do webhook usado (filial/igreja/sistema)

---

## Fluxo Visual Completo

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  EXEMPLO: Igreja Nova (sem configs próprias)                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Tela de Integrações:                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  Canal de Mensagens                                    [Global do Sistema] 🔒     │ │
│  │                                                                                    │ │
│  │  Provedor: Make.com (Via Webhook)                                                  │ │
│  │  URL: https://hook.us2.make.com/j8rh...  (desabilitado)                            │ │
│  │                                                                                    │ │
│  │  ⚠️ Você está usando a configuração global do sistema.                            │ │
│  │     [Personalizar para minha igreja]                                               │ │
│  │                                                                                    │ │
│  │  Botão [Salvar Conexão] → DESABILITADO                                             │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  EXEMPLO: Igreja Carvalho (com config própria)                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Tela de Integrações:                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  Canal de Mensagens                                                                │ │
│  │                                                                                    │ │
│  │  Provedor: Make.com (Via Webhook)                                                  │ │
│  │  URL: https://hook.us2.make.com/minha-igreja...  (editável)                        │ │
│  │                                                                                    │ │
│  │  Botão [Salvar Conexão] → HABILITADO                                               │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  EXEMPLO: Super Admin                                                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Painel Super Admin → Configurações Globais:                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  ⚙️ Webhooks Globais do Sistema                                                   │ │
│  │                                                                                    │ │
│  │  whatsapp_make: https://hook.us2.make.com/...  [Editar]                            │ │
│  │  make_escalas: https://hook.us2.make.com/...   [Editar]                            │ │
│  │  make_liturgia: (não configurado)              [Configurar]                        │ │
│  │                                                                                    │ │
│  │  📱 Números WhatsApp Globais                                                       │ │
│  │  5517996603391 (Meta) - Padrão do sistema      [Editar]                            │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Ordem de Implementação

| Etapa | Descrição | Arquivos |
|-------|-----------|----------|
| 1 | Migração SQL: tornar igreja_id nullable + whatsapp_numero_id | Migração SQL |
| 2 | Atualizar políticas RLS com regras de leitura/escrita | Migração SQL |
| 3 | Criar função compartilhada de resolução | `_shared/webhook-resolver.ts` |
| 4 | Atualizar Edge Functions para usar resolver | `disparar-alerta`, `disparar-escala`, etc. |
| 5 | Atualizar Webhooks.tsx com lógica read-only | `src/pages/admin/Webhooks.tsx` |
| 6 | Atualizar WhatsAppNumeros.tsx com lógica read-only | `src/pages/admin/WhatsAppNumeros.tsx` |
| 7 | Criar painel Super Admin para configs globais | Nova página/componente |
| 8 | Inserir dados globais iniciais | Migração SQL de seed |
| 9 | Testar fluxo end-to-end | Teste manual |

---

## Dados Iniciais (Seed)

```sql
-- Webhook global do sistema (fallback)
INSERT INTO webhooks (igreja_id, filial_id, tipo, url, enabled)
VALUES 
  (NULL, NULL, 'whatsapp_make', 'https://hook.us2.make.com/j8rhitc7bb886u3i1j9q13trlpp291x3', true);

-- Número WhatsApp global do sistema (fallback)
INSERT INTO whatsapp_numeros (igreja_id, filial_id, display_phone_number, phone_number_id, provider, enabled)
VALUES 
  (NULL, NULL, '5517996603391', '1031291743394274', 'meta', true);
```

---

## Benefícios

| Aspecto | Benefício |
|---------|-----------|
| Setup Zero | Nova igreja já funciona sem configurar nada |
| Flexibilidade | Igreja pode personalizar quando quiser |
| Segurança | Configs globais protegidas de alteração acidental |
| Escalabilidade | Um cenário Make pode atender múltiplas igrejas |
| UX Clara | Usuário entende visualmente o que está usando |
