# Próximos Passos — Módulo Intercessão

Este documento lista os próximos passos e validações pendentes após a documentação inicial do módulo de Intercessão, Oração e Testemunhos.

**Data de Criação:** 2025-03-15  
**Status:** Pendente de Validação

---

## 1. Revisar ADR-010: Redirecionamento Inteligente

**Objetivo:** Obter feedback da liderança pastoral e equipe de produto sobre a decisão de usar redirecionamento inteligente (sugestão com link) ao invés de automação completa.

**Ações:**
- [ ] Apresentar ADR-010 para pastores e coordenadores de intercessão
- [ ] Validar se sugestões visuais são suficientes ou se precisam de ajuste
- [ ] Avaliar se redirecionamento está gerando engajamento adequado (após implementação)
- [ ] Considerar A/B test: redirecionamento vs automação parcial (rascunho automático)

**Responsável:** Tecnologia + Liderança  
**Prazo:** Q2 2025  
**Referências:** 
- [`adr/ADR-010-intercessao-redirecionamento-inteligente.md`](adr/ADR-010-intercessao-redirecionamento-inteligente.md)
- Sequência de Sentimento + Redirecionamento: [`diagramas/sequencia-intercessao.md#4`](diagramas/sequencia-intercessao.md#4)

---

## 2. Validar RLS (Row Level Security)

**Objetivo:** Confirmar que todas as políticas de segurança necessárias estão implementadas corretamente no banco de dados Postgres/Supabase.

**Ações:**
- [ ] Verificar RLS em `pedidos_oracao`:
  - Membro vê apenas próprios pedidos (`membro_id = auth.uid()`)
  - Intercessor vê apenas pedidos alocados a si (`intercessor_id = auth.uid()`)
  - Admin vê todos
- [ ] Verificar RLS em `testemunhos`:
  - Autor vê próprios testemunhos (`autor_id = auth.uid()`)
  - Todos veem testemunhos com `status = 'publico'`
  - Admin vê todos
- [ ] Verificar RLS em `sentimentos_membros`:
  - Membro vê/insere apenas próprios sentimentos (`pessoa_id = auth.uid()`)
  - Admin vê todos
- [ ] Verificar RLS em `intercessores`:
  - Membros veem apenas intercessores ativos (`ativo = true`)
  - Intercessor vê próprio perfil
  - Admin gerencia todos (CRUD)
- [ ] Testar permissões com diferentes roles (membro, intercessor, admin) no ambiente de dev

**Responsável:** Tecnologia (Backend/DB)  
**Prazo:** Q1 2025  
**Referências:**
- Tabela RLS: [`diagramas/sequencia-intercessao.md#8`](diagramas/sequencia-intercessao.md#8)
- Arquitetura RLS: [`01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica`](01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica)

---

## 3. Confirmar Implementação de Realtime

**Objetivo:** Verificar se Supabase Realtime está implementado para atualizações em tempo real nas tabelas de Intercessão.

**Ações:**
- [ ] Confirmar se `pedidos_oracao` usa Realtime subscriptions:
  - Quando admin aloca pedido, intercessor recebe update automático?
  - Quando intercessor atualiza status, admin vê mudança sem refetch manual?
- [ ] Confirmar se `testemunhos` usa Realtime:
  - Quando admin aprova testemunho, aparece instantaneamente no carrossel do dashboard?
- [ ] Confirmar se `sentimentos_membros` usa Realtime:
  - Quando membro registra sentimento negativo por 3+ dias, alerta crítico aparece imediatamente no dashboard admin?
- [ ] Se Realtime NÃO está implementado:
  - Avaliar impacto de usar polling via TanStack Query (refetch a cada X segundos)
  - Considerar prioridade de implementar Realtime (UX vs esforço técnico)
- [ ] Atualizar diagramas de sequência removendo "(a confirmar)" das seções Realtime

**Responsável:** Tecnologia (Frontend)  
**Prazo:** Q1 2025  
**Referências:**
- Sequência Realtime: [`diagramas/sequencia-intercessao.md#7`](diagramas/sequencia-intercessao.md#7)
- Arquitetura Frontend: [`01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica`](01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica)

---

## 4. Implementar/Clarificar Alertas Críticos (3+ Dias Negativos)

**Objetivo:** Definir e implementar a lógica de detecção e exibição de alertas críticos para membros com sentimentos negativos consecutivos.

**Ações:**
- [ ] Definir arquitetura de alertas:
  - **Opção A:** Job nocturno (cron) que varre `sentimentos_membros` e detecta padrões
  - **Opção B:** Trigger/função em tempo real após cada INSERT em `sentimentos_membros`
  - **Opção C:** Lógica frontend que consulta últimas N entradas ao renderizar dashboard admin
- [ ] Implementar lógica de detecção:
  - Query SQL: `SELECT * FROM sentimentos_membros WHERE pessoa_id = ? ORDER BY data_registro DESC LIMIT 3`
  - Validar se 3 registros consecutivos são todos negativos (triste/ansioso/angustiado)
- [ ] Criar UI de "Alertas Críticos":
  - Card destacado no dashboard admin (`/intercessao` ou `/dashboard`)
  - Exibir: Nome do membro, telefone, email, link WhatsApp, histórico de sentimentos
  - Ações rápidas: "Enviar WhatsApp", "Ver Perfil", "Marcar como Resolvido"
- [ ] Decidir sobre notificações automáticas:
  - Admin recebe push notification ao detectar alerta crítico?
  - Email/WhatsApp automático para pastor responsável?
- [ ] Criar tabela `alertas_criticos` (opcional):
  - Se necessário persistir alertas para histórico e auditoria
  - Campos: `id`, `pessoa_id`, `tipo`, `detectado_em`, `resolvido_em`, `resolvido_por`, `observacoes`
- [ ] Atualizar diagramas e docs após implementação

**Responsável:** Tecnologia + Liderança Pastoral  
**Prazo:** Q2 2025 (prioridade média-alta)  
**Referências:**
- Sequência Alertas Críticos: [`diagramas/sequencia-intercessao.md#6`](diagramas/sequencia-intercessao.md#6)
- Fluxo Sentimentos: [`diagramas/fluxo-intercessao.md#4`](diagramas/fluxo-intercessao.md#4)
- Funcionalidades (4.4): [`funcionalidades.md#44-sentimentos`](funcionalidades.md#44-sentimentos)

---

## 5. Validar Fluxos com Usuários Reais

**Objetivo:** Testar fluxos documentados com usuários reais (membros, intercessores, admin) para validar usabilidade e clareza.

**Ações:**
- [ ] Recrutar 3-5 membros para testar:
  - Criar pedido de oração (anônimo e identificado)
  - Registrar sentimento diário
  - Enviar testemunho
- [ ] Recrutar 2-3 intercessores para testar:
  - Visualizar pedidos alocados
  - Atualizar observações
  - Marcar pedido como "em oração" ou "respondido"
- [ ] Testar com admin/secretaria:
  - Alocar pedidos (manual e automático)
  - Aprovar testemunhos
  - Monitorar alertas críticos
- [ ] Coletar feedback:
  - Fluxos estão claros?
  - UI é intuitiva?
  - Redirecionamento inteligente é percebido e utilizado?
  - Alguma confusão sobre status ou ações?
- [ ] Ajustar documentação e interface conforme feedback

**Responsável:** UX + Tecnologia + Intercessão  
**Prazo:** Q2 2025 (após implementação inicial)  
**Referências:**
- Manual do Usuário: [`manual-usuario.md#6-intercessão`](manual-usuario.md#6-intercessão)
- Fluxos Mermaid: [`diagramas/fluxo-intercessao.md`](diagramas/fluxo-intercessao.md)

---

## 6. Implementar Analytics e Métricas

**Objetivo:** Coletar dados para otimizar fluxos e avaliar efetividade do módulo.

**Ações:**
- [ ] Definir métricas-chave (KPIs):
  - % de membros que clicam em redirecionamento inteligente (sentimento → pedido/testemunho)
  - Tempo médio entre registro de sentimento negativo e criação de pedido
  - Taxa de pedidos respondidos vs arquivados
  - Taxa de testemunhos aprovados vs arquivados
  - % de intercessores com carga próxima ao limite máximo
  - Frequência de alertas críticos (3+ dias negativos) detectados
- [ ] Implementar tracking:
  - Event tracking: "sentimento_registrado", "redirecionamento_clicado", "pedido_criado", "testemunho_enviado", etc.
  - Ferramentas: Google Analytics, Mixpanel, ou tabela customizada de eventos
- [ ] Criar dashboard de métricas:
  - Para admin/liderança visualizar engajamento do módulo
  - Alertas de tendências (ex: aumento de sentimentos negativos)
- [ ] Revisar métricas trimestralmente para ajustes

**Responsável:** Tecnologia + Liderança  
**Prazo:** Q3 2025  
**Referências:**
- ADR-010 (seção "Consequências"): [`adr/ADR-010-intercessao-redirecionamento-inteligente.md`](adr/ADR-010-intercessao-redirecionamento-inteligente.md)

---

## 7. Criar PR e Mergear Documentação

**Objetivo:** Integrar documentação da branch `docs/oracao-intercessao-testemunho` à branch principal (`main`).

**Ações:**
- [x] Branch criada: `docs/oracao-intercessao-testemunho`
- [x] Commit feito: 10 arquivos modificados, 4 novos
- [x] Push realizado: ✓ Sucesso
- [ ] Criar Pull Request no GitHub:
  - URL: https://github.com/adrianoapc/igreja-carvalho/pull/new/docs/oracao-intercessao-testemunho
  - Título: `docs(intercessão): documentação completa do módulo Oração/Intercessão/Testemunho`
  - Descrição: Resumo dos 7 passos (Discovery, Escopo, Docs Textuais, Diagramas, ADR, README, Commit)
- [ ] Revisar PR:
  - Verificar links quebrados
  - Validar formatação Markdown
  - Confirmar que diagramas Mermaid renderizam corretamente
- [ ] Mergear para `main` após aprovação
- [ ] Deletar branch `docs/oracao-intercessao-testemunho` após merge

**Responsável:** Tecnologia  
**Prazo:** Imediato  
**Status:** ✅ Push concluído, aguardando criação de PR

---

## 8. Documentar Enums e Tipos (Opcional)

**Objetivo:** Clarificar enums usados no módulo para facilitar manutenção futura.

**Ações:**
- [ ] Confirmar enums existentes no schema:
  - `tipo_pedido`: saúde, família, financeiro, trabalho, espiritual, outro
  - `status_pedido`: pendente, alocado, em_oracao, respondido, arquivado
  - `categoria_testemunho`: espiritual, casamento, família, saúde, trabalho, financeiro, ministerial, outro
  - `status_testemunho`: aberto, publico, arquivado
  - `sentimento`: feliz, triste, ansioso, grato, abençoado, angustiado
- [ ] Adicionar seção "Enums" em `database-er-diagram.md`:
  - Tabela com enum name, valores permitidos, uso (em qual tabela)
- [ ] Atualizar `funcionalidades.md` para referenciar enums explicitamente

**Responsável:** Tecnologia (Documentação)  
**Prazo:** Q2 2025 (baixa prioridade)  
**Referências:**
- ER Diagram: [`database-er-diagram.md#intercessão-oração-e-testemunhos--entidades-e-relações`](database-er-diagram.md#intercessão-oração-e-testemunhos--entidades-e-relações)

---

## 9. Integração com Módulo de Notificações

**Objetivo:** Garantir que eventos do módulo de Intercessão disparem notificações automáticas conforme configurado.

**Ações:**
- [ ] Mapear eventos do domínio de Intercessão:
  - `novo_pedido_oracao`: Dispara notificação para intercessores/admin
  - `pedido_alocado`: Notifica intercessor específico
  - `pedido_respondido`: Notifica membro solicitante (opcional)
  - `testemunho_enviado`: Notifica admin/secretaria para aprovação
  - `testemunho_aprovado`: Notifica autor (opcional)
  - `alerta_critico_detectado`: Notifica pastores/liderança
- [ ] Configurar regras em `notificacao_regras`:
  - Definir destinatários por role (admin, intercessor, pastor)
  - Definir canais ativos (in-app, push, WhatsApp)
- [ ] Testar disparos automáticos em ambiente de dev
- [ ] Atualizar ADR-008 (Eventos de Domínio) com eventos de Intercessão

**Responsável:** Tecnologia  
**Prazo:** Q2 2025  
**Referências:**
- ADR-006 (Separação Comunicação e Notificações): [`adr/ADR-006-separacao-comunicacao-notificacoes.md`](adr/ADR-006-separacao-comunicacao-notificacoes.md)
- ADR-008 (Eventos de Domínio): [`adr/ADR-008-eventos-dominio.md`](adr/ADR-008-eventos-dominio.md)

---

## 10. Revisar Documentação Periodicamente

**Objetivo:** Manter documentação atualizada conforme módulo evolui.

**Ações:**
- [ ] Estabelecer cadência de revisão (trimestral ou semestral)
- [ ] Atualizar diagramas quando novos fluxos forem adicionados
- [ ] Revisar ADR-010 após coleta de métricas (6 meses pós-lançamento)
- [ ] Adicionar novas decisões arquiteturais em ADRs separados se necessário
- [ ] Remover marcadores "(a confirmar)" após validações

**Responsável:** Tecnologia + Documentação  
**Prazo:** Contínuo (revisar em Jun/2025, Dez/2025)  

---

## Priorização Sugerida

| Item | Prioridade | Prazo | Impacto |
|------|------------|-------|---------|
| 7. Criar PR e Mergear | 🔴 Alta | Imediato | Documentação disponível para toda equipe |
| 2. Validar RLS | 🔴 Alta | Q1 2025 | Segurança crítica |
| 4. Implementar Alertas Críticos | 🟡 Média-Alta | Q2 2025 | Cuidado pastoral proativo |
| 3. Confirmar Realtime | 🟡 Média | Q1 2025 | UX em tempo real |
| 1. Revisar ADR-010 | 🟡 Média | Q2 2025 | Validação de produto |
| 5. Validar com Usuários | 🟡 Média | Q2 2025 | UX e usabilidade |
| 9. Integração Notificações | 🟡 Média | Q2 2025 | Automação de comunicação |
| 6. Implementar Analytics | 🟢 Baixa | Q3 2025 | Otimização futura |
| 8. Documentar Enums | 🟢 Baixa | Q2 2025 | Manutenibilidade |
| 10. Revisar Documentação | 🟢 Baixa | Contínuo | Manutenção |

---

**Última Atualização:** 2025-03-15  
**Responsável pela Revisão:** Tecnologia + Liderança  
**Contato:** [Adicionar contato do responsável técnico]
