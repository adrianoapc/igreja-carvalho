# Avaliação — Relógio de Oração (Modelo Híbrido + Campanhas)

## 1) Contexto atual (base do módulo)
O módulo de intercessão hoje está organizado em:
- **Dashboard de Intercessão** com atalhos e métricas (pendentes/em oração, intercessores, testemunhos) em `src/pages/Intercessao.tsx`.
- **Pedidos de Oração** com status `pendente`, `em_oracao`, `respondido`, `arquivado`, alocação automática e gestão de intercessor em `src/pages/intercessao/PedidosOracao.tsx`.
- **Sentimentos** com dashboards, alertas críticos e vínculo indireto com orações/testemunhos em `src/pages/intercessao/Sentimentos.tsx` (e fluxo de registro via `RegistrarSentimentoDialog`).
- **Testemunhos** com fluxo de criação, status e publicação em `src/pages/intercessao/Testemunhos.tsx`.
- **Tipos/tabelas** em `src/integrations/supabase/types.ts` (tabelas `pedidos_oracao`, `intercessores`, `sentimentos_membros`, `testemunhos`, enums de status).

**Oportunidade:** o “Relógio de Oração” pode criar um fluxo contínuo de intercessão (por horários) conectado aos pedidos de oração e aos sentimentos/testemunhos.

---

## 2) Objetivo funcional do “Relógio de Oração”
O **Relógio de Oração** deve funcionar como um “fluxo contínuo” de intercessão, alinhado com o que já existe em **Pedidos**, **Sentimentos** e **Testemunhos**:

- **Propósito principal**: garantir que sempre haja pessoas orando ativamente por pedidos da igreja (principalmente os `pendente` e `em_oracao`), oferecendo um ritmo e cobertura organizada.
- **Integração natural** com o módulo atual:
  - **Pedidos de oração** já têm status e intercessores; o relógio pode agir como um **“motor de ritmo”**, direcionando pedidos em blocos de tempo (slot) ao invés de apenas alocar pedidos de forma pontual.
  - **Sentimentos** já estimulam pedidos e testemunhos (fluxo do `RegistrarSentimentoDialog`). O relógio pode virar uma **ferramenta de acompanhamento**: sentimentos críticos geram slots específicos de oração, com foco na pessoa/tema.
  - **Testemunhos** podem ser promovidos como “retorno” do relógio após slots concluídos: ao marcar que orou, o usuário pode ser direcionado a registrar o testemunho.

**Resultado esperado**: a funcionalidade cria uma **cadência** para a equipe de intercessão, reduzindo a fila de pedidos e estimulando respostas/testemunhos.

---

## 3) Variações de produto e escolha do modelo

### 3.1) Relógio 24/7 com autoalocação
- Slots fixos de 30/60 minutos automaticamente distribuídos ao longo do dia.
- Alocação baseada em disponibilidade e carga (similar à alocação atual de pedidos).
- Ideal para igrejas maiores com equipe ativa e disponibilidade contínua.

**Ponto forte:** cobertura total.  
**Ponto de atenção:** exige base sólida de voluntários.

### 3.2) Relógio “Campanha” (temático e sazonal)
- Períodos limitados (ex.: “21 dias de oração pela família”).
- Tema/versículo por dia.
- Métricas e testemunhos agregados ao final da campanha.

**Ponto forte:** engajamento focado.  
**Ponto de atenção:** menos contínuo, depende de ciclos.

### 3.3) Relógio híbrido (auto + manual)
- Slots criados automaticamente, mas com **escolha manual** de horários.
- Líderes podem abrir horários especiais.
- Permite adoção gradual.

**Ponto forte:** flexibilidade.  
**Ponto de atenção:** exige boa UX.

### 3.4) Modelo recomendado: **Híbrido + Campanhas**
- O **Híbrido** é a base operacional contínua.
- **Campanhas** são ativadas quando necessário e “marcam” slots com temas e objetivos.
- Isso equilibra **cobertura constante** e **momentos de mobilização**.

---

## 4) Integração com módulos existentes

### 4.1) Com Pedidos de Oração
- Pedidos `pendente`/`em_oracao` alimentam slots automaticamente.
- O slot pode carregar 1–3 pedidos prioritários.
- Intercessor registra “orou”, fechando ciclo de acompanhamento.

