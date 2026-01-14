# Planejamento Técnico: Gestão de Dízimos e Ofertas (Fluxo Híbrido)

**Status:** Aprovado para Desenvolvimento  
**Data:** 12/01/2026  
**Contexto:** Evolução do módulo financeiro para suportar conferência de cultos, integração bancária e gestão de membros (Dízimos).

---

## 1. O Conceito: Tesouraria Híbrida Inteligente

O sistema deixará de focar apenas em "lançamentos avulsos" para adotar o conceito de **"Sessão de Contagem" (Batch Processing)**. O objetivo é atender simultaneamente:

1.  **Igrejas Pequenas/Manuais:** Que contam dinheiro físico e digitam tudo.
2.  **Igrejas Grandes/Digitais:** Que usam Pix/Gateway e precisam apenas auditar/conciliar.
3.  **Privacidade vs. Controle:** Permitir tanto a "Oferta Solta" (Bacia anônima) quanto o "Dízimo Identificado" (Envelope/Pix CPF).

---

## 2. Arquitetura de Interface (UX/UI)

Decisão: Implementar um **Wizard de 4 Passos** para reduzir a carga cognitiva do tesoureiro.

### Passo 1: Abertura (Setup)

- **Campos:** Data do Culto, Período (Manhã/Noite), Conferentes (Testemunhas).
- **Objetivo:** Criar o contexto do "Lote" financeiro.

### Passo 2: O Cofre (Dinheiro & Cheques)

- **Foco:** Alta velocidade de digitação (Mouse-free operation).
- **Componente:** Grid Editável.
- **Colunas:**
  - `Membro` (Autocomplete - **Novo Gap**): Busca por nome. Se vazio = "Oferta Solta".
  - `Tipo`: Dízimo / Oferta / Missões.
  - `Valor`: R$.
- **Lógica:** Ao dar `Enter`, cria nova linha. Tesoureiro digita envelopes nominais um a um. O restante do dinheiro solto é somado e lançado numa linha única sem membro.

### Passo 3: O Digital (Pix & Cartão)

- **Foco:** Conciliação e Identificação.
- **Barra de Ações:**
  - `[ 🔄 Sincronizar API ]`: (Se configurado) Busca extrato bancário das últimas horas.
  - `[ ➕ Adicionar Manual ]`: Para igrejas sem API ou falha na integração.
- **Componente:** Grid Híbrida.
  - **Linhas da API:** Valor **Bloqueado** (Read-only). Campo "Membro" editável para vincular Pix sem CPF.
  - **Linhas Manuais:** Totalmente editáveis (Ex: Lançar um total de Pix do dia manualmente).

### Passo 4: Fechamento & Resumo

- **Visualização:**
  - Total Físico (Passo 2).
  - Total Digital (Passo 3).
  - **Total Geral do Culto.**
- **Gráfico Miniatura:** Dízimos vs. Ofertas.
- **Ação Final:** Botão "Encerrar e Lançar". Grava no banco e gera recibos (internos).

---

## 3. Arquitetura de Dados (Database)

**Decisão:** Manter **Tabela Única** (`transacoes`). Não criar tabelas separadas para ofertas ou detalhes.

### Estrutura Lógica do Registro

Cada linha do grid (seja um envelope de R$ 50 ou um Pix de R$ 500) será **uma linha na tabela `transacoes`**.

| Campo                | Valor Exemplo                 | Observação                                 |
| :------------------- | :---------------------------- | :----------------------------------------- |
| `id`                 | `uuid-123...`                 | PK                                         |
| `data_transacao`     | `2026-01-12`                  | Data do Culto                              |
| `descricao`          | "Dízimo - Culto Noite"        | Gerado automático                          |
| `valor`              | `100.00`                      | Valor individual ou agrupado               |
| `tipo_operacao`      | `receita`                     | Fixo                                       |
| `forma_pagamento_id` | `id_especie` / `id_pix`       | Mapeado da tela                            |
| `conta_id`           | `id_cofre` / `id_banco`       | Mapeado da forma                           |
| **`pessoa_id`**      | **`uuid-joao`** ou **`NULL`** | **CRÍTICO (GAP)**: Vincula ao membro.      |
| `lote_id`            | `uuid-sessao-contagem`        | Vincula todas as linhas a este fechamento. |
| `origem_registro`    | `'manual'` ou `'api'`         | Para saber se veio do banco ou digitado.   |

