# ADR-002 — Autenticacao Supabase (Auth + JWT)

**Status:** Aceito  
**Data:** 2025-12-16  
**Decisores:** Produto, Tecnologia  
**Contexto:** Login, sessoes, gerenciamento de identidades

---

## 📌 Contexto
O produto requer autenticacao segura com baixo tempo de entrega, suporte a magic link e integracao direta com Postgres e RLS. Manter tokens e papeis alinhados ao banco facilita politicas linha-a-linha.

## ❗ Problema
Escolher a forma de gerir usuarios e sessoes que:
- Seja nativa ao stack (Supabase + Postgres)
- Exponha JWT com claims customizadas para RLS
- Tenha custo baixo e operacao simples

## ✅ Decisao
- Usar Supabase Auth como provedor de identidade (email/senha e magic link).
- Utilizar `@supabase/supabase-js` no frontend; sessao persistida em `localStorage`.
- Incluir claims no JWT: `sub`, `role`, `igreja_id` para consumo em RLS.
- Refresh token automatico via SDK; logout limpa sessao local.

## 👍 Consequencias Positivas
- Menos operacao (Auth gerenciado).
- JWT alinhado ao Postgres, facilitando RLS.
- Implementacao rapida com SDK oficial.

## ⚠️ Trade-offs
- Dependencia do SLA do Supabase Auth.
- Customizacao de fluxo limitada comparado a um IdP dedicado.
- Armazenamento em `localStorage` exige mitigacao de XSS.

## 🧩 Alternativas Rejeitadas
- **Auth0/Cognito/Keycloak**: mais custos/operacao, integracao adicional para RLS.
- **Auth custom (JWT proprio)**: maior manutencao e riscos de seguranca.

## 🔗 Referencias
- Documento de arquitetura: `../01-Arquitetura/02-autenticacao-supabase.MD`
- Fluxo de dados: `../01-Arquitetura/03-fluxo-de-dados.MD`
