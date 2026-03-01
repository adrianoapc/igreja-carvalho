
# Correcoes no Fluxo de Senha (WhatsApp OTP) + Rotas + Permissoes

## Resumo

Este plano cobre 4 frentes: (1) WhatsApp OTP para criacao e recuperacao de senha, (2) correcao das rotas 404, (3) isolamento multi-tenant no envio do OTP, e (4) permissoes de Eventos/Cultos.

---

## 1. WhatsApp OTP - Fluxo Completo (Criacao + Recuperacao)

### 1a. Criacao de Usuario (admin cria acesso)
1. Admin clica "Criar Usuario" no perfil da pessoa
2. Edge Function `criar-usuario` cria o auth user com senha aleatoria interna (nunca exibida)
3. Gera OTP de 6 digitos, salva em `otp_verificacao` com expiracao de 10 min
4. Chama `disparar-alerta` passando `igreja_id` e `nome` da pessoa para resolver o webhook correto (multi-tenant) e personalizar a mensagem
5. Admin ve: "Codigo enviado para o WhatsApp de [nome]"
6. Pessoa acessa `/definir-senha`, digita telefone + OTP + nova senha

### 1b. Reset de Senha (admin reseta)
- Mesmo fluxo: gera OTP, envia via WhatsApp, pessoa usa `/definir-senha`

### 1c. Recuperacao de Senha (pessoa esqueceu) -- NOVO
1. Na tela de login, secao "Esqueci minha senha", adicionar opcao "Recuperar via WhatsApp"
2. Pessoa digita o telefone cadastrado
3. Frontend chama Edge Function `criar-usuario` com `action: "recovery_otp"` + telefone
4. Edge Function busca o profile pelo telefone, gera OTP, envia via `disparar-alerta` (com `igreja_id` e `nome` da pessoa)
5. Pessoa e redirecionada para `/definir-senha` para digitar OTP + nova senha

### Correcao: Nome da pessoa no payload do WhatsApp

Atualmente o payload enviado ao Make pelo `dispararWhatsAppMultiTenant` nao inclui o nome do destinatario. Isso impede que o template WABA personalize a mensagem com o nome da pessoa.

**Correcao em `disparar-alerta/index.ts`:**
- Adicionar parametro `nome` na funcao `dispararWhatsAppMultiTenant`
- Incluir campo `nome` no payload enviado ao webhook Make
- Passar `destinatario.nome` na chamada da funcao (linha ~725)

Payload corrigido enviado ao Make:
```text
{
  "telefone": "5511999999999",
  "nome": "Joao Silva",
  "whatsapp_remetente": "<numero da igreja>",
  "whatsapp_sender_id": "<phone_number_id>",
  "mensagem": "Seu codigo de verificacao e: 123456. Valido por 10 minutos.",
  "template": "otp_verificacao",
  "webhook_nivel": "igreja",
  "timestamp": "2026-03-01T..."
}
```

### Isolamento Multi-Tenant (WhatsApp)

O `disparar-alerta` ja resolve o webhook correto quando recebe `igreja_id` (via `webhook-resolver.ts`). A Edge Function `criar-usuario` passara o `igreja_id` da pessoa no payload.

### Template WABA para Make

No Make, rotear pelo campo `template == "otp_verificacao"`. O template Meta deve ser da categoria **Authentication** com:
- **Nome sugerido**: `otp_verificacao` ou `codigo_verificacao`
- **Corpo**: `Ola {{1}}, {{2}} e seu codigo de verificacao. Valido por 10 minutos.`
- **Botao (opcional)**: "Copiar codigo" (tipo copy_code com payload `{{2}}`)

O parametro `{{1}}` sera o nome (campo `nome` do payload) e `{{2}}` sera o codigo de 6 digitos.

---

## 2. Correcao das Rotas 404