---

## 4. Regras de Negócio (Decisões Finais)

1.  **Oferta Solta (Privacidade):**

    - Se o usuário não selecionar um membro na grid, o sistema grava `pessoa_id = NULL`.
    - Isso garante o caixa correto sem violar privacidade.

2.  **Lançamento em Bloco (Sem API):**

    - Se a igreja não tem integração bancária, o tesoureiro pode lançar **UMA linha única** no Passo 3 com o valor total do Pix do dia (Ex: R$ 1.500,00 - Anônimo).
    - Consequência: O caixa bate, mas perde-se o histórico individual do membro. A igreja decide como usar.

3.  **Conciliação:**
    - Pix vindos da API já nascem com status `conciliado`.
    - Dinheiro físico nasce `pendente` até o tesoureiro confirmar o depósito (fluxo posterior).

---

## 5. Levantamento de Gaps (Realidade Atual vs. Objetivo)

Após aferição do código atual (12/01/2026), identificou-se o que falta para esta solução funcionar:

### 🔴 Crítico (Bloqueante)

1.  **Backend (`transacoes`):** A tabela não possui a coluna `pessoa_id`.
    - _Ação:_ Criar Migration `ALTER TABLE transacoes ADD COLUMN pessoa_id UUID REFERENCES pessoas(id)`.
2.  **Frontend (`RelatorioOferta.tsx`):** O componente atual de Grid não possui o seletor de pessoas.
    - _Ação:_ Implementar `Combobox/Autocomplete` na célula da grid conectada à tabela de `pessoas`.

### 🟡 Importante (UX)

1.  **Componentização:** Refatorar `RelatorioOferta.tsx` para usar a estrutura de **Tabs/Wizard** (separar Físico de Digital) para evitar erros de digitação.
2.  **Botão Dummy API:** Criar o botão de "Simular API" no frontend para preparar o terreno da integração futura.

---

## 6. Próximos Passos (Desenvolvimento)

1.  [Backend] Criar a migration para adicionar `pessoa_id` e `origem_registro` em `transacoes`.
2.  [Frontend] Refatorar `RelatorioOferta` transformando em Wizard.
3.  [Frontend] Adicionar coluna de Membro (Autocomplete) na Grid de Lançamento.
4.  [Frontend] Implementar a lógica de "Linha Read-only" para a aba Digital.

---

## 6.1 Estado da Implementação — 2026-01-13

- [x] Físico: Select de Tipo lista todas as categorias habilitadas; seleção única; grava `tipo` + `categoria_id` por linha.
- [x] Físico/Digital: Máscara de moeda pt-BR (formato "0,00"), aceitando apenas dígitos, aplicada aos inputs de Valor.
- [x] Digital: "Categoria" por linha com Select e persistência (`categoria_id`); default conforme `financeiro_config`; linhas de API são somente leitura.
- [x] Backend: `pessoa_id` e `origem_registro` adicionados e indexados em `transacoes_financeiras`; policies RLS multi-tenant confirmadas.
- [ ] Salvamento parcial (rascunho) antes do "Encerrar e Lançar".
- [ ] Integração digital real com provedores e reconciliação (pareamento/estados).
- [ ] Conferência cega completa (tolerâncias, recontagem, aprovação e laudo).

## 7. Conferência Cega (Parametrizável)

### 7.1 Objetivo

- Garantir integridade na contagem física (dinheiro/cheques) por meio de duas (ou mais) contagens independentes, sem influência visual entre contadores. O sistema só revela os totais após todas as contagens obrigatórias serem submetidas.

### 7.2 Modos de Operação

