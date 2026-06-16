# Log de Consolidação de /docs — 2026-06-15

Branch: `docs/consolidacao`
Executor: Claude (claude-sonnet-4-6) a pedido de Adriano Oliveira
Escopo: apenas `/docs/**` — nenhuma alteração em `src/**` ou `supabase/**`

---

## Passo 1 — APAGAR (git rm)

Arquivos deletados (histórico preservado no git):

1. `docs/adr/ADR-012: Módulo Intercessão V2...` — nome inválido (dois-pontos e espaços)
2. `docs/adr/ADR-016-integracao-lotes-chatbots-whatsapp.md` — duplicata do ADR-026
3. `docs/catalogo/catalogo-telas.md` — superado por `docs/telas/catalogo-telas.md`
4. `docs/catalogo/matriz-permissoes.md` — superado por `docs/telas/matriz-permissoes.md`
5. `docs/automacoes/triggers-db.md` — arquivo de 0 bytes, nunca escrito
6. `docs/IMPLEMENTATION_STATUS.md` — mal classificado; conteúdo de testes de navbar, não financeiro
7. `docs/diagramas/.gitkeep` — pasta agora tem conteúdo real

---

## Passo 2 — ARQUIVAR (git mv → docs/_archive/)

35 arquivos movidos para `docs/_archive/`:

- AUDITORIA_TELAS_*.md (2 arquivos) — snapshots pontuais
- DOCOPS_REVIEW_*.md (2 arquivos) — revisões internas
- SPRINT_KIDS_SUMMARY.md — sumário de sprint
- NAVBAR_TESTS*.md (2 arquivos) — testes de navbar
- REFRESH_TOKEN_INVESTIGATION.md — investigação pontual
- USER_CREATION_FIX.md — hotfix documentado
- VERIFICACAO_CERTIFICADO.md — verificação pontual
- README_MIGRATION.md — guia temporário de migração
- CONCILIACAO_OFERTAS_ANALYSIS.md — análise pontual
- SINCRONIZACAO_TRANSFERENCIAS_CONCILIACAO.md
- IMPLEMENTACAO_SINCRONIZACAO_TRANSFERENCIAS.md
- AFERACAO_RELATORIO_OFERTAS.md
- FLUXO_RELATORIO_OFERTAS.md
- SOLUCAO_DINAMICA_FORMA_CONTA.md
- IMPLEMENTACAO_CONCLUSAO.md
- ANALISE_DUPLICACAO_FORMAS.md
- FK_CONSTRAINTS_FIX.md
- HOTFIX_CONSTRAINT_CONCILIACOES_LOTE.md
- IMPLEMENTACAO_PHASE_1_INTEGRACOES.md
- INTEGRACAO_FINANCEIRA_PHASE_1.md
- TEST_SANTANDER_API.md
- TESTE_SANTANDER_RAPIDO.md
- CORRECAO_TIMEZONE_FILTROS_DATA.md
- AVALIACAO_TELA_PESSOAS.md
- PROPOSTA_DEDUPLICACAO_PESSOAS.md
- tasks/migration-intercessao.md
- _TEMPLATE_FLUXO.md
- _TEMPLATE_MODULO.md
- _TEMPLATE_PERMISSOES.md
- _TEMPLATE_SEQUENCIA.md
- APLICAR_MIGRATION_BLOCOS.sql
- _TEMPLATE_COPILOT.md (não estava no git — usado `mv` + `git add`)

---

## Passo 3 — FUNDIR (mesclar + git mv origens → _archive/_fundidos/)

### Canônico: `docs/adr/ADR-024-pix-webhook-santander.md`
Fundiu: WEBHOOK_PIX_README.md, WEBHOOK_PIX_SETUP.md, WEBHOOK_PIX_PAYLOADS.md
Conteúdo adicionado: payload Santander JSON, mapeamento de campos, URL correta, SQL de monitoramento, troubleshooting
Drift corrigido: `pix-webhook-receiver` → `pix-webhook`

### Canônico: `docs/ML_FLOW_DIAGRAM.md` (depois movido para modulos/financeiro/ofertas-contagem/)
Fundiu: ML_SUGGESTION_FLOW.md, TESTING_CHECKLIST.md
Conteúdo adicionado: sequência de runtime, snippets RLS, status de implementação, checklist de teste manual

### Canônico: `docs/plano-ux-roadmap.md`
Fundiu: PLANO_UX_MOBILE_BASE_GEMINI.md, PLANO_UX_MOBILE_RESPONSIVO.md
Conteúdo adicionado: tabela de pain points, matriz Desktop→Mobile, números diagnóstico, critérios de aceite

### Canônico: `docs/VOLUNTARIADO.md` (depois movido para modulos/voluntariado/)
Fundiu: DASHBOARD_VOLUNTARIADO.md, INTEGRACAO_VOLUNTARIO.md
Conteúdo adicionado: seção de dashboard, pipeline 5 estágios, tabelas de schema, fluxo de notificações, nota de drift

### Canônico: `docs/01-Arquitetura/04-rls-e-seguranca.MD`
Fundiu: controle-multi-tenant.md
Conteúdo adicionado: inventário de isolamento multi-tenant (19 tabelas isoladas, 8 globais, 5 funções SQL, 4 buckets)

