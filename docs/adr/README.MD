# Architecture Decision Records (ADR)

Cada ADR registra o contexto do problema, a decisão tomada, as alternativas consideradas e as consequências.
Objetivo: rastreabilidade sobre **por que o sistema é assim**.

---

## Lista de ADRs

| # | Título | Status | Link |
|---|---|---|---|
| 001 | Separação entre Fato Gerador, Fluxo de Caixa e DRE | Aceito | [ADR-001](ADR-001-separacao-fato-gerador-caixa-dre.md) |
| 002 | Autenticação Supabase (Auth + JWT) | Aceito | [ADR-002](ADR-002-autenticacao-supabase.md) |
| 003 | RLS e Modelo de Permissões | Aceito | [ADR-003](ADR-003-rls-e-modelo-permissoes.md) |
| 004 | Relacionamentos Bidirecionais em Famílias | Aceito | [ADR-004](ADR-004-relacionamentos-bidirecionais-familias.md) |
| 005 | Responsáveis Autorizados (Família / Guardians) | Aceito | [ADR-005](ADR-005-responsaveis-autorizados-familia.md) |
| 006 | Separação Comunicação e Notificações | Aceito | [ADR-006](ADR-006-separacao-comunicacao-notificacoes.md) |
| 007 | Estratégia de Entrega de Notificações | Aceito | [ADR-007](ADR-007-estrategia-entrega-notificacoes.md) |
| 008 | Uso de Eventos de Domínio | Aceito | [ADR-008](ADR-008-eventos-dominio.md) |
| 009 | Tipos de Jornada e Editor de Conteúdo | Aceito | [ADR-009](ADR-009-tipos-jornada-e-editor-conteudo.md) |
| 010 | Intercessão: Redirecionamento Inteligente vs Automação | Aceito | [ADR-010](ADR-010-intercessao-redirecionamento-inteligente.md) |
| 011 | Evolução do Ministério de Intercessão | Aceito | [ADR-011](ADR-011-evolucao-ministerio-intercessao.md) |
| 012 | Módulo Intercessão V2, CRM de Evangelismo e Chatbot Multimodal IA | Aceito | [ADR-012](012-intercessao-v2-evangelismo.md) |
| 014 | Gabinete Digital, Roteamento Pastoral e Unificação de Entradas | Aceito | [ADR-014](ADR-014-gabinete-digital-e-roteamento-pastoral.md) |
| 015 | Responsive Dialog Pattern | Aceito | [ADR-015](ADR-015-responsive-dialog-pattern.md) |
| 016 | Auditoria de Permissões e Rollback | Aceito | [ADR-016](ADR-016-auditoria-permissoes-e-rollback.md) |
| 017 | Refatoração para Hub de Eventos e Hub de Voluntariado | Aceito (Em Implementação) | [ADR-017](ADR-017-refatoracao-hub-eventos-voluntariado.md) |
| 018 | Estratégia de Migração Cultos → Eventos | Implementado | [ADR-018](ADR-018-estrategia-migracao-cultos-eventos.md) |
| 019 | Relógio de Oração — Timeline Inteligente | Aceito | [ADR-019](ADR-019-relogio-oracao-timeline-inteligente.md) |
| 020 | Portal de Voluntariado com Triagem Inteligente | Implementado | [ADR-020](ADR-020-portal-voluntariado-triagem-inteligente.md) |
| 021 | Arquitetura Multi-tenant com Isolamento por Igreja | Implementado | [ADR-021](ADR-021-multi-tenant-arquitetura.md) |
| 022 | Importação de Extratos via API (Santander e Getnet) | Proposto | [ADR-022](ADR-022-importacao-extratos-api.md) |
| 023 | Conferência Cega e Contagem Dupla | Aceito | [ADR-023](ADR-023-conferencia-cega-contagem-dupla.md) |
| 024 | Webhook PIX Santander com CORS aberto e health check | Aceito | [ADR-024](ADR-024-pix-webhook-santander.md) |
| 025 | Fluxo de Despesas e Baixa Automática | Aceito | [ADR-025](ADR-025-fluxo-despesas-baixa-automatica.md) |
| 026 | Integração de Lotes e Chatbots WhatsApp | Aceito | [ADR-026](ADR-026-integracao-lotes-chatbots-whatsapp.md) |
| 027 | Definição de Valor Bruto vs Valor Líquido | Aceito | [ADR-027](ADR-027-valor-bruto-vs-valor-liquido.md) |
| 028 | Sincronização Bancária Baseada em Eventos | Aceito | [ADR-028](ADR-028-sincronizacao-bancaria-baseada-eventos.md) |

> ADR-013 não existe (número reservado). O antigo ADR-016 sobre integração de lotes foi fundido no ADR-026 (ver `docs/_archive/_fundidos/`).

---

## Relação com Diagramas

Os ADRs referenciam diagramas em `../diagramas/` e documentos de arquitetura em `../01-Arquitetura/`.
