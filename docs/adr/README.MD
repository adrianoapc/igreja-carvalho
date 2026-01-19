# Architecture Decision Records (ADR)

Este diretorio contem as decisoes arquiteturais do sistema.

Cada ADR registra:

- O contexto do problema
- A decisao tomada
- As alternativas consideradas
- As consequencias

O objetivo e manter rastreabilidade e clareza sobre **por que o sistema e assim**.

---

## 📘 Lista de ADRs

### ADR-001

- **Titulo:** Separacao entre Fato Gerador, Fluxo de Caixa e DRE
- **Status:** Aceito
- **Link:** [ADR-001](ADR-001-separacao-fato-gerador-caixa-dre.md)

### ADR-002

- **Titulo:** Autenticacao Supabase (Auth + JWT)
- **Status:** Aceito
- **Link:** [ADR-002](ADR-002-autenticacao-supabase.md)

### ADR-003

- **Titulo:** RLS e Modelo de Permissoes
- **Status:** Aceito
- **Link:** [ADR-003](ADR-003-rls-e-modelo-permissoes.md)

### ADR-004

- **Titulo:** Relacionamentos Bidirecionais em Familias
- **Status:** Aceito
- **Link:** [ADR-004](ADR-004-relacionamentos-bidirecionais-familias.md)

### ADR-012

- **Titulo:** Módulo Intercessão V2, CRM de Evangelismo e Chatbot Multimodal IA
- **Status:** Aceito
- **Link:** [ADR-012](012-intercessao-v2-evangelismo.md)

### ADR-014

- **Titulo:** Módulo Gabinete Digital, Roteamento Pastoral e Unificação de Entradas
- **Status:** Aceito
- **Link:** [ADR-014](ADR-014-gabinete-digital-e-roteamento-pastoral.md)

### ADR-017

- **Titulo:** Refatoração para Hub de Eventos e Hub de Voluntariado
- **Status:** Aceito (Em Implementação)
- **Link:** [ADR-017](ADR-017-refatoracao-hub-eventos-voluntariado.md)
- **Resumo:** Generalização da entidade `cultos` para `eventos` com polimorfismo via tipos discriminados, permitindo gerenciar cultos, relógios de oração, tarefas operacionais e eventos gerais em uma única estrutura.

### ADR-018

- **Titulo:** Estratégia de Migração Cultos → Eventos
- **Status:** Implementado
- **Link:** [ADR-018](ADR-018-estrategia-migracao-cultos-eventos.md)
- **Resumo:** Documentação detalhada da migração em 5 fases (Schema → FKs → Frontend → Edge Functions → Features) com pontos de validação e rollback.

### ADR-020

- **Titulo:** Portal de Voluntariado com Triagem Inteligente
- **Status:** Implementado
- **Link:** [ADR-020](ADR-020-portal-voluntariado-triagem-inteligente.md)
- **Resumo:** Sistema de inscrição pública de voluntários com validação automática de elegibilidade por ministério e integração com trilhas de formação.

### ADR-021

- **Titulo:** Arquitetura Multi-tenant com Isolamento por Igreja
- **Status:** Implementado
- **Link:** [ADR-021](ADR-021-multi-tenant-arquitetura.md)
- **Resumo:** Implementação de isolamento completo por igreja com coluna `igreja_id` em 30+ tabelas, RLS policies, super admin dashboard e suporte a filiais hierárquicas.

### ADR-022

- **Titulo:** Estrategia de Importacao de Extratos via API (Santander e Getnet)
- **Status:** Proposto
- **Link:** [ADR-022](ADR-022-importacao-extratos-api.md)
- **Resumo:** Conectores por provedor usando polling inicial com backoff, dedupe/idempotencia antes de persistir em `extratos_bancarios`, armazenamento seguro de credenciais e observabilidade basica.

### ADR-023

- **Titulo:** Conferência Cega com Contagem Dupla e Tolerância Parametrizada
- **Status:** Aceito
- **Link:** [ADR-023](ADR-023-conferencia-cega-contagem-dupla.md)
- **Resumo:** Modelo de contagem dupla independente com snapshot imutável, tolerância configurável (% e R$), blind count (opcional/obrigatório), e base para sincronização com provedores externos via `finance-sync`.

### ADR-024

- **Titulo:** Webhook PIX Santander com CORS aberto e health check
- **Status:** Aceito
- **Link:** [ADR-024](ADR-024-pix-webhook-santander.md)
- **Resumo:** Endpoint GET/POST exigido pelo Santander, CORS aberto somente para o webhook, resolução de `igreja_id` via CNPJ da chave PIX e persistência idempotente em `pix_webhook_temp` com payload bruto.

---

## 📐 Relacao com Diagramas

Os ADRs referenciam diagramas localizados em `../diagramas/` e documentos de arquitetura em `../01-Arquitetura/`.