### Novo: `docs/modulos/kids/kids.md`
Fundiu: AUTHORIZED_GUARDIANS.md, BIDIRECTIONAL_RELATIONSHIPS.md, KIDS_INCLUSION.md, NOTIFICACOES_KIDS.md

### Canônico: `docs/automacoes/catalogo-automacoes.md`
Fundiu: edge-functions.md
Conteúdo adicionado: spec completa de chatbot-triagem (endpoint, JSON, env vars)

### Canônico: `docs/automacoes/cron-buscar-pix.md`
Fundiu: crons.md
Conteúdo adicionado: inscricoes-lembretes e inscricoes-lembrete-evento

### Canônico: `docs/DOCOPS_PLAYBOOK.md`
Fundiu: COPILOT_PROMPTS.MD
Conteúdo adicionado: guard-rails gerais + regra separação Comunicação×Notificações

### Canônico: `docs/diagramas/fluxo-ensino.md`
Fundiu: fluxo-cursos-pagos.md
Conteúdo adicionado: diagrama detalhado do fluxo de pagamento de cursos

### Canônico: `docs/diagramas/fluxo-pessoas.md`
Fundiu: permissoes-pessoas.md
Conteúdo adicionado: diagrama RLS no módulo Pessoas

---

## Passo 4 — MOVER (git mv docs vivos → docs/modulos/)

| Arquivo original | Destino |
|---|---|
| `docs/memorial-sistema-cuidado.md` | `docs/modulos/cuidado/` |
| `docs/FINANCAS_RECLASSIFICACAO.md` | `docs/modulos/financeiro/core/` |
| `docs/TIMEZONE_STANDARD.md` | `docs/modulos/financeiro/core/` |
| `docs/PLANEJAMENTO_GESTAO_OFERTAS.md` | `docs/modulos/financeiro/ofertas-contagem/` |
| `docs/ML_FLOW_DIAGRAM.md` | `docs/modulos/financeiro/ofertas-contagem/` |
| `docs/operacoes/importacao-extratos.md` | `docs/modulos/financeiro/integracoes-bancarias/` |
| `docs/telas/INTEGRACOES_FINANCEIRAS.md` | `docs/modulos/financeiro/integracoes-bancarias/` |
| `docs/HOTFIX_INTEGRACAO_CRIPTOGRAFIA.md` | `docs/modulos/financeiro/integracoes-bancarias/` |
| `docs/REEMBOLSOS.md` | `docs/modulos/financeiro/reembolsos/` |
| `docs/FINANCEIRO_CONFIG_SETUP.sql` | `docs/modulos/financeiro/config/` |
| `docs/FINANCEIRO_CONFIG_SPEC.md` | `docs/modulos/financeiro/config/` |
| `docs/VOLUNTARIADO.md` | `docs/modulos/voluntariado/` |
| `docs/PROXIMOS_PASSOS_INTERCESSAO.md` | `docs/modulos/intercessao/` |
| `docs/RELOGIO_ORACAO_AVALIACAO.md` | `docs/modulos/intercessao/` |
| `docs/PLANO_BOT_AGENDA_DINAMICA.md` | `docs/modulos/intercessao/` |
| `docs/operacoes/replicacao-cadastros-filiais.md` | `docs/modulos/superadmin/` |
| `docs/planos/permissoes-contextuais-times.md` | `docs/modulos/pessoas/` |

---

## Passo 5 — STUBS criados

- `docs/modulos/projetos/README.md` — rotas apenas, sem funcionalidade inventada
- `docs/modulos/voluntariado/README.md` — com TODO: criar fluxo-voluntariado.md
- `docs/modulos/cuidado/README.md` — cross-refs, TODO: fluxo-cuidado.md
- `docs/database-schema.sql` — TODO stub prepended (regenerar de migrations)
- `docs/database-er-diagram.md` — TODO stub prepended (regenerar de migrations)

---

## Passo 6 — ÍNDICES atualizados

- `docs/README.MD` — estrutura real, links corrigidos, seções por área
- `docs/modulos/README.md` — mapa canônico dos 21 módulos (novo)
- `docs/adr/README.MD` — tabela com todos os 28 ADRs (era lista de 9)

---

## Pendências para revisão pós-merge

- [ ] `docs/database-schema.sql` e `docs/database-er-diagram.md` precisam ser regenerados das migrations
- [ ] `docs/diagramas/fluxo-voluntariado.md` — TODO em `docs/modulos/voluntariado/README.md`
- [ ] `docs/diagramas/fluxo-cuidado.md` — TODO em `docs/modulos/cuidado/README.md`
- [ ] Verificar inventário RLS em `docs/01-Arquitetura/04-rls-e-seguranca.MD` (snapshot jan/2026)
- [ ] ADR-013 — número reservado, nunca criado; considerar criar ou documentar ausência

---

## Instrução final

**Antes de mergear em main:**

```
git diff main...docs/consolidacao -- docs/
```

Revisar especialmente:
- `docs/adr/ADR-024-pix-webhook-santander.md` — conteúdo operacional adicionado
- `docs/modulos/kids/kids.md` — novo arquivo consolidado
- `docs/01-Arquitetura/04-rls-e-seguranca.MD` — inventário multi-tenant adicionado
- `docs/README.MD` — estrutura completamente reescrita
