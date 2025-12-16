# ADR-003 — RLS e Modelo de Permissoes

**Status:** Aceito  
**Data:** 2025-12-16  
**Decisores:** Produto, Tecnologia, Governanca  
**Contexto:** Controle de acesso a dados multi-igreja e multi-papel

---

## 📌 Contexto
O sistema e multi-igreja, com papeis diferentes por usuario (admin, tecnico, lider, membro). Precisamos impedir acesso cruzado de dados e manter regras no banco para que qualquer cliente (web ou futura API) respeite as mesmas politicas.

## ❗ Problema
Definir modelo de autorizacao que:
- Aplique filtros por igreja e papel em todas as operacoes (select/insert/update/delete).
- Funcione direto no Postgres, evitando confianca excessiva no frontend.
- Permita evoluir permissoes por modulo sem duplicar logica.

## ✅ Decisao
- Ativar Row Level Security em todas as tabelas expostas.
- Usar claims do JWT (`sub`, `role`, `igreja_id`) em politicas RLS.
- Manter tabela de papeis/permissoes (`user_roles`, `user_app_roles`, `module_permissions`) para derivar acesso por modulo.
- Expor RPCs e views que tambem respeitam RLS, reduzindo logica no frontend.

## 👍 Consequencias Positivas
- Protecao consistente independentemente do cliente.
- Menor risco de vazamento entre igrejas.
- Permissoes versionadas e auditaveis junto ao schema.

## ⚠️ Trade-offs
- Complexidade maior em migracoes de banco (politicas por operacao).
- Necessidade de testes de RLS por papel a cada feature.
- Performance pode exigir indices alinhados aos filtros RLS.

## 🧩 Alternativas Rejeitadas
- **Controle somente no frontend**: inseguro, impossivel de auditar.
- **ACL por tabela na aplicacao**: duplicaria logica, risco de inconsistencia.

## 🔗 Referencias
- Documento de arquitetura: `../01-Arquitetura/04-rls-e-seguranca.MD`
- Fluxo de dados: `../01-Arquitetura/03-fluxo-de-dados.MD`
- Supabase Auth: `../01-Arquitetura/02-autenticacao-supabase.MD`
