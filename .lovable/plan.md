
# Correcoes no Fluxo de Senha (WhatsApp OTP) + Rotas + Permissoes

## Status: ✅ IMPLEMENTADO

Todas as 4 frentes foram implementadas com sucesso.

### O que foi feito:

1. **Tabela `otp_verificacao`** - Criada via migração com RLS habilitado
2. **Permissões `eventos.view/admin` e `cultos.view/admin`** - Inseridas em `app_permissions`
3. **Edge Function `verificar-otp-senha`** - Criada (rota pública, valida OTP + define senha)
4. **Edge Function `criar-usuario`** - Atualizada com OTP + disparar-alerta + action `recovery_otp`
5. **Edge Function `disparar-alerta`** - Corrigida para incluir `nome` no payload WhatsApp
6. **Página `DefinirSenha.tsx`** - Criada (rota `/definir-senha`)
7. **`CriarUsuarioDialog`** - Atualizado com fluxo OTP WhatsApp + fallback senha
8. **`ResetarSenhaDialog`** - Atualizado com fluxo OTP WhatsApp + fallback senha
9. **`Auth.tsx`** - Corrigida rota redirectTo + adicionada recuperação via WhatsApp
10. **`useAuth.tsx`** - Corrigidas rotas 404 (`/auth/reset` → `/reset-password`)
11. **`usePermissions.ts`** - Adicionadas permissões eventos/cultos
12. **`Sidebar.tsx`** - Eventos usando `eventos.view` ao invés de `ministerio.view`
13. **`PessoaDetalhes.tsx`** - Passando telefone e igreja_id aos dialogs
14. **`App.tsx`** - Rota `/definir-senha` adicionada

### Template WABA para Make

Rotear pelo campo `template == "otp_verificacao"`. Payload inclui:
- `telefone`, `nome`, `mensagem`, `template`, `whatsapp_remetente`, `whatsapp_sender_id`

Template Meta (categoria Authentication):
- Corpo: `Olá {{1}}, {{2}} é seu código de verificação. Válido por 10 minutos.`
- `{{1}}` = nome (campo `nome`), `{{2}}` = código de 6 dígitos