- `off`: desabilitado (fluxo atual, sem conferência cega).
- `optional`: habilitado, mas não obrigatório; pode ser pulado por permissão ou escolha do responsável.
- `required`: obrigatório; impede fechamento do lote sem pelo menos N contagens válidas.

### 7.3 Escopo de Configuração

- Nível: por igreja e opcionalmente por filial (override). Snapshot dos parâmetros é gravado no lote no momento da abertura para evitar mudança retroativa.
- Parâmetros sugeridos:
  - `blind_count_mode`: `off | optional | required` (default: `optional`).
  - `blind_min_counters`: inteiro (default: 2).
  - `blind_tolerance_value`: número (ex.: `0.00` = match exato; `5.00` = tolerância em reais).
  - `blind_compare_level`: `total | tipo` (se `tipo`, compara por Dízimo/Oferta/Missões).
  - `blind_lock_totals`: boolean (default: `true`) — oculta totais parciais até a última contagem.

### 7.4 Modelo de Dados (Proposta)

- `financeiro_config` (nova): guarda parâmetros por igreja/filial.
  - `igreja_id`, `filial_id` (nullable), `blind_count_mode`, `blind_min_counters`, `blind_tolerance_value`, `blind_compare_level`, `blind_lock_totals`, `updated_at`.
- `sessoes_contagem` (nova): metadados do lote/sessão de contagem física.
  - `id`, `igreja_id`, `filial_id`, `data_culto`, `periodo`, `status` (`aberto | aguardando_conferencia | divergente | validado | cancelado`),
    snapshot de parâmetros (`blind_count_mode`, `blind_min_counters`, `blind_tolerance_value`, `blind_compare_level`, `blind_lock_totals`),
    `conferentes` (jsonb com lista de usuários), `created_by`, `approved_by`, `approved_at`, `variance_value` (numérico), `variance_by_tipo` (jsonb), timestamps.
- `contagens` (nova): submissões individuais de contagem física.
  - `id`, `sessao_id`, `contador_id`, `ordem` (1, 2, ...),
    `total` (numérico), `totais_por_tipo` (jsonb: `{ dizimo, oferta, missoes }`), `submitted_at`.

Observação: `transacoes` continua recebendo as linhas do Wizard. As tabelas de contagem **não substituem** `transacoes`; elas auditam o processo de conferência física.

### 7.5 Fluxo (UX) no Wizard

1. Passo 1 (Abertura): Se `blind_count_mode != off`, selecionar conferentes e abrir sessão (`sessoes_contagem`).
2. Passo 2 (O Cofre):
   - Para cada conferente:
     - Abre "Contagem #N" em grid própria (atalhos de teclado, sem ver totais de outros).
     - Ao finalizar, botão "Enviar contagem" bloqueia edição da contagem enviada.
   - Enquanto `blind_lock_totals = true` e faltarem contagens obrigatórias, ninguém vê o total consolidado.