| Arquivo | De | Para |
|---|---|---|
| `src/pages/Auth.tsx` (redirectTo) | `.../auth/reset` | `.../reset-password` |
| `src/hooks/useAuth.tsx` (producao) | `.../auth/reset...` | `.../reset-password...` |
| `src/hooks/useAuth.tsx` (redirect) | `/auth/reset` | `/reset-password` |
| `src/pages/Auth.tsx` (navigate) | `/trocar-senha` | `/forced-password-change` |

---

## 3. Permissoes Eventos e Cultos

Inserir na tabela `app_permissions`:
- `eventos.view`, `eventos.admin`
- `cultos.view`, `cultos.admin`

Atualizar `usePermissions.ts` e `Sidebar.tsx` para usar essas permissoes.

---

## Detalhes Tecnicos

### Nova tabela: `otp_verificacao`

```sql
CREATE TABLE otp_verificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  codigo varchar(6) NOT NULL,
  tipo varchar(20) NOT NULL,
  telefone varchar(20),
  igreja_id uuid,
  expira_em timestamptz NOT NULL,
  usado boolean DEFAULT false,
  tentativas int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE otp_verificacao ENABLE ROW LEVEL SECURITY;
```

### Nova Edge Function: `verificar-otp-senha`
- Rota publica (verify_jwt = false)
- Recebe: telefone, codigo, nova senha
- Valida OTP (correto, nao expirado, tentativas < 5, nao usado)
- Atualiza senha via Admin API
- Marca `deve_trocar_senha = false` no profile
- Marca OTP como usado

### Atualizacoes na Edge Function `criar-usuario`
- Nova action `recovery_otp`: busca profile por telefone, gera OTP, envia
- Actions existentes (`create_user`, `reset_password`): passam a gerar OTP + enviar ao inves de retornar senha

### Correcao na Edge Function `disparar-alerta`
- Funcao `dispararWhatsAppMultiTenant`: adicionar parametro `nome?: string` e incluir no payload
- Na chamada (linha ~725): passar `destinatario.nome`
- Tambem corrigir para o caso de chamada direta (OTP), onde o nome vem em `dados.nome`

### Nova pagina: `src/pages/DefinirSenha.tsx`
- Rota publica `/definir-senha`
- Campos: telefone, OTP (6 digitos via input-otp), nova senha, confirmar senha
- Chama `verificar-otp-senha`
- Sucesso redireciona para `/auth`

### Atualizacoes no Frontend
- `CriarUsuarioDialog.tsx`: novo prop `pessoaTelefone` e `pessoaIgrejaId`, chama action `create_user` que agora envia OTP automaticamente. Fallback manual se sem telefone.
- `ResetarSenhaDialog.tsx`: mesma logica, chama action `reset_password` que envia OTP.
- `Auth.tsx`: adicionar secao "Recuperar via WhatsApp" com campo de telefone.
- `App.tsx`: adicionar rota `/definir-senha`
- `PessoaDetalhes.tsx`: passar telefone, nome e igreja_id aos dialogs

### Arquivos a criar/editar

| Arquivo | Acao |
|---|---|
| `otp_verificacao` (tabela) | Criar via migracao |
| `app_permissions` (dados) | Inserir eventos/cultos |
| `supabase/functions/verificar-otp-senha/index.ts` | Criar |
| `supabase/functions/criar-usuario/index.ts` | Editar (OTP + disparar-alerta) |
| `supabase/functions/disparar-alerta/index.ts` | Editar (adicionar nome no payload) |
| `src/pages/DefinirSenha.tsx` | Criar |
| `src/components/pessoas/CriarUsuarioDialog.tsx` | Editar |
| `src/components/pessoas/ResetarSenhaDialog.tsx` | Editar |
| `src/pages/Auth.tsx` | Editar (rotas + recuperacao WhatsApp) |
| `src/hooks/useAuth.tsx` | Editar (rotas) |
| `src/hooks/usePermissions.ts` | Editar |
| `src/components/layout/Sidebar.tsx` | Editar |
| `src/App.tsx` | Editar (rota `/definir-senha`) |
| `src/pages/PessoaDetalhes.tsx` | Editar (passar telefone, nome e igreja_id) |