### 4.2) Com Sentimentos
- Sentimentos críticos recorrentes disparam slots de apoio.
- O slot de campanha pode destacar a necessidade (sem expor dados sensíveis).
- Ajuda a resposta rápida pastoral.

### 4.3) Com Testemunhos
- Ao concluir um slot, o sistema sugere registrar testemunho.
- Testemunho pode ser vinculado a pedidos e campanhas.
- Fecha o ciclo “pedido → oração → resposta → testemunho”.

---

## 5) Dados e modelo sugerido (alto nível)
O modelo precisa suportar **dois eixos**:
1) **Slots contínuos** (operação normal).  
2) **Campanhas** que “marcam” um conjunto de slots com tema/destaque.

**Tabelas conceituais:**
- `relogio_oracao_slots`
  - `id`, `inicio`, `fim`, `status`, `tema`
  - vínculos opcionais: `pedido_oracao_id`, `sentimento_id`, `campanha_id`
  - `tipo_slot` (normal/campanha) e `fonte_prioridade` (pedido/sentimento/manual)
- `relogio_oracao_participantes`
  - `id`, `slot_id`, `pessoa_id`, `status` (confirmado/orou/ausente)
  - `checkin_at`, `feedback`
- `relogio_oracao_campanhas`
  - `id`, `nome`, `descricao`, `inicio`, `fim`, `tema_padrao`, `ativo`

---

## 6) UX/UI sugerida
A interface precisa explicitar **modo normal** e **modo campanha**:

- Nova rota: `/intercessao/relogio`.
- Card no dashboard de intercessão.
- **Abas:**
  - **Normal:** slots contínuos + botão “Assumir Slot”.
  - **Campanhas:** lista de campanhas ativas + slots vinculados ao tema.
- Filtros: Disponível / Ocupado / Concluído / Campanha.
- Detalhe do slot: pedidos vinculados, sentimento crítico (se houver), status e participantes.

---

## 7) Notificações e automações
Campanhas demandam comunicação extra (tema do dia, lembrete específico).

- Notificar participantes **antes do slot**, com título do tema (se campanha).
- Notificação pós-slot para **check-in** e **feedback**.
- Slots de campanha podem incluir “tema do dia”.
- Alerta para líderes quando slots de campanha ficarem vazios.
- Registrar métricas de entrega/abertura.

---

## 8) Métricas e dashboards
Além de métricas gerais, campanhas precisam de indicadores próprios:

- KPIs: taxa de ocupação, check-in, orações concluídas e pedidos impactados.
- KPIs de campanha: slots preenchidos, participação única, evolução diária.
- Comparação **Normal vs Campanha** no dashboard.
- Exportação segmentada por campanha.

---

## 9) Governança e privacidade
- Definir quem pode ver detalhes de pedidos (admin/intercessor/lider).
- Em campanha, decidir se pedidos vinculados ficam anonimizados.
- Definir política de “tema público” vs “pedido privado”.
- Auditoria para alocações manuais e mudanças em slots.

---

## 9.1) Escalas e voluntariado (viabilidade de extensão)
**Contexto atual de escalas/voluntariado:**
- O sistema já possui um módulo completo de **escalas de voluntários** ligado a cultos e times ministeriais, com fluxo de confirmação/recusa, lembretes e métricas (`escalas_culto`, `times_culto`, `membros_time`).
- Há telas dedicadas para **gestão de escalas** e **minhas escalas** (`/escalas` e `/minhas-escalas`), além de widgets e notificações automatizadas.
- Existe suporte documentado para **Intercessão como time ministerial**, com a possibilidade de escalar intercessores para cultos específicos (ver ADR sobre evolução do ministério de intercessão).

**Avaliação do comportamento de escalas:**
- **Confirmação/recusa**: o voluntário aceita/recusa a escala, gerando status de confirmação e possíveis avisos (padrão já aplicado em `escalas_culto`).
- **Notificações automáticas**: há função agendada para lembrar escalas pendentes e notificações manuais (fluxos já existentes em docs/diagramas e funções de escalas).
- **Conflitos de agenda**: há verificação de conflito para voluntários já escalados em outro time no mesmo culto.
- **RLS e governança**: políticas permitem leitura por membros e atualização da própria escala; admin/liderança gerenciam o todo.