3. Confronto automático:
   - Se `blind_compare_level = total`: compara somatório geral.
   - Se `tipo`: compara cada categoria (Dízimo/Oferta/Missões).
   - Se `|delta| <= blind_tolerance_value` para todos os critérios → `status = validado`.
   - Caso contrário → `status = divergente`; opções: "Recontar" (abrir Contagem #3) ou "Ajustar" (retornar à grid com supervisão).
4. Passo 4 (Fechamento): exibe laudo de conferência, diferença e quem aprovou.

Permissões sugeridas:

- `Tesouraria.Conferente`: pode criar/enviar sua contagem, vê apenas seus próprios totais até a conclusão.
- `Tesouraria.Supervisor`: pode ver confronto, aprovar, solicitar recontagem e realizar ajuste assistido.

### 7.6 Segurança e Auditoria (RLS)

- Políticas Postgres por `igreja_id/filial_id` e por `contador_id` em `contagens`.
- Enquanto a sessão não for concluída e `blind_lock_totals = true`, políticas retornam `NULL` para campos de total de outros contadores.
- Snapshot de parâmetros no lote garante imutabilidade do critério usado.

### 7.7 Algoritmo de Conciliação (pseudocódigo)

```
if blind_compare_level == 'total':
    delta = abs(sum(contagens.total) - referencia)
    ok = delta <= blind_tolerance_value
else:
    ok = true
    for tipo in ['dizimo','oferta','missoes']:
        delta_tipo = abs(sum(c.totais_por_tipo[tipo]) - referencia_por_tipo[tipo])
        ok = ok and (delta_tipo <= blind_tolerance_value)

status = 'validado' if ok else 'divergente'
```

Referências podem ser: contagem 1 vs contagem 2, ou média das contagens. Em `required`, exigir mínimo `N` contagens e aplicar a mesma regra contra a mediana/média.

### 7.8 Migrações (esboço)

```sql
-- 1) Configuração por igreja/filial
create table if not exists financeiro_config (
    id uuid primary key default gen_random_uuid(),
    igreja_id uuid not null,
    filial_id uuid null,
    blind_count_mode text not null default 'optional',
    blind_min_counters int not null default 2,
    blind_tolerance_value numeric(12,2) not null default 0,
    blind_compare_level text not null default 'total',
    blind_lock_totals boolean not null default true,
    updated_at timestamp with time zone not null default now()
);

-- 2) Sessões de contagem
create table if not exists sessoes_contagem (
    id uuid primary key default gen_random_uuid(),
    igreja_id uuid not null,
    filial_id uuid null,
    data_culto date not null,
    periodo text not null,
    status text not null default 'aberto',
    blind_count_mode text not null,
    blind_min_counters int not null,
    blind_tolerance_value numeric(12,2) not null,
    blind_compare_level text not null,
    blind_lock_totals boolean not null,
    conferentes jsonb not null default '[]',
    created_by uuid not null,
    approved_by uuid null,
    approved_at timestamptz null,
    variance_value numeric(12,2) null,
    variance_by_tipo jsonb null,
    created_at timestamptz not null default now()
);

-- 3) Contagens individuais
create table if not exists contagens (
    id uuid primary key default gen_random_uuid(),
    sessao_id uuid not null references sessoes_contagem(id) on delete cascade,
    contador_id uuid not null,
    ordem smallint not null,
    total numeric(12,2) not null,
    totais_por_tipo jsonb not null default '{"dizimo":0,"oferta":0,"missoes":0}',
    submitted_at timestamptz not null default now()
);
```

### 7.9 Alterações no Frontend

- Passo 1: incluir seleção de conferentes e indicação do modo ativo (exibe selo `Cega: on/off/required`).
- Passo 2: isolar a grid por conferente, com CTA "Enviar contagem". Mostrar chip de progresso (1/2, 2/2...).
- Tela de Confronto: modal com deltas por totais e por tipo (se aplicável), ações de Aprovar / Recontar.
- Logs: registrar no toast e notificação da equipe de tesouraria quando contagens forem submetidas ou divergirem.

### 7.10 Critérios de Aceite

- [ ] Parâmetros por igreja/filial impactam novas sessões (snapshot no lote).
- [ ] Modo `required` bloqueia fechamento sem N contagens válidas.
- [ ] Totais ficam ocultos até todas as contagens obrigatórias serem submetidas quando `blind_lock_totals = true`.
- [ ] Divergências acima da tolerância movem sessão para `divergente` e exigem ação do supervisor.
- [ ] Auditoria registra quem contou, quem aprovou e deltas finais.

---

## 8. Integrações e Segredos (Webhooks + pgcrypto)

### 8.1 Infra já existente (reuso)

- Tabela `webhooks` com criptografia via `pgcrypto`:
  - `secret_encrypted BYTEA` (seguro), `secret_hint` (últimos 4 chars), `secret` legado (limpo automaticamente pelas RPCs).
  - `igreja_id` e `filial_id` para multi-tenant/multi-filial, `tipo` (ex.: `whatsapp_meta`, `pix_banco_x`, `gateway_y`), `url`, `enabled`.
- RPCs de segurança:
  - `set_webhook_secret(plaintext, key)` → armazena criptografado e mascara o legado.
  - `get_webhook_secret(key)` → descriptografa para uso exclusivo em Edge Functions (Security Definer).
- View `webhooks_safe`: nunca expõe o segredo; retorna máscara + `secret_hint` para UI/admin.
- Helpers em Edge Functions (`supabase/functions/_shared/secrets.ts`):
  - `getWebhookSecret`, `getWebhookConfig`, `getActiveWhatsAppProvider` (padrão de descoberta/ativação por `tipo` e `enabled`).

Conclusão: não criaremos nova tabela de segredos; reutilizaremos `webhooks` + RPCs + view segura.

### 8.2 Parâmetros Financeiros por Filial (feature flags)

- Tabela `financeiro_config` (igreja/filial) armazena parâmetros não sensíveis e comportamento:
  - `integracao_pix_enabled`, `integracao_gateway_enabled`, `integracao_banco_enabled`.
  - `sync_strategy` (`webhook|polling`), `conciliacao_janela_horas`.
  - `blind_*` (seção 7) e, opcionalmente, pequenos mapeamentos funcionais (ex.: `mapping_default_conta_por_forma`).
- Precedência: Filial → Igreja → Defaults. Snapshot dos parâmetros é gravado na `sessao_contagem` na abertura.

### 8.3 Descoberta do provedor por Filial

- Passos no backend/Edge Function:
  1. Ler `financeiro_config` efetiva (com precedência) para saber se integração está habilitada e qual `sync_strategy`.
  2. Consultar `webhooks_safe/webhooks` para encontrar o provedor ativo por `tipo` (ex.: `pix_banco_x`) e `enabled=true` na mesma `igreja_id/filial_id`.
  3. Obter segredo via `get_webhook_secret` no ambiente seguro da Edge Function.
  4. Sincronizar extrato/detalhes e retornar ao app linhas “API/read-only”.
- Snapshot da sessão (`sessoes_contagem`) deve guardar: `provider_tipo`, `sync_strategy`, `webhook_url` (sem segredo) e `secret_hint`.

### 8.4 Fluxo Digital (Passo 3) com Integração

1. Usuário abre a sessão (se cega: com conferentes). Snapshot salva parâmetros e provedor.
2. CTA “Sincronizar API” chama Edge Function; esta resolve provedor e segredo, busca últimas transações (janela configurada) e devolve linhas marcadas como `origem_registro='api'` e `status='conciliado'` (se aplicável).
3. Linhas manuais continuam possíveis e são `origem_registro='manual'`.
4. Antes do fechamento, aplicar mapeamento `forma_pagamento_contas` por filial para definir `conta_id` de cada canal/forma.
5. Fechamento só materializa em `transacoes_financeiras` após sessão validada (conferência cega, se ativa).

### 8.5 Segurança, Auditoria e RLS

- Frontend nunca acessa secrets; apenas `webhooks_safe` (hint mascarado) e estados/flags.
- Edge Functions usam RPC `get_webhook_secret` (Security Definer) com `WEBHOOK_ENCRYPTION_KEY` no ambiente.
- RLS por `igreja_id/filial_id` em `webhooks`, `financeiro_config` e artefatos de sessão.
- Auditoria: `last_sync_at/result` (em `webhooks`), `approved_at/by`, `rejection_*` (sessão).

### 8.6 Exemplos de snapshot na sessão (JSON)

```
{
    "provider_tipo": "pix_banco_x",
    "webhook_url": "https://api.banco-x.com/pix/incoming",
    "secret_hint": "…9F2A",
    "sync_strategy": "webhook",
    "blind": {
        "mode": "required",
        "min": 2,
        "tolerance": 0,
        "compare": "total",
        "lock_totals": true
    }
}
```

### 8.7 Critérios de Aceite (Integração)

- [ ] Segredos sempre via `webhooks`/RPC; UI só exibe hint.
- [ ] `financeiro_config` define flags e janela; sessão guarda snapshot.
- [ ] Passo 3 sincroniza via Edge Function e marca linhas `api` como read-only.
- [ ] Materialização em `transacoes_financeiras` ocorre apenas após validação da sessão.