**Vale a pena estender para o Relógio de Oração?**
- **Sim, para aproveitar o modelo de voluntariado já existente** (escala/confirmacao/notificacoes), reduzindo retrabalho e mantendo coerência de governança.
- O relógio pode ser modelado como **um novo tipo de escala** (não necessariamente ligado a culto), reutilizando: confirmação, recusa, check-in e notificações.
- **Risco:** o módulo de escalas está orientado a **culto/evento**; o relógio é contínuo e pode exigir campos adicionais (slots recorrentes, campanhas, temas). Isso sugere **estender** o modelo existente com tabelas específicas ou criar uma camada paralela reaproveitando fluxos (notificações e confirmação).

**Validação de suporte atual para voluntários no relógio:**
- Já existe base de voluntariado via `times_culto` + `membros_time` + `escalas_culto`.
- Intercessores já são vinculados ao time “Intercessão” e podem ser escalados para cultos (documentação técnica e ADR). 
- Portanto, há **suporte conceitual e de infraestrutura** para voluntários no relógio — o ponto é decidir entre **reuso direto** das escalas ou **criação de um módulo específico** que reusa fluxos e notificações.

---

## 10) Critérios de sucesso
- Redução da fila de pedidos `pendente`.
- Meta de ocupação de slots (ex.: 70% em 30 dias).
- Meta de check-in (ex.: 60% dos slots concluídos).
- Meta de participação em campanhas (ex.: crescimento de intercessores ativos).
- Relatório pós-campanha com impacto e testemunhos gerados.

---

## 11) Plano de implementação (stubs para discussão)

### 11.1) Definir regras de negócio do Relógio
:::task-stub{title="Definir regras de negócio do Relógio de Oração"}
1. Mapear regras de criação de slots (duração padrão, janelas de horário, dias válidos).
2. Definir se haverá campanhas de oração (`relogio_oracao_campanhas`) e como elas afetam os slots.
3. Especificar regras de elegibilidade do participante (ex.: roles `intercessor` e `lider`).
4. Documentar estados do slot (disponível/ocupado/concluído/cancelado).
:::

### 11.2) Modelar dados no Supabase
:::task-stub{title="Modelar tabelas do Relógio de Oração no Supabase"}
1. Definir tabelas (`relogio_oracao_slots`, `relogio_oracao_participantes`, opcional `relogio_oracao_campanhas`).
2. Adicionar foreign keys para `pedidos_oracao`, `sentimentos_membros`, `profiles`.
3. Garantir enums de status compatíveis em `src/integrations/supabase/types.ts`.
4. Criar índices para `inicio`, `fim`, `status`.
:::

### 11.3) Fluxo de geração e alocação de slots
:::task-stub{title="Implementar lógica de geração e alocação de slots"}
1. Criar função (RPC) para gerar slots automaticamente em lote.
2. Criar função (RPC) de alocação balanceada (semelhante à `alocar_pedido_balanceado`).
3. Definir fallback quando não houver participantes disponíveis.
:::

### 11.4) Interface do Relógio
:::task-stub{title="Adicionar página e componentes do Relógio de Oração"}
1. Criar rota `/intercessao/relogio` e card no dashboard de `src/pages/Intercessao.tsx`.
2. Implementar lista/timeline de slots e status (disponível/ocupado/concluído).
3. Adicionar botão “Assumir Slot” e “Check-in”.
4. Exibir pedidos/temas associados ao slot (link para pedidos e testemunhos).
:::

### 11.5) Notificações e follow-up
:::task-stub{title="Automatizar notificações e check-in"}
1. Integrar com o sistema de notificações existente.
2. Criar lembretes antes do início do slot.
3. Criar notificação pós-slot para feedback/testemunho.
:::

### 11.6) Métricas e dashboards
:::task-stub{title="Adicionar métricas do Relógio de Oração"}
1. Criar KPIs: slots ocupados, taxa de check-in, orações respondidas.
2. Integrar métricas no dashboard de intercessão.
3. Exportar dados segmentados (normal e por campanha).
:::
