# Arquitetura do Domínio Financeiro — Diagnóstico, CORE + Módulos e Conciliação

> Mapeamento completo do estado atual (jul/2026) e proposta de modularização.
> Complementa ADR-021 (multi-tenant), ADR-022 (importação de extratos),
> ADR-025 (baixa automática), ADR-027 (valor bruto vs líquido) e ADR-028
> (sincronização bancária por eventos). As duas decisões estruturantes daqui
> devem ser formalizadas como **ADR-029 (camada canônica de lançamentos no
> banco)** e **ADR-030 (conciliação transacional e motor único de score)**.

---

## 1. Diagnóstico resumido

| # | Problema | Sintoma | Custo |
|---|----------|---------|-------|
| 1 | Regras de lançamento vivem no frontend | `TransacaoDialog.tsx` (1788 l.) monta payload e faz insert/update direto; `Entradas.tsx`/`Saidas.tsx` duplicam ~60-70% de código | Toda regra nova é escrita 2-3×; divergência silenciosa |
| 2 | Bot duplica as regras | `chatbot-financeiro/index.ts` (2538 l.) insere direto em `transacoes_financeiras` com service role | ADR-027, validações e defaults reimplementados; drift provável |
| 3 | Conciliação fragmentada | 3 motores de score, 3 modelos de vínculo, confirmação multi-tabela **não transacional no frontend** | Risco de estado inconsistente; impossível reusar pelo bot/API |
| 4 | Ofertas é um canal de escrita paralelo | `RelatorioOferta.tsx` (**2627 l., o maior arquivo do financeiro**) monta payload de transação à mão em 3 pontos, sem reusar TransacaoDialog | Terceira cópia das regras; inconsistências de status já no código |
| 5 | Consultas agregam no cliente sem limite | Dashboard, Insights, Projeções, Contas e Ofertas leem linhas cruas e agregam no navegador, sem `.limit()` | **Truncamento silencioso** no teto de 1000 linhas do PostgREST em períodos grandes |
| 6 | UX mobile desigual | Lançamentos OK; conciliação inutilizável no celular | Fluxo central do tesoureiro preso ao desktop |

**Causa raiz comum (1-4): não existe porta de entrada única de escrita no
domínio financeiro.** Quatro canais (TransacaoDialog, bot, RelatorioOferta e
importações/integrações) escrevem direto nas tabelas, cada um com sua cópia
das regras.

---

## 2. Estado atual — Bloco de Transações

### 2.1 Tamanho e complexidade

| Arquivo | Linhas | Papel |
|---|---|---|
| `src/components/financas/TransacaoDialog.tsx` | **1788** | Form criar/editar — maior artefato do bloco |
| `src/pages/financas/Reembolsos.tsx` | 1532 | Reembolsos (gera transações) |
| `src/pages/financas/Saidas.tsx` | **1324** | Contas a pagar |
| `src/pages/financas/Entradas.tsx` | **1183** | Recebimentos |
| `src/components/financas/ExportarTab.tsx` | 635 | Exportação |
| `src/components/financas/TransacaoActionsMenu.tsx` | 594 | Ações por linha (mutações diretas) |
| `src/pages/financas/Transferencias.tsx` | 368 | Par de transações entre contas |
| Calendários/dialogs espelhados Entradas×Saídas | ~150 cada | Duplicados |

### 2.2 Responsabilidades misturadas

- **`Entradas.tsx` / `Saidas.tsx`**: cada página concentra ~15 estados de
  UI/filtro, 4 `useQuery` inline direto no supabase (filtro multi-tenant
  repetido em cada query), regra de período, agrupamento por data, helpers de
  status/moeda, exportação e JSX de ~800 linhas. Saídas adiciona
  transferências, `entradaVinculada` e query extra de `extratos_bancarios`.
- **`TransacaoDialog.tsx`**: fetch de 7 tabelas de apoio (contas, categorias,
  subcategorias, centros_custo, bases_ministeriais, fornecedores,
  formas_pagamento), OCR de nota fiscal (`processar-nota-fiscal`), criação
  inline de fornecedor (~l.791-838), regras de valor líquido ADR-027
  (~l.932-953), montagem de payload (~l.955-1000), insert/update direto
  (~l.1002-1016) e efeito `disparar-alerta` (~l.1019-1030).
- **`TransacaoActionsMenu.tsx`**: mudança de status, delete, conferido
  manual, consultas a `extratos_bancarios`/`conciliacoes_lote` — tudo
  mutação direta no cliente.

### 2.3 Duplicação Entradas ↔ Saídas

~60-70% do código é espelhado 1:1 (estado de filtros, fetch, período,
agrupamento, exportação, helpers). A variação real está em
`.eq("tipo", ...)`, rótulos e nas features extras de Saídas. Pares de
calendário (`EntradasCalendario`/`SaidasCalendario` etc.) idem.

### 2.4 Abstrações existentes reutilizáveis

- `src/hooks/useTransacoesFiltro.ts` (73 l.) — único ponto realmente
  compartilhado (`Transacao`, `FiltrosTransacao`, `ConciliacaoMap`).
- `src/hooks/usePagination.ts`, `src/hooks/useFilialPaginatedQuery.ts`
  (subutilizado — as páginas fazem query manual).
- Contexto multi-tenant: `useFilialId`, `useIgrejaId`, `isAllFiliais`.
- `src/lib/exportUtils.ts`, `src/utils/dateUtils`.

### 2.5 Modelo de dados

Tabela central **`transacoes_financeiras`** (migration base
`20251129191330_*.sql`):

- `tipo` entrada/saida · `tipo_lancamento` unico/recorrente/parcelado ·
  `status` pendente/pago/cancelado (TEXT + CHECK, sem enums nativos).
- Datas: vencimento, pagamento, competência.
- FKs: `contas`, `categorias_financeiras`, `subcategorias_financeiras`,
  `centros_custo`, `bases_ministeriais`, `fornecedores`.
- Adicionadas depois: `igreja_id`/`filial_id` (multi-tenant), colunas
  ADR-027 (`valor_liquido`, `juros`, `multas`, `desconto`,
  `taxas_administrativas`), `conciliacao_status`, `conferido_manual`,
  `evento_id`, `solicitacao_reembolso_id`, `cob_pix_id`, `pessoa_id`,
  `origem` (manual/api).
- Trigger AFTER UPDATE de status recalcula `contas.saldo_atual` quando muda
  de/para `pago`. RLS: admin OR tesoureiro.

### 2.6 Padrão de mutação (o problema central)

- CRUD de transação = insert/update/delete **direto no cliente**, sem camada
  de serviço.
- Conciliação/reembolso/saldo = RPCs Postgres (`aplicar_conciliacao`,
  `reconciliar_transacoes`, `gerar_candidatos_conciliacao`,
  `desconciliar_transacao`...).
- Integrações/efeitos = edge functions (`processar-nota-fiscal`,
  `disparar-alerta`, `finance-sync`, `getnet-sftp`, `chatbot-financeiro`,
  `pix-webhook`, `santander-*`).
- **Bug latente**: lançamento parcelado/recorrente insere **apenas a
  parcela 1** com metadados (`total_parcelas`, `recorrencia`) — não existe
  função nem job que materialize as ocorrências futuras.

---

## 3. Estado atual — Conciliação (Extrato bancário + Getnet)

### 3.1 Modelo de dados

- **`extratos_bancarios`** (migration `20260109150000`): lado banco.
  `conta_id`→`contas`, `data_transacao`, `valor`, `tipo` credito/debito,
  `reconciliado`, `external_id` + `origem` (`manual`, `api_santander`,
  `arquivo_ofx`, `arquivo_csv`, `getnet_sftp`, `getnet_sftp_txt`),
  `transacao_vinculada_id` (FK **lógica**, sem constraint física).
  Dedupe: índice único `(conta_id, external_id)`.
- **Vínculo extrato↔transação tem 3 mecanismos** (não há tabela única):
  1. **1:1** — `extratos_bancarios.transacao_vinculada_id` + `reconciliado=true`
  2. **N:1** — `conciliacoes_lote` + `conciliacoes_lote_extratos`
  3. **1:N** — `conciliacoes_divisao` + `conciliacoes_divisao_transacoes`
- Suporte: `reconciliacao_audit_logs`, `conciliacao_ml_sugestoes` +
  `conciliacao_ml_feedback` (tipo_match 1:1/1:N/N:1, score),
  `pix_recebimentos`.
- **Conta bancária = tabela `contas`** (`tipo='bancaria'`), `saldo_atual`
  mantido por trigger sensível apenas a mudanças de/para status `pago`.
  Extrato importado **não** afeta saldo. `conferido_manual` é ortogonal
  (conferência de dinheiro em espécie).
- **6 tabelas Getnet** (`getnet_resumo` RV PF/LQ, `getnet_analitico` CV/NSU,
  `getnet_ajustes`, `getnet_financeiro_resumo` tipo 5,
  `getnet_financeiro_detalhe` tipo 6, `getnet_arquivos`) — junções por
  `chave_ur` e `rv`.

### 3.2 Fluxo atual (como está)

```mermaid
flowchart TD
    subgraph Fontes de extrato
        OFX[OFX/CSV/XLSX manual<br/>ImportarExtratosTab 813 l.<br/>parse + INSERT client-side]
        GET[Getnet SFTP<br/>edge getnet-sftp 1439 l.<br/>6 tabelas getnet_* + espelho LQ]
        SAN[Santander API / PIX<br/>santander-extrato, pix-webhook]
    end
    OFX -->|insert direto| EXT[(extratos_bancarios<br/>dedupe conta_id+external_id)]
    GET -->|upsert espelho RV LQ tipo 1| EXT
    SAN -->|insert| EXT

    subgraph Motores de score CONCORRENTES
        M1[RPC gerar_candidatos_conciliacao<br/>pesos 0.4/0.3/0.2/0.1 · corte 0.6-0.7]
        M2[RPC legada reconciliar_transacoes<br/>+ aplicar_conciliacao · score 50-100]
        M3[Score client-side<br/>ConciliacaoInteligente.tsx:381-391]
    end
    EXT --> M1 & M2 & M3

    M1 & M2 & M3 --> CONF[confirmarConciliacao NO FRONTEND<br/>ConciliacaoInteligente.tsx:421-703<br/>~6 updates sequenciais NÃO transacionais]
    CONF --> EXT2[update extrato: reconciliado,<br/>transacao_vinculada_id / lote / divisão]
    CONF --> TRX[(transacoes_financeiras<br/>conciliacao_status, pendente→pago)]
    TRX -->|trigger| SALDO[contas.saldo_atual]
```

### 3.3 Pontos de atenção

1. **Espelhamento Getnet parte do tipo 1 (RV LQ = previsto)**, não do tipo 5
   (`getnet_financeiro_resumo` = dinheiro que efetivamente movimentou).
2. **Três regras de score** com pesos e limiares distintos.
3. **Confirmação multi-tabela roda no frontend** — falha no meio dos ~6
   updates deixa estado inconsistente (extrato conciliado sem transação paga,
   lote órfão).
4. `transacao_vinculada_id` sem FK física.

### 3.4 UI de conciliação (tamanhos)

`ConciliacaoInteligente.tsx` **1239 l.**, `ConciliacaoManual.tsx` **1018 l.**,
`HistoricoExtratos.tsx` 878, `ImportarExtratosTab.tsx` 813,
`DashboardConciliacao.tsx` 795, `ExtratoPreviewDialog.tsx` 635,
`DividirExtratoDialog.tsx` 471, `ConciliacaoLoteDialog.tsx` 378 — container
`Reconciliacao.tsx` (63 l., 5 abas).

---

## 4. Estado atual — Bot e Integrações

### 4.1 O bot financeiro já existe — e é o segundo maior monólito

- **`supabase/functions/chatbot-financeiro/index.ts` (2538 l.,
  `verify_jwt=false`)** — lançamento via WhatsApp (Make). Máquina de estados
  em `atendimentos_bot.meta_dados` (fluxos DESPESAS, CONTA_UNICA, REEMBOLSO,
  TRANSFERENCIA). Baixa anexo do WhatsApp (Graph API), salva em Storage
  `transaction-attachments`, chama OCR, confirma com o usuário e **insere
  direto** em `transacoes_financeiras` (~l.1612, 2399, 2422) e
  `transferencias_contas` (~l.2372) com service role.
- Autorização por pessoa: `profiles.autorizado_bot_financeiro` + flags
  `autorizado_lancar_despesas`/`_depositos`/`_reembolsos` — validadas dentro
  do Deno, longe das demais regras.
- Roteamento Make: `consultar-sessao-bot` resolve `igreja_id`/`filial_id`
  via `whatsapp_numeros` e decide triagem × financeiro.
- **Segurança**: chatbot-financeiro NÃO usa `x-webhook-secret` (as demais
  edges de webhook Make usam shared secret timing-safe). Ponto a corrigir.

### 4.2 Ecossistema (58 edge functions)

- Financeiro/bancário: `getnet-sftp`, `pix-webhook` (ADR-024),
  `santander-api`/`santander-extrato`, `buscar-pix-recebidos`/
  `buscar-pix-cron`/`criar-cobranca-pix`, `finance-sync` (esqueleto),
  `sync-transferencias-conciliacao`, `reclass-transacoes`/`undo-reclass`/
  `undo-import`, `processar-nota-fiscal`, `integracoes-config` (secrets
  criptografados tweetnacl).
- 3 padrões de segurança coexistem: `x-webhook-secret` timing-safe; secrets
  por igreja (tabela `webhooks` + `_shared/webhook-resolver.ts`, fallback
  filial→igreja→sistema); `_shared/internal-auth.ts`.
- Docs de referência: `docs/automacoes/catalogo-automacoes.md`,
  `docs/automacoes/FLUXO_MAKE_COM_CONSULTAR_SESSAO.md`, ADR-024/025/026,
  `docs/BACKLOG_MULTI_TENANCY.md`.

---

## 5. Estado atual — Demais entrypoints e consultas

### 5.1 Relatório de Ofertas / Sessão de contagem (o 4º canal de escrita)

- **`src/pages/financas/RelatorioOferta.tsx` (2627 l.) é o maior arquivo do
  financeiro.** Wizard de 4 passos: data do culto, período, conferentes,
  linhas físicas + digitais, sincronização de PIX de `pix_webhook_temp`,
  rascunho em `sessoes_itens_draft`, conferência cega (blind count) e
  aprovação via `notifications`.
- **Modelo**: `sessoes_contagem` (status CHECK: aberto / aguardando_conferencia
  / divergente / validado / cancelado / reaberto; snapshot dos parâmetros de
  conferência cega; `conferentes` JSONB; `evento_id`) + `contagens` (1 linha
  por conferente) + `sessoes_itens_draft` + coluna
  `transacoes_financeiras.sessao_id`.
- **RPCs existentes**: `open_sessao_contagem` — **duas versões divergentes**
  (uma lê `financeiro_config`, outra `configuracoes_financeiro`; dedup
  diferente) — e `confrontar_contagens` (conferência cega com tolerância).
- **Contagem vira transação por INSERT direto montado no cliente em 3
  pontos** (`RelatorioOferta.tsx:1074` no fluxo de aprovação — sem
  `sessao_id`; `:2337` no "Encerrar e Lançar" — com `sessao_id`; payload
  duplicado entre físico/digital/aprovação). O `TransacaoDialog` **não** é
  reutilizado. Conta destino vem do mapeamento `forma_pagamento_contas`;
  status vem de `forma.gera_pago`.
- **Inconsistências**: `finalizarSessao` grava `status='finalizado'` +
  `data_fechamento`, ambos **fora do CHECK/DDL** da tabela; o StatusBadge da
  UI exibe estados que não existem no banco (em_contagem, fechada,
  rejeitada).
- `SessaoLancamentos.tsx` (226 l.) é leitura: lista as transações da sessão e
  cruza com `extratos_bancarios` para marcar Conciliado × Conferido
  (`conferido_manual` para dinheiro).

### 5.2 Conta corrente (`Contas.tsx` 1330 l.)

- Botão **"Ver Extrato"** (`Contas.tsx:890-921`) abre `ExtratoPreviewDialog`,
  que **consulta o extrato online no banco** via edge `santander-api`
  (`ExtratoPreviewDialog.tsx:100,146`) e **importa para `extratos_bancarios`**
  (`:257-299`) — ou seja, Contas é o 4º ponto de ingestão de extrato (API
  online), além de GerenciarDados (OFX/CSV), Getnet SFTP e PIX webhook.
  Há também teste de conexão (`test-santander`) e busca de saldo online.
- Movimentações do período: 2 queries diretas em `transacoes_financeiras`
  (`Contas.tsx:224-263`, `:266-292`), totais agregados **client-side** sem
  limite de linhas.
- **`AjusteSaldoDialog` sobrescreve `contas.saldo_atual` direto**
  (`AjusteSaldoDialog.tsx:52-58`) — não cria transação de ajuste; o ajuste
  manual fica sem trilha de auditoria.
- Importação de arquivo (OFX/CSV/XLSX) fica em `GerenciarDados.tsx` (aba
  extratos → `ImportarExtratosTab`); histórico em `Reconciliacao.tsx`.

### 5.3 Consultas e dashboards — comportamentos e melhorias

| Dashboard | Linhas | Fonte de dados | Comportamento |
|---|---|---|---|
| `pages/Dashboard.tsx` | 841 | queries diretas + `view_solicitacoes_reembolso` | Mês atual vs anterior, pendências, sessões; agregação client-side, sem limite |
| `pages/DashboardOfertas.tsx` | 606 | query direta | **Filtra ofertas por `.ilike("descricao","%oferta%")`** — heurística de texto frágil (não usa categoria nem `sessao_id`); joins manuais com formas/contas |
| `pages/DRE.tsx` | 505 | **RPC `get_dre_anual`** | Único com agregação no servidor — o padrão a seguir |
| `pages/Insights.tsx` | 633 | query direta | Top fornecedores/categorias/mensal via Map client-side, sem limite |
| `pages/Projecao.tsx` | 401 | 2 queries diretas | Projeção 100% client-side |
| `components/DashboardConciliacao.tsx` | 795 | **RPCs legadas** `reconciliar_transacoes` + `aplicar_conciliacao` | É o acionador do motor de score LEGADO — remoção depende da F4 |
| `components/RelatorioCobertura.tsx` | 585 | tabelas cruas (`contas`, `extratos_bancarios`, `reconciliacao_audit_logs`) | Não usa a `view_reconciliacao_cobertura` que já existe |

**DRE em detalhe**: `get_dre_anual(p_ano)` (SECURITY DEFINER, tenant via JWT)
soma `transacoes_financeiras` JOIN categorias por seção/mês, **apenas
`status='pago'`**, excluindo reembolsos não pagos. Melhorias: parametrizar o
regime (caixa vs competência — hoje mistura: filtra por pago, mas
`data_competencia` e o ADR-001 apontam para competência); recorte por filial;
visão mobile em cards (hoje só `overflow-x-auto`).

**Projeções em detalhe**: histórico por `data_pagamento` + futuras por
`data_vencimento`, cálculo no cliente, sem limite. Melhoria estrutural:
como as parcelas/recorrências futuras **não existem no banco** (bug da
parcela única, seção 2.6), a projeção **subestima compromissos futuros** —
corrigir a materialização (D6) é pré-requisito de qualquer projeção séria.

**Melhorias transversais de consulta:**
1. Padronizar leitura agregada no servidor seguindo o modelo do DRE:
   RPCs/views `fin_resumo_periodo`, `fin_ofertas_periodo` etc. — elimina o
   truncamento silencioso de 1000 linhas e o tráfego de linhas cruas.
2. DashboardOfertas: trocar `ilike '%oferta%'` por filtro estrutural
   (categoria ou `sessao_id IS NOT NULL`).
3. DashboardConciliacao: migrar para o motor único (F4).
4. RelatorioCobertura: consumir `view_reconciliacao_cobertura`.
5. Skeletons e estados vazios consistentes em todos os dashboards.

### 5.4 Reembolsos

- **ADR-001 (fato gerador)**: `itens_reembolso` = competência (alimenta o
  DRE); `transacoes_financeiras` = caixa, criada **só no pagamento**
  (`Reembolsos.tsx:452-476` — insert direto de UMA transação
  `tipo=saida, status=pago` + update da solicitação para `pago`).
- Workflow no schema: `rascunho → pendente → aprovado → pago` (+ rejeitado).
  **A UI não tem ação de aprovar/rejeitar — o fluxo real é
  `pendente → pago`** (o estado `aprovado` existe mas nunca é exercido).
- **Divergência de permissão**: o trigger `validar_status_reembolso` exige
  role `admin` para aprovar/pagar/rejeitar, mas a UI libera o botão para
  `tesoureiro` — possível bloqueio em runtime.
- **Divergência entre canais**: o bot (fluxo REEMBOLSO,
  `chatbot-financeiro:1847-1985`) grava nas mesmas tabelas mas cria como
  `rascunho` → insere itens → promove a `pendente`, popula sugestões da IA e
  **dispara a notificação `financeiro_reembolso_aprovacao` — que a UI não
  dispara**.
- Trigger `atualizar_valor_total_reembolso` soma itens (4 migrations de
  retrabalho até estabilizar no ADR-001).

### 5.5 Reclassificação — o modelo de auditoria a replicar

- `Reclassificacao.tsx` (1016 l.): wizard em lote — filtros + seleção fina
  por checkbox; altera categoria/subcategoria/centro/conta (payload aceita
  também fornecedor, status e **`data_competencia`**); limite 5000.
- **Único fluxo de escrita em lote com arquitetura correta**: edge
  `reclass-transacoes` (411 l.) valida roles e cada destino contra o banco,
  grava job em `reclass_jobs` + **snapshot antes/depois por transação** em
  `reclass_job_items`; `undo-reclass` reverte por upsert do snapshot.
  **Este padrão (job + snapshot + undo) deve virar convenção das RPCs
  `fin_*`.**
- Lacunas: janela de tempo do undo comentada e não implementada; como pode
  alterar `data_competencia` e categorias, **muda o DRE retroativamente**
  sem trilha visível no relatório; `itens_reembolso` (competência) fica
  fora do alcance da reclassificação. (Bloqueio de transação conciliada:
  ver granularidade por campo abaixo — não é mais "tudo ou nada".)
- **Fix jul/2026**: os 5 filtros da etapa 1 (Categoria/Subcategoria/Centro/
  Fornecedor/Conta) não tinham como buscar lançamentos com o campo NULO —
  útil justamente pra achar o que falta classificar. Adicionada opção "Sem
  X" em cada filtro (`.is(coluna, null)` no lugar de `.eq`), válida tanto
  pra entrada quanto saída. A tabela de revisão (etapa 2) também ganhou a
  coluna Subcategoria, que faltava (o dado já vinha na query, só não era
  renderizado).
  - Review Codex (P1): o sentinel `__NONE__` ("Sem X") só era tratado no
    preview (`Reclassificacao.tsx`) — a edge `reclass-transacoes` reaplica
    os mesmos `filtros` pra validar os `ids` recebidos antes de escrever, e
    comparava a coluna UUID com a string literal `__NONE__`, aplicando 0
    linhas silenciosamente mesmo com itens selecionados. Corrigido com o
    mesmo `.is(coluna, null)` no edge (`index.ts:287-299`).
  - **Achado extra (usuário testou a tela e travou)**: `resultados` vinha
    de `useQuery` com default inline `data: resultados = []` — cria um
    array NOVO a cada render enquanto a query fica desabilitada (etapa 1,
    antes de filtrar), mudando a referência a cada vez; o
    `useEffect([resultados])` que sincroniza `selectedIds` rodava sem
    parar → "Maximum update depth exceeded", tela travava só de
    interagir. Bug pré-existente (não introduzido por esta mudança), só
    encontrado agora porque a tela foi de fato aberta pra testar o filtro
    novo. Fix: constante `EMPTY_RESULTADOS` no módulo (referência estável)
    no lugar do `[]` inline — padrão clássico de estabilização de
    default do React.
- **Fix jul/2026 (2) — bloqueio de conciliada por campo, não por
  transação**: o bloqueio de reclassificar transação conciliada
  (ADR-030 F4) era tudo-ou-nada — se **qualquer** transação selecionada
  estivesse conciliada, a operação inteira era recusada (409
  `TRANSACAO_CONCILIADA`), independente de quais campos estavam de fato
  sendo alterados. Pedido do usuário: liberar quando a alteração não mexe
  em "valores" (vínculo bancário/período fechado). Corrigido em
  `reclass-transacoes/index.ts` para só bloquear quando `updateFields`
  contém `conta_id`, `data_competencia` ou `status` — `categoria_id`,
  `subcategoria_id`, `centro_custo_id` e `fornecedor_id` ficam liberados
  mesmo em transação conciliada/conferida manualmente, sem precisar
  desconciliar antes.
  - **Achado extra (revisão própria, mesma sessão)**: `updateFields` vinha
    direto de `Object.entries(novos_valores)` sem allow-list de coluna —
    o tipo `ReclassPayload` é só compile-time, não protege em runtime. Um
    payload bruto poderia incluir `valor`/`valor_liquido`/
    `data_vencimento`/`data_pagamento` e isso seria aplicado sem
    nenhuma validação (esses campos não passam por nenhum dos `if
    (updateFields.X)` existentes). Corrigido com uma allow-list explícita
    (`CAMPOS_PERMITIDOS`) das 7 colunas de metadado que este endpoint
    pode escrever — reclassificação nunca toca valor monetário nem data
    de vencimento/pagamento, isso é papel de `fin_atualizar_lancamento`/
    `fin_confirmar_conciliacao`.

---

## 6. Estado atual — UX Web / Mobile (Tablet e Celular)

### 6.1 Infraestrutura já existente (boa base)

- PWA real (`vite-plugin-pwa` + workbox), meta viewport, safe-area insets
  iOS (`src/index.css:196-199`), anti-zoom iOS (font-size 16px em inputs),
  dark mode (`next-themes`; classes `dark:` em 23 arquivos do financeiro).
- Primitivos prontos: drawer `vaul`, `responsive-dialog` (Dialog↔Drawer),
  `sheet`, `skeleton`, `useIsMobile` (768px), `useMediaQuery`.
- Sidebar vira Sheet no mobile; bottom-nav `MobileNavbar` com animações.

### 6.2 O que está bem no financeiro

- **Entradas/Saídas**: listas em cards (não tabela), filtros em
  `FiltrosSheet`, resumo `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- **TransacaoDialog**: o mais bem adaptado — `useIsMobile`, layout mobile
  dedicado com barra de ações fixa no rodapé, grids `md:grid-cols-2`.
- **Dashboard**: Recharts com `ResponsiveContainer`, grids responsivos.

### 6.3 Lacunas concretas

1. **`ConciliacaoInteligente.tsx:841` — crítico**: duas colunas fixas
   lado-a-lado + coluna central `w-32`, zero classes responsivas/`isMobile`.
   Inutilizável em celular; apertado em tablet 768-834px.
2. **`Reconciliacao.tsx:38`**: `TabsList grid-cols-5` fixo — abas espremidas
   e ilegíveis no celular.
3. **Finanças fora do bottom-nav** — acesso mobile só via Menu → Sheet
   (`SidebarTrigger` é `hidden md:block`).
4. **Editar por `onDoubleClick`** (Entradas:783, Saidas:908/1119) — duplo
   toque não é padrão touch.
5. **DRE**: tabela larga só com `overflow-x-auto`.
6. **Skeletons quase ausentes** — maioria usa "Carregando..." sem
   placeholder de layout.
7. **Tablet**: >768px cai direto no layout desktop denso.
8. **`useIsMobile` aplicado de forma desigual** entre componentes.

### 6.4 Avaliação honesta

- **Celular: parcialmente utilizável** — lançar e consultar funciona bem;
  a conciliação (fluxo central do tesoureiro) é inutilizável.
- **Tablet: utilizável**, mas com densidade desenhada para desktop.
- O site público (`src/pages/public/*`) prova que o time domina
  responsividade; a disciplina não alcançou os componentes complexos do
  financeiro. **Modularizar é pré-requisito**: ajuste responsivo em um
  arquivo de 1239 linhas é cirurgia de alto risco.

### 6.5 Direção de melhoria premium

- Conciliação mobile: alternar painéis por Tabs/stepper (padrão já usado em
  `ConciliacaoManual:534`); abas de `Reconciliacao` com scroll horizontal ou
  Select no mobile.
- Finanças no bottom-nav (ou atalho contextual por papel tesoureiro/admin).
- Tap único abre detalhe (drawer); ações no ActionsMenu; abolir double-click
  como único caminho.
- Skeletons padronizados por lista/card no core de UI do financeiro.
- DRE mobile: cards resumidos com drill-down, tabela no desktop.
- `useIsMobile`/`ResponsiveDialog` como convenção obrigatória do módulo.

---

## 7. Arquitetura alvo — CORE + Módulos

### 7.1 Decisão central: o CORE de escrita vive no banco (RPCs `fin_*`)

Alternativas avaliadas:

- **A. RPCs Postgres (escolhida)** — único runtime que todos os canais já
  alcançam (front via PostgREST, edges via service role); transacional por
  construção; o padrão já foi inaugurado no repo
  (`gerar_candidatos_conciliacao`, `aplicar_conciliacao`,
  `desconciliar_transacao`) — só não foi generalizado.
- **B. Lib TypeScript compartilhada** — rejeitada como camada primária: não
  resolve transacionalidade nem impede escrita direta por um terceiro canal.
- **C. Edge "API financeira"** — rejeitada como camada primária: hop extra,
  cold start; vale como fachada futura por cima das mesmas RPCs.

Leituras continuam via PostgREST/RLS como hoje.

```mermaid
flowchart TD
    FE[Frontend SPA<br/>features/financeiro/*] -->|JWT + RLS| CORE
    BOT[chatbot-financeiro<br/>estados, mídia, OCR] -->|service role + p_contexto| CORE
    EDGES[Edges de integração<br/>getnet-sftp, santander, pix] -->|service role + p_contexto| CORE

    subgraph CORE FINANCEIRO — Postgres
        CORE[RPCs canônicas fin_*<br/>fin_criar_lancamento · fin_atualizar_lancamento<br/>fin_alterar_status_lancamento · fin_excluir_lancamento<br/>fin_alterar_competencia_grupo<br/>fin_criar_transferencia · fin_ingerir_extratos<br/>fin_confirmar_conciliacao · fin_desconciliar<br/>fin_gerar_candidatos_conciliacao<br/>fin_lancar_sessao · fin_pagar_reembolso · fin_ajustar_saldo]
        CORE --> T[(transacoes_financeiras<br/>transferencias_contas<br/>extratos_bancarios<br/>conciliacoes_*)]
        T --> TRG[triggers saldo · RLS leitura · auditoria]
    end
```

**Regra de ouro:** nenhum canal faz INSERT/UPDATE/DELETE direto em
`transacoes_financeiras`, `transferencias_contas`, `extratos_bancarios` e
tabelas de conciliação. Escrita só via RPC `fin_*` (enforçável ao final
revogando privilégios de escrita do role `authenticated`).

### 7.2 Contratos das RPCs (conceituais)

Convenções: prefixo `fin_`; escalares para o essencial + `p_extras jsonb`
para opcionais; retorno `jsonb {ok, id(s), warnings[]}`; auditoria em todas.

**Resolução de tenant e ator (padrão obrigatório):**
- JWT de usuário: tenant derivado de `get_current_user_igreja_id()`/
  `get_current_user_filial_id()`; permissão via `has_role` +
  `has_filial_access`. Parâmetros explícitos são validados contra o JWT.
- Service role (bot/edges): `p_contexto jsonb {igreja_id, filial_id,
  ator_profile_id, canal}`; a RPC valida que o ator pertence ao tenant e,
  para canal `bot`, checa `autorizado_bot_financeiro` + flag específica.
  A autorização do bot sai do Deno e passa a morar junto das demais regras.

**Lançamentos:**
- `fin_criar_lancamento(p_tipo, p_valor, p_data, p_conta_id, p_categoria_id,
  p_descricao, p_extras, p_contexto)` — valida FKs no tenant; regras ADR-027;
  defaults; **materializa parcelas** (corrige o bug da parcela única);
  semântica de recorrência (decisão D6).
- `fin_atualizar_lancamento(p_id, p_patch, p_contexto)` — recalcula ADR-027;
  bloqueia edição de conciliado (D4).
- `fin_alterar_status_lancamento(p_id, p_novo_status, p_dados, p_contexto)` —
  única porta pendente↔pago↔cancelado; trigger de saldo intacto; registra
  quem/quando/canal. Substitui as mutações do `TransacaoActionsMenu`.
- `fin_excluir_lancamento(p_id, p_contexto)` — recusa se conciliado; trata
  irmãs de parcelamento (D4).
- `fin_criar_transferencia(...)` — par em `transferencias_contas` +
  transações espelho, atomicamente.

**Entrypoints especializados (decorrentes da extensão do mapeamento):**
- `fin_lancar_sessao(p_sessao_id, p_itens jsonb[], p_contexto)` — lançamento
  em lote da sessão de contagem (substitui os 3 inserts diretos do
  `RelatorioOferta`): valida sessão validada/tolerância, resolve conta por
  `forma_pagamento_contas`, cria todas as transações com `sessao_id` numa
  transação e finaliza a sessão. Pré-requisito: corrigir o CHECK de
  `sessoes_contagem` (incluir `finalizado`/`data_fechamento`) e unificar as
  duas versões de `open_sessao_contagem`.
- `fin_pagar_reembolso(p_solicitacao_id, p_conta_id, p_dados, p_contexto)` —
  transação de caixa + status da solicitação + notificação via fila, numa
  transação (resolve a divergência UI×bot: hoje só o bot notifica). Alinhar
  trigger `validar_status_reembolso` (`admin`) × UI (`tesoureiro`).
- `fin_ajustar_saldo(p_conta_id, p_valor, p_motivo, p_contexto)` — substitui
  o UPDATE direto do `AjusteSaldoDialog`: cria lançamento de ajuste auditável
  em vez de sobrescrever `contas.saldo_atual`.

**Leitura agregada (modelo DRE):** RPCs/views de leitura —
`fin_resumo_periodo`, `fin_ofertas_periodo`, `fin_projecao_mensal` — seguindo
o padrão de `get_dre_anual`, para Dashboard, Ofertas, Insights e Projeções.
Elimina o truncamento silencioso de 1000 linhas e a agregação client-side.

**Padrão de auditoria:** replicar o modelo `reclass_jobs` +
`reclass_job_items` (job + snapshot antes/depois + undo) como convenção das
RPCs `fin_*` de escrita em lote.

### 7.3 Frontend: `src/features/financeiro/`

```
src/features/financeiro/
├── core/                       # compartilhado por todos os módulos
│   ├── api/                    # ÚNICO lugar que chama supabase no domínio
│   │   ├── lancamentos.api.ts  # wrappers tipados fin_*
│   │   ├── conciliacao.api.ts
│   │   ├── extratos.api.ts
│   │   └── apoio.api.ts        # 7 tabelas de apoio (hoje inline no Dialog)
│   ├── hooks/                  # useLancamentos (unificado por tipo),
│   │                           # useLancamentoMutations, useDadosApoio,
│   │                           # useTransacoesFiltro (movido)
│   ├── model/                  # types.ts, constants.ts (status/cor/rótulo)
│   └── lib/                    # valores.ts (moeda/ADR-027), agrupamento.ts
├── lancamentos/                # TransacoesPage ÚNICA parametrizada por tipo;
│   └── components/             # TransacaoDialog decomposto (~200 l. orquestrador
│                               # + FormCampos, ValoresFiscais, OcrPanel,
│                               # FornecedorQuickCreate, ActionsMenu só-UI)
├── conciliacao/                # telas decompostas + responsivas
├── importacao/                 # parse OFX/CSV client-side → fin_ingerir_extratos
├── integracoes/                # Getnet, Santander, PIX (config/logs)
├── reembolsos/
├── transferencias/
└── relatorios/                 # DRE, exportações
```

Regras de dependência: módulo depende de `core/`; `core/` não depende de
módulo; módulo não importa módulo (se precisar, promove ao core).
`src/pages/financas/*` viram cascas de rota (re-export) — roteamento do
`App.tsx` intocado durante a migração.

### 7.4 Bot como módulo consumidor

`chatbot-financeiro` **mantém**: máquina de estados, mídia WhatsApp, OCR,
diálogo. **Perde**: todo INSERT direto — vira chamada às mesmas RPCs `fin_*`
via shim `supabase/functions/_shared/financeiro-core.ts` (reusado por
`pix-webhook`, `getnet-sftp`, `santander-extrato`, `finance-sync`).

Resultado: regra escrita **uma vez**. Um ajuste no ADR-027 é um
`CREATE OR REPLACE FUNCTION` — front e bot herdam no mesmo deploy.

Segurança (Fase 1): adicionar `x-webhook-secret` timing-safe ao
`chatbot-financeiro` (hoje exposto sem secret), padrão já existente nas
demais edges Make.

---

## 8. Fluxo de conciliação alvo

```mermaid
flowchart TD
    subgraph Adaptadores por fonte
        OFX[OFX/CSV/XLSX<br/>parse client-side]
        GET[getnet-sftp<br/>tabelas getnet_* = staging]
        SAN[santander-api / santander-extrato<br/>inclui botão Ver Extrato em Contas]
        PIX[pix-webhook<br/>pix_recebimentos = staging]
    end
    OFX & GET & SAN & PIX -->|ExtratoItem: data, valor, tipo,<br/>descricao, external_id, meta| ING[fin_ingerir_extratos<br/>dedupe + auditoria únicas]
    ING --> EXT[(extratos_bancarios)]
    ING -.gancho pós-ingestão.-> SCORE

    SCORE[fin_gerar_candidatos_conciliacao<br/>MOTOR ÚNICO · pesos por igreja<br/>corte default 0.6] --> SUG[(conciliacao_ml_sugestoes)]
    SUG --> UI[UI conciliação<br/>aceita/rejeita]
    UI --> CONF[fin_confirmar_conciliacao<br/>UMA transação:<br/>lock/validação → vínculo 1:1/N:1/1:N →<br/>flags extrato+transação → pendente→pago →<br/>propaga irmã transferência → audit + feedback ML]
    CONF --> EXT
    CONF --> TRX[(transacoes_financeiras)]
    TRX -->|trigger| SALDO[contas.saldo_atual]
    CONF -.inverso exato.-> DESC[fin_desconciliar]
```

1. **Motor único de score**: eleger `gerar_candidatos_conciliacao` →
   `fin_gerar_candidatos_conciliacao` (pesos parametrizáveis por igreja);
   deprecar a dupla legada `reconciliar_transacoes`/`aplicar_conciliacao` e
   o score client-side. `ModoABToggle` vira instrumento de validação na
   transição e depois é removido.
2. **Confirmação transacional**: `fin_confirmar_conciliacao(p_vinculo jsonb)`
   com `{extrato_ids[], transacao_ids[], divisoes?, sugestao_id?, score?}` —
   um contrato para os três formatos. Elimina a janela de inconsistência dos
   ~6 updates sequenciais do frontend.
3. **Pipeline comum de ingestão**: contrato `ExtratoItem` + `origem` fixa por
   fonte; dedupe e auditoria num lugar só; viabiliza `undo-import` genérico
   e o gatilho automático de geração de candidatos (ADR-028).
4. **Getnet tipo 1 vs tipo 5**: recomendação técnica — espelhar extrato a
   partir do **tipo 5** (dinheiro real; análogo ao extrato bancário),
   mantendo tipo 1 como analítico/drill-down. Muda números já conciliados →
   decisão de produto (D5); transição apenas para novos períodos
   (`origem='getnet_sftp_tipo5'`), sem reprocessar histórico.

---

## 9. Roadmap incremental (strangler fig, sem big-bang)

Cada fase é deployável isolada; legado convive com o novo.

| Fase | Escopo | Observações |
|---|---|---|
| **F0 Fundações** ✅ | Este doc + ADR-029/030; extrair helpers puros (moeda, status, agrupamento) para `features/financeiro/core`; convenção `fin_*` e padrão `p_contexto` | Concluída (PR #43) |
| **F1 RPC de lançamento + bot** ✅ | Migration `20260710120000`: `fin_criar/atualizar/status/excluir_lancamento`, `fin_criar/estornar_transferencia`, `fin_ajustar_saldo`, `fin_recalcular_saldo_conta`, `fin_materializar_recorrencias` (job pg_cron diário, D6), `fin_audit_log`, `fin_resolver_contexto`; bot via shim `_shared/financeiro-core.ts` + `x-webhook-secret` (enforça quando `MAKE_WEBHOOK_SECRET` estiver setado); `TransacaoDialog`/`ActionsMenu`/`ConfirmarPagamento`/`AjusteSaldo`/`TransferenciaDialog`/`Transferencias`/`QuickCreate` via `core/api` | Concluída (jul/2026). Ver §9.1 para semântica de saldo e drifts corrigidos |
| **F1.5 Ofertas e reembolso no CORE** ✅ | Migration `20260710123000`: `fin_lancar_sessao` (os 2 pontos do `RelatorioOferta`; fluxo de aprovação passou a vincular `sessao_id`) e `fin_pagar_reembolso` (D9: trigger alinhado a admin OU tesoureiro; notificação de pagamento ao solicitante em UI e bot) | CHECK de `sessoes_contagem` e unificação de `open_sessao_contagem` já haviam sido resolvidos pelas migrations `20260209*` |
| **F2 Unificação Entradas/Saídas** ✅ | `useLancamentos`/`useDadosFiltros`/`useConciliacaoMap` + `TransacoesPage` única em `features/financeiro/lancamentos`; páginas viram cascas de rota; **tap único** substitui double-click; `LancamentosSkeleton` padronizado; `TransacaoDialog` decomposto parcialmente (`useDadosApoio` no core; escrita via RPC) — decomposição do JSX restante fica para F7 | Concluída (jul/2026) |
| **F2.5 Leitura agregada no servidor** ✅ | Migration `20260710130000`: `fin_resumo_periodo`, `fin_ofertas_periodo` (filtro estrutural `sessao_id`/categoria no lugar de `ilike descricao`), `fin_projecao_mensal`; `get_dre_anual(p_ano, p_regime)` caixa×competência com seletor no DRE; RelatorioCobertura consome `view_reconciliacao_cobertura`; Dashboard (comparativo) e Projeção nos agregados | Concluída (jul/2026); Insights e demais queries do Dashboard ficam para evolução |
| **F3 Conciliação transacional** ✅ | Migration `20260711140000`: `fin_confirmar_conciliacao(p_vinculo)` (1:1/N:1/1:N inferidos por cardinalidade, numa transação) + `fin_desconciliar`. Frontend: `ConciliacaoInteligente`, `DividirExtratoDialog`, `useConciliacaoLote` e `DesconciliarDialog` via `core/api/conciliacao.api`. Ver §9.2 | Concluída (jul/2026). `ConciliacaoManual`/`DashboardConciliacao` (motor legado) e o bloqueio da reclassificação ficam para a F4 |
| **F4 Motor único de score** ✅ | Migration `20260711150000`: `fin_gerar_candidatos_conciliacao` (score 0..1, 1:1 e 1:N, corte por igreja em `financeiro_config.conciliacao_score_minimo`). `ConciliacaoManual`/`DashboardConciliacao`/`ConciliacaoInteligente` migrados ao motor único + `fin_confirmar_conciliacao`; `reconciliar_transacoes`/`aplicar_conciliacao`/`gerar_candidatos_conciliacao` deprecadas (DROP na F7); `ModoABToggle` (código morto) removido; `reclass-transacoes` recusa transação conciliada. Ver §9.3 | Concluída (jul/2026) |
| **F5 Pipeline de ingestão** ✅ | Migration `20260712120000`: `fin_ingerir_extratos` (contrato ExtratoItem, valor ABS, dedupe por `(conta_id, external_id)` com id determinístico, job + auditoria) + `fin_desfazer_ingestao`; canal **manual** (OFX/CSV/XLSX) via `core/api/extratos.api`; edge `gerar-sugestoes-ml` migrada ao motor único F4. Caminho service-role de integração (`20260712130000`, D-F5.2) + adaptadores **santander-api**, **getnet-sftp** (2 pontos: settlement_v1 e extrato_eletronico_v10/LQ) e **PIX** (3 pontos: pix-webhook, buscar-pix-recebidos, santander-api/buscar_pix — resolve conta via `cob_pix.conta_id`/`contas.cnpj_banco`, novo helper `ingerirExtratoPix`). Ver §9.4/§9.5 | Concluída (jul/2026); Getnet tipo-1→tipo-5 fica para a F6 (D5), sem relação com a porta de ingestão |
| **F6 Getnet tipo 5** ✅ | Espelho em `extratos_bancarios` passa a nascer do tipo 5 (`getnet_financeiro_resumo`, `tipo_operacao='PG'`) em vez do tipo 1 (LQ) — opt-in por integração via `config.espelho_tipo5_desde`; tipo 1 vira puramente analítico. Ver §9.6 | Concluída (jul/2026); sem backfill (opcional, não feito nesta fase) |
| **F7 Endurecimento + UX conciliação** ✅ (com 1 pendência menor documentada) | (1) ✅ Revogar escrita direta do role `authenticated` — completa: as 7 tabelas do domínio revogadas; (2) ✅ decompor telas gigantes de conciliação em `features/financeiro/conciliacao` já responsivas — `ConciliacaoInteligente` (crítico), `Reconciliacao`, `ConciliacaoManual` e `DashboardConciliacao` decompostos; `HistoricoExtratos` recebeu só ajuste responsivo mínimo (decomposição completa em subcomponentes fica pendente, prioridade baixa por decisão de escopo); (3) ✅ Finanças no bottom-nav (condicionado por permissão); (4) ✅ DRE mobile em cards (`features/financeiro/relatorios/`); (5) ✅ limpeza de código morto (14 arquivos removidos do módulo financeiro) | Migrations `20260713141000`/`20260713150000`/`20260713160000` (sub-frente 1). Ver §9.7-§9.10. Único item aberto: decomposição completa de `HistoricoExtratos.tsx` em subcomponentes (§9.9) |

---

### 9.1 Notas de implementação F1-F2.5 (jul/2026)

**Semântica de saldo (paridade e unificação):**
- INSERT com `status='pago'` continua **não** movendo `contas.saldo_atual`
  (o trigger é `AFTER UPDATE OF status`) — paridade com produção mantida.
- Transferência passou a mover saldo na criação (semântica do bot, adotada
  como canônica; a UI não movia). O estorno via `fin_estornar_transferencia`
  cancela as pernas por UPDATE e deixa o trigger reverter **uma** vez —
  o fluxo antigo da UI revertia em dobro (trigger + ajuste manual).
- `fin_ajustar_saldo` cria lançamento auditável (categoria "Ajuste de
  Saldo") e move o saldo pelo trigger — o UPDATE direto sem trilha acabou.
- `fin_recalcular_saldo_conta(conta, aplicar)` diagnostica/corrige drift
  histórico (`saldo_inicial + Σ pagos`).

**Decisões aplicadas:** D4 (conciliado bloqueia editar/excluir/status);
D6 (parcelado materializa tudo na criação com `lancamento_pai_id`;
recorrente via `fin_materializar_recorrencias` agendado no pg_cron diário,
horizonte 60 dias); D8 (padrão TEXT+CHECK mantido e documentado — enum
nativo descartado por custo de migração); D9 (aprovar/pagar/rejeitar
reembolso = admin OU tesoureiro; trigger atualizado).

**Segurança:** `fin_resolver_contexto` é o único ponto de resolução de
tenant/ator: JWT deriva igreja/filial do token e exige admin|tesoureiro;
service role exige `p_contexto {igreja_id, ator_profile_id, canal}` validado
contra `profiles` (canal `bot` checa `autorizado_bot_financeiro` + flag da
operação). As RPCs de leitura agregada reimpõem o requisito da RLS
(admin OU tesoureiro + acesso à filial) via `fin_exigir_leitura_financeira`
— `SECURITY DEFINER` não pode ampliar quem lê os agregados; `get_dre_anual`
ganhou o mesmo guarda (antes qualquer authenticated lia o DRE). Toda RPC de
escrita grava em `fin_audit_log` (quem/quando/canal/payload).
`chatbot-financeiro` valida `x-webhook-secret` timing-safe quando
`MAKE_WEBHOOK_SECRET` estiver configurado (rollout sem quebrar o Make).

**Deploy:** as migrations `20260710*` e as edges alteradas ainda dependem
do workflow manual `supabase-deploy.yml` (não há
`SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD` local — ver comentário no
workflow). Após o deploy, regenerar `src/integrations/supabase/types.ts`
(`supabase gen types`) para remover os casts do `core/api/finRpc.ts`.

**Validação:** harness docker (postgres 15 + stubs de `auth.*`, helpers de
tenant, triggers reais e tabelas geradas do baseline `types.ts`) exercitou
as três migrations — 25+ cenários, incluindo paridade de saldo, bloqueios
D4, flags do bot e regimes do DRE.

### 9.2 Notas de implementação F3 — conciliação transacional (jul/2026)

`fin_confirmar_conciliacao(p_vinculo jsonb, p_contexto)` é a porta única de
confirmação. O formato é **inferido pela cardinalidade** de
`extrato_ids × transacao_ids`:

- **1:1** (1 extrato, 1 transação) → `extratos_bancarios.transacao_vinculada_id`;
- **N:1** (N extratos, 1 transação) → `conciliacoes_lote` + `_extratos`; o
  status do lote (`conciliada` × `discrepancia`) é derivado no banco pela
  diferença entre a soma dos extratos e o valor da transação (com warning);
- **1:N** (1 extrato, N transações) → `conciliacoes_divisao` + `_transacoes`,
  usando `p_vinculo.divisoes = [{transacao_id, valor}]`.

Tudo numa transação: vínculo → `reconciliado=true` → `conciliacao_status=
conciliado_extrato` → **baixa `pendente→pago`** com `data_pagamento` = data do
extrato (o trigger move o saldo) → **perna irmã da transferência** acompanha →
auditoria tripla (`reconciliacao_audit_logs` por par + `conciliacao_ml_feedback`
+ `fin_audit_log`). Rejeita extrato já reconciliado ou transação já conciliada.

`fin_desconciliar(p_transacao_id, p_contexto)` limpa os **três** mecanismos de
vínculo (evolução transacional de `desconciliar_transacao`) e registra trilha.
**Decisão consciente:** NÃO reverte `pago→pendente` — dinheiro que caiu
permanece pago; reconciliar de novo é no-op de saldo (o trigger só age em
`pendente→pago`). Reverter poderia derrubar o saldo indevidamente.

**Escopo:** a F3 migrou os quatro fluxos com **DML sequencial não
transacional** que o ADR-030 mira (`ConciliacaoInteligente.confirmarConciliacao`
— ~280 linhas viram uma chamada —, `DividirExtratoDialog`, `useConciliacaoLote`,
`DesconciliarDialog`). `ConciliacaoManual`/`DashboardConciliacao` usam o **motor
de score legado** (`reconciliar_transacoes`/`aplicar_conciliacao`, já atômico
por par) e são reescritos na **F4** junto com o motor único de score; o bloqueio
de reclassificação sobre transação conciliada (TODO em
`reclass-transacoes/index.ts:324`) também fica para depois.

**Validação:** harness docker — 10 cenários (1:1/N:1/1:N e seus inversos,
discrepância de lote, auditoria tripla, guarda admin|tesoureiro).

### 9.3 Notas de implementação F4 — motor único de score (jul/2026)

Migration `20260711150000`. Passa a existir **um** motor de candidatos:
`fin_gerar_candidatos_conciliacao(p_conta_id, p_periodo_inicio, p_periodo_fim,
p_score_minimo, p_contexto)`.

- **Motor eleito**: a versão contínua `gerar_candidatos_conciliacao` (score
  0..1; pesos valor 0.4 / data 0.3 / descrição 0.2 / tipo 0.1; formatos 1:1 e
  1:N) — não a legada `reconciliar_transacoes` (score inteiro 50-100, só 1:1,
  faixas discretas). A fórmula de pesos foi **preservada intacta** (motor
  provado em produção); o que muda é a moldura canônica.
- **Tenant/ator**: resolvido por `fin_resolver_contexto` (guarda
  admin|tesoureiro no JWT; service role via `p_contexto` validado). A igreja
  **não** vem mais como `p_igreja_id` cru — a pública aceitava qualquer igreja
  sob `SECURITY DEFINER` sem checar o chamador.
- **Corte por igreja**: `p_score_minimo` explícito › `financeiro_config.
  conciliacao_score_minimo` (coluna nova, nullable) › default 0.6. Satisfaz o
  "pesos/limiar parametrizáveis por igreja" do ADR-030 §8.1 sem reescrever a
  fórmula (tuning fino de pesos fica como evolução).
- **Correção de escopo (candidatos)**: o motor só propõe transação
  `conciliacao_status = 'nao_conciliado'` (allow-list) — exclui `conciliado_extrato`,
  `conciliado_bot` **e** `conciliado_manual` (dinheiro conferido em caixa), pois
  os fluxos automáticos aplicam as linhas direto e não podem sobrescrever uma
  conciliação existente. Reimpõe também o **escopo de filial** em ambas as CTEs
  (`v_filial` do contexto) — `SECURITY DEFINER` bypassa a RLS, então sem isso um
  tesoureiro de uma filial receberia candidatos de outra. O corte por igreja faz
  **fallback filial → igreja** (linha `filial_id IS NULL`), ignorando linhas com
  score nulo. (P1/P2 do review Codex.)
- **Direção obrigatória**: o 1:1 (e o 1:N) exige `crédito↔entrada`/
  `débito↔saída` como **filtro rígido** (não só o peso 0.1) — sem isso um saque
  concilia com receita quando valor+data coincidem (0.4+0.3 = 0.7 ≥ corte) e os
  fluxos auto-aplicam. Restaura a garantia da legada `reconciliar_transacoes`.
- **Filial da UI**: `fin_gerar_candidatos_conciliacao` ganhou `p_filial_id`
  (padrão F2.5). O escopo efetivo é `COALESCE(p_filial_id, v_filial)` — o
  seletor da tela refina **dentro** do teto do usuário (validado por
  `has_filial_access`); "Todas" cai no teto. Os wrappers do frontend passam a
  filial selecionada (`isAllFiliais ? null : filialId`). Sem isso, o
  `SECURITY DEFINER` resolvia a filial pelo default do JWT, ignorando a tela.
  (P1/P2 da 3ª rodada.)
- **"Todas" preserva o escopo amplo**: quem tem papel de igreja
  (`admin`/`admin_igreja`/`super_admin`) e escolhe "Todas" (`p_filial_id` NULL)
  vê **todas** as filiais mesmo tendo filial default no JWT; usuário restrito a
  uma filial nunca amplia passando NULL. Com filial concreta, os candidatos
  **não** incluem linhas de `filial_id IS NULL` (a tela filtra por
  `.eq('filial_id')` e a auto-conciliação aplica direto — não pode mutar
  registro da igreja fora da visão da filial). **Pendentes entram no score**
  (casando por `data_vencimento` quando `data_pagamento` é nulo): a heurística
  client-side antiga sugeria pendentes e `fin_confirmar_conciliacao` faz a baixa
  `pendente→pago` — sem isso a substituição do motor regrediria o fluxo.
  (3 × P2 da 4ª rodada.)
- **Papel amplo é por igreja**: o `v_pode_todas` recorta `user_roles` por
  `igreja_id = v_igreja` (ou NULL global) — sem isso um usuário admin na igreja A
  e restrito a uma filial na igreja B veria todas as filiais de B. O
  `DashboardConciliacao` deriva a janela de candidatos dos extratos pendentes
  visíveis (a lista não tem corte de data) em vez de fixar 90 dias, senão um
  extrato antigo nunca receberia sugestão. (P1/P2 da 5ª rodada.)
- **Validação de filial não usa `has_filial_access`**: aquele helper tem atalho
  global `has_role('admin')` (satisfeito por `admin_igreja`/`admin_filial` de
  qualquer igreja). O `p_filial_id` explícito é validado por lógica recortada:
  a filial precisa pertencer a `v_igreja` **e** o usuário ter papel amplo nesta
  igreja (`v_pode_todas`) ou ser a própria filial — fecha o mesmo vazamento
  multi-igreja pelo caminho do parâmetro explícito. (P1 da 6ª rodada.)
- **Listas/rótulos alinhados ao motor**: como o motor passou a incluir
  pendentes e casar por janela derivada dos extratos, as queries de transações
  de `ConciliacaoManual` (lista do Modo Clássico) e `DashboardConciliacao`
  (rótulo do resultado + sugestão exibida) passaram a carregar `pendente`+`pago`
  (pago por `data_pagamento`, pendente por `data_vencimento`) na mesma janela dos
  candidatos — antes eram `pago`/90 dias fixos e um candidato pendente/antigo
  aparecia sem descrição/valor.
- **Frontend migrado**: `ConciliacaoManual` e `DashboardConciliacao` trocam
  `reconciliar_transacoes`→motor único e `aplicar_conciliacao`→
  `fin_confirmar_conciliacao` (F3, transacional, com baixa `pendente→pago` e
  perna irmã — o que a legada não fazia). `ConciliacaoInteligente` deixa de
  calcular score heurístico no cliente e passa a ranquear pelos candidatos do
  motor. Wrapper `gerarCandidatosConciliacao` em `core/api/conciliacao.api`.
  Score exibido converte 0..1 → 0-100; ao aplicar, volta a 0..1 no
  `conciliacao_ml_feedback`.
- **Deprecação sem DROP**: `reconciliar_transacoes`, `aplicar_conciliacao` e
  `gerar_candidatos_conciliacao` ganham `COMMENT` de DEPRECADA. O DROP fica
  para a **F7**, após garantir que nenhum canal fora do frontend as chama (a
  edge `gerar-sugestoes-ml` ainda usa a pública; migra na F5/F7).
- **`ModoABToggle`**: era código morto (nenhum import) — removido. Não havia
  "motor A × motor B" real a validar; o toggle era só de apresentação de
  sugestão ML.
- **Imutabilidade (reclass)**: `reclass-transacoes` fecha o TODO histórico —
  recusa (HTTP 409 `TRANSACAO_CONCILIADA`) qualquer job cujo alvo contenha
  transação conciliada. Reclassificar exige `fin_desconciliar` antes.
- **Validação**: harness docker — 7 cenários (score 1:1/1:N, corte explícito,
  corte por igreja via config, exclusão de conciliado, isolamento de tenant,
  guarda admin|tesoureiro).

### 9.4 Notas de implementação F5 — ingestão de extratos (fatia 1, jul/2026)

Migration `20260712120000`. Porta única `fin_ingerir_extratos(p_conta_id,
p_origem, p_itens jsonb, p_contexto)` — contrato `ExtratoItem = {data_transacao,
valor, tipo, descricao, external_id?, numero_documento?, saldo?}`.

- **Escopo desta fatia**: só o canal **manual** (OFX/CSV/XLSX — `ImportarExtratosTab`)
  passou pela porta; Santander (`santander-api`), Getnet (`getnet-sftp`) e o
  PIX (novo) migram na fatia 2 (Getnet amarra com a decisão tipo-5 da F6). O
  legado convive: os edges ainda escrevem direto até migrarem.
- **Valor canônico (D-F5)**: a porta grava `valor = abs(valor)`; a direção fica
  em `tipo` (credito/debito). Alinha com `santander-api` e com o motor F4 (que
  compara `e.valor = t.valor`). Só governa nova ingestão; linhas históricas
  assinadas permanecem.
- **Dedupe que fecha o bug do manual**: o canal manual gravava `external_id`
  NULL → reimportar duplicava. Agora o front manda `external_id` = FITID do OFX
  quando há, senão uma chave determinística com **índice de ocorrência**
  (`file:...#n`) — reimportar deduplica, mas dois lançamentos idênticos no mesmo
  arquivo não são descartados. Se o item chega sem `external_id`, a RPC gera
  `auto:md5(...)`. `ON CONFLICT (conta_id, external_id) DO NOTHING` conta
  inseridos × duplicados.
- **Job + undo (padrão reclass)**: `fin_extrato_ingestao_jobs` (1 linha por lote)
  + `extratos_bancarios.import_job_id` (antes nunca populado). `fin_desfazer_
  ingestao(p_job_id)` remove os extratos **não conciliados** do job e **preserva**
  os já conciliados (dinheiro vinculado não some), marcando `desfeito_em`.
- **Segurança**: `SECURITY DEFINER` + `fin_resolver_contexto` (admin|tesoureiro);
  a conta é validada no tenant e no escopo de filial do ator (conta de outra
  filial → `FIN_TENANT`); RLS de leitura no job (admin|tesoureiro + filial);
  escrita só via RPC. Toda ingestão/undo grava em `fin_audit_log`.
- **Edge `gerar-sugestoes-ml`**: trocou `gerar_candidatos_conciliacao` (legada)
  por `fin_gerar_candidatos_conciliacao` (motor único F4). Roda sob o JWT do
  usuário (não service role) → igreja deixa de ser parâmetro. Pré-requisito para
  o DROP das legadas na F7.
- **Validação**: harness docker — 9 cenários (ABS, dedupe por reimport, dedupe
  no lote, origem/tipo inválidos, conta fora do tenant/filial, undo preservando
  conciliado, guarda admin|tesoureiro).

**Fatia 2 (jul/2026, migration `20260712130000`)**: caminho service-role para
adaptadores. Edges autônomas (getnet/pix/santander em service role) não têm ator
humano — **decisão D-F5.2**: `fin_ingerir_extratos` aceita service-role com
`canal='integracao'` **sem `ator_profile_id`**, validando só que a igreja existe
(ingestão é import de dados, não move dinheiro; a autz do canal é da própria edge
via secret/cert); a auditoria registra `canal` + ator NULL. Os caminhos JWT
(usuário) e service-role **com** ator seguem pelo `fin_resolver_contexto` estrito.
O shim `_shared/financeiro-core.ts` ganhou `ingerirExtratos`; **`santander-api`**
migrou o write de extrato para a porta (coleta em lote → `fin_ingerir_extratos`,
`external_id` preservado = providerId/SHA-256; dedupe/preservação de conciliados
a cargo do `ON CONFLICT DO NOTHING`). `getnet-sftp` (amarra F6 tipo-5),
`santander-extrato` (sem caller na UI) e o PIX (novo) ficam para depois. Harness
F5b: 5 cenários (integração sem ator, igreja inexistente, service estrito sem
ator bloqueado, conta fora do tenant, regressão do caminho JWT).

**Fix transversal (migration `20260712121000`)**: `fin_resolver_contexto` (F1,
compartilhada por **todas** as RPCs `fin_*`) bloqueava um usuário `super_admin`
puro — seu gate JWT exigia `has_role(admin) OR has_role(tesoureiro)`, e
`has_role('admin')` cobre `admin_igreja`/`admin_filial` mas **não** `super_admin`
(convenção do resto do código, que sempre checa `super_admin` à parte). Passou
despercebido enquanto nenhuma RPC `fin_*` era porta única; a F5 expôs o gap ao
migrar a importação (antes RLS explicitamente checava `super_admin`) para
`fin_ingerir_extratos`. `CREATE OR REPLACE` amplia o gate (`OR
has_role(super_admin)`), sem alterar mais nada da função. Regressão validada: os
harness F3/F4 completos continuam verdes com a função ampliada.

**RLS de `fin_extrato_ingestao_jobs` reescrita sem `has_filial_access`**: a
policy original usava `has_role('admin') AND has_filial_access(...)` — mas
ambos têm o mesmo atalho global (`has_role('admin')` é satisfeito por
`admin_igreja`/`admin_filial` de **qualquer** igreja, sem checar `igreja_id`),
o mesmo vazamento cross-tenant já corrigido em `v_pode_todas` nas RPCs `fin_*`
(checklist [[feedback-fin-rpc-security-checklist]]). A policy passou a replicar
a mesma lógica: papel amplo recortado por igreja (`admin`/`admin_igreja`/
`super_admin`, igual a `v_pode_todas`) OU papel restrito à filial (`tesoureiro`/
`admin_filial`) da mesma igreja + escopo de filial (própria, job de igreja, ou
grant explícito). **Validação real de RLS** (não só por inspeção): harness
troca para a role `authenticated` via `SET ROLE` (não-superuser, RLS
efetivamente aplicado) — T14 prova que um `admin_igreja` de outra igreja lê
zero jobs desta igreja (vazamento fechado); T14b é o controle positivo (admin
legítimo continua enxergando).

### 9.5 Notas de implementação F5 — Getnet e PIX (jul/2026, fecha a F5)

Sem migration nova — `fin_ingerir_extratos` já cobre `canal='integracao'` sem
ator (D-F5.2) e já tem `getnet_sftp`/`getnet_sftp_txt`/`pix` na allow-list de
`origem` desde a fatia 1/2.

**`getnet-sftp`**: porta mecânica dos dois pontos que escreviam direto em
`extratos_bancarios` — `runSettlementV1` (layout CSV legado, upsert único por
arquivo) e `runExtratoEletronicoV10` (espelha RVs liquidados/LQ do Extrato
Eletrônico v10, um upsert por arquivo dentro do loop multi-arquivo de
`sync`/`import_extrato`). `conta_id` continua vindo de
`integracoes_financeiras.config.sftp.conta_id` (estático por integração, sem
mudança). Client já é service-role em toda a function (`supabaseAdmin`),
então `canal='integracao'` se aplica sem condicional. Comportamento e contrato
de dedupe idênticos ao anterior (`ON CONFLICT (conta_id, external_id)`); só a
persistência passou do upsert direto para a RPC.

**PIX — funcionalidade nova, não um port**: nenhuma tabela PIX tinha
`conta_id` resolvível (`pix_webhook_temp` só carrega `igreja_id`;
`pix_recebimentos`, que tem o FK para `contas`, está órfã/sem nenhum
call-site). A primeira versão tentou reaproveitar o mecanismo do Getnet
(`integracoes_financeiras.config.conta_id`) — **descoberto incorreto por
review**: esse campo **nunca é gravado** para Santander, porque
`IntegracoesCriarDialog.tsx` só monta `config` quando `tipo_auth === 'sftp'`,
e Santander é sempre forçado a `tipo_auth = 'token'` (mTLS). O caminho
`config.conta_id` está morto para PIX/Santander — só existe de fato para o
modo SFTP do Getnet. Corrigido para reaproveitar o mecanismo **real** já usado
em produção para achar "a conta do Santander": `contas.cnpj_banco` casando com
o CNPJ do banco (mesma lógica de `Contas.tsx`, botão "Testar") — em vez de
inventar uma tabela nova ou uma heurística de texto (`formas_pagamento.nome` é
livre, sem slug — `ilike '%pix%'` repetiria o anti-padrão já criticado em §5.3
para `DashboardOfertas`).

- Novo helper `ingerirExtratoPix` (`_shared/financeiro-core.ts`): resolve a
  conta na ordem de precisão que o chamador já tem disponível — **(1)**
  `conta_id` explícito (`cob_pix.conta_id` de uma cobrança vinculada por
  `txid` — um PIX de cobrança pode ter conta diferente da conta Santander
  default); **(2)** fallback: conta(s) ativas (`ativo=true`) da igreja com
  `cnpj_banco` do Santander. Quando a filial é conhecida (`integracao_id`
  informado, ex.: polling), a conta específica dessa filial tem prioridade
  sobre a de nível-igreja — mesmo padrão filial > igreja de
  `financeiro_config.conciliacao_score_minimo` na F4 — sem nunca usar a conta
  de OUTRA filial. **Quando a filial é desconhecida** (ex.: `pix-webhook`, que
  só resolve `igreja_id` via CNPJ e nunca sabe `integracao_id`), considera
  **todas** as contas Santander ativas da igreja, de qualquer filial ou
  nível-igreja — restringir a filial_id NULL neste caso descartaria
  silenciosamente a única conta Santander da igreja sempre que ela estiver
  escopada a uma filial (comum: a UI cria contas por filial fora de "Todas as
  Filiais"). Em qualquer nível, se a conta não puder ser resolvida (nenhuma ou
  mais de uma), **não ingere e não lança** — o registro do PIX em
  `pix_webhook_temp`/`cob_pix` continua funcionando exatamente como antes, só
  o espelho em `extratos_bancarios` fica pendente. Zero regressão no fluxo
  atual. **Validado por teste automatizado real**
  (`financeiro-core.test.ts`, `deno test`) — essa lógica já teve 3 rodadas de
  bug de precisão em review; os 9 casos (incl. o exato cenário do 3º bug)
  travam o comportamento em vez de depender de releitura manual a cada
  rodada.
- Ligado nos **3 pontos** que hoje escrevem em `pix_webhook_temp` (webhook
  push, polling `buscar-pix-recebidos`, polling `buscar_pix` dentro de
  `santander-api` usado pelo cron `buscar-pix-cron`) — os três precisavam ser
  cobertos, senão PIX recebido via webhook apareceria na conciliação e PIX
  recebido via polling (fallback documentado no ADR-028 para quando o webhook
  falha) não apareceria, uma inconsistência dependente do caminho de entrega.
- **Retentativa em duplicata (polling)**: se o `pix-webhook` chega primeiro
  numa igreja com integração por filial, ele não resolve a conta (ambígua
  entre filiais, sem `integracao_id`) e o PIX fica sem espelho. O polling que
  roda depois (`buscar-pix-recebidos`/`santander-api buscar_pix`) via de regra
  trata esse PIX como duplicata em `pix_webhook_temp` e pulava a tentativa —
  mas é justamente esse polling que **sabe** o `integracao_id`. Os dois
  caminhos de polling agora tentam `ingerirExtratoPix` também no ramo de
  duplicata (a busca de `cob_pix` foi movida para antes da checagem de
  duplicata).
- **Sem spam de job/auditoria em duplicata**: a retentativa acima chamaria
  `fin_ingerir_extratos` de novo a cada polling para o MESMO PIX antigo já
  espelhado — e a RPC cria 1 `fin_extrato_ingestao_jobs` + 1 `fin_audit_log`
  por chamada **antes** do dedupe por item (`ON CONFLICT DO NOTHING`), então
  isso acumularia um job/audit por PIX antigo a cada execução do cron.
  `ingerirExtratoPix` agora checa `extratos_bancarios` por
  `(conta_id, external_id)` **antes** de chamar a RPC — se já espelhado,
  retorna sem chamar nada.
- **Pré-requisito operacional**: para o espelho funcionar, a conta bancária do
  Santander precisa ter `cnpj_banco` preenchido (`90400888000142`) — mesmo
  campo que a tela de Contas já exige para habilitar o botão "Testar".
- **Validação**: `deno check` real (não só o app tsc) em todos os arquivos
  tocados nas 3 rodadas de review — limpo em todos após as correções; achou e
  corrigiu 2 bugs reais de tipo (narrowing `string | null` perdido entre
  `.filter()`/`.map()` no getnet; `todas.filter()` sem tipo inferível na
  resolução de conta do PIX).

### 9.6 Notas de implementação F6 — Getnet tipo 5 (jul/2026)

Sem migration nova — `origem='getnet_sftp_tipo5'` já estava na allow-list de
`fin_ingerir_extratos` desde a F5, e `config` de `integracoes_financeiras` é
JSONB livre.

- **Regra de negócio**: lida diretamente no Manual Técnico da Getnet
  (`docs/Manual Extrato Eletronico_V10.1_V6.2024.pdf`, Regra Geral #10,
  pg. 56) — "No Registro Tipo 5 onde houver no tipo de operação 'PG', o valor
  informado no campo valor líquido da operação refere-se a somatória de
  valores livres creditado na conta do estabelecimento." Ou seja: só
  `tipo_operacao === 'PG'` (Pagamento de Agenda Livre) é dinheiro NOVO
  batendo na conta; os demais tipos (CS/CF/AC/CL/GL/GF/AL) são liquidação
  contábil de dinheiro já adiantado numa data anterior (contratos de
  cessão/antecipação/gravame). Confirmado por exemplo numérico do próprio
  manual (pg. 44-45): tipo 1 LQ do dia soma 2000-900-500=600; tipo 5 do
  mesmo dia mostra CL 900 + AL 500 + PG 600, onde só o PG bate com o líquido
  real do dia. Mirar em PG é estritamente mais preciso que o LQ anterior, que
  misturava dinheiro real com ajustes contratuais.
- **Dedupe (2 rodadas de fix P2, review PR #52)**: o manual (pg. 38) afirma
  que "Para Tipo de operação PG, não há Número da Operação" —
  `numero_operacao` pode vir vazio para PG. A 1ª versão usava
  `arquivoNome:linhaNum` como chave — **rodada 1**: isso amarra o dedupe ao
  nome do arquivo de transporte; se a Getnet reenviar/reprocessar o mesmo
  dia sob outro nome, `getnet_arquivos` (chave `arquivo_nome`) trata como
  arquivo novo e o crédito passa batido pelo
  `ON CONFLICT (conta_id, external_id)`. Trocado por `integracaoId` +
  campos de conteúdo — mas **rodada 2**: `integracao_id` também é frágil
  (excluir/recriar a integração SFTP para a MESMA conta bancária muda
  `integracao.id` sem mudar `conta_id`, que é o que o dedupe realmente
  escopa). Versão final usa **só** campos de conteúdo/provedor da linha —
  `getnet_fin5:${data}:${codigoArranjo}:${chaveUr}:${valor}` — com fallback
  de `chaveUr` para `numeroOperacao` se vier vazia. `chave_ur` é preenchida
  para PG (o manual só confirma que `numero_operacao` não é) e já é ela
  mesma um composto determinístico (Regra Geral #11: data de liquidação +
  código de arranjo + CNPJ/CPF) — mesmo padrão do path tipo 1 legado
  (`getnet_rv:${rv}:${dataRv}:LQ`), que nunca dependeu de arquivo nem de
  integração. Função pura `selecionarEspelhoTipo5` em
  `getnetExtratoParser.ts`, testada em `getnetExtratoParser.test.ts` (mesmo
  padrão do `resolverContaPix` da F5), incluindo os dois cenários de
  reenvio (nome de arquivo diferente, integração recriada).
- **Opt-in por integração**: chave `espelho_tipo5_desde` (data) no nível raiz
  de `integracoes_financeiras.config` (irmã de `sftp`, não aninhada nele —
  sobrevive ao merge raso da edge `integracoes-config`). Sem essa data, a
  integração mantém o tipo 1 (LQ) — zero regressão. Com a data setada,
  arquivos com `data_referencia >= espelho_tipo5_desde` passam a espelhar do
  tipo 5 (PG); arquivos anteriores ao corte continuam no tipo 1. Campo de UI
  em `IntegracoesCriarDialog.tsx`, visível só quando o layout SFTP é
  `extrato_eletronico_v10` (o `settlement_v1` legado não emite registro
  tipo 5). Sem backfill nesta fase (roadmap já previa como opcional).
- `getnet_resumo`/`getnet_analitico`/`getnet_ajustes`/`getnet_financeiro_resumo`/
  `getnet_financeiro_detalhe` (tabelas cruas) continuam sendo gravadas
  exatamente como antes — só a FONTE do espelho em `extratos_bancarios` muda;
  tipo 1 vira puramente analítico/drill-down, como já prescrito pela D5.
- **Origem do espelho trava por arquivo (fix P1, review PR #52)**: como a
  decisão tipo1×tipo5 compara `data_referencia` do arquivo contra
  `espelho_tipo5_desde`, um arquivo já importado (espelho tipo 1,
  `external_id` `getnet_rv:...`) reprocessado manualmente (`import_extrato`
  com `arquivo_nome`) DEPOIS de o operador setar/mudar um corte retroativo
  passaria a gerar `external_id` `getnet_fin5:...` — o dedupe
  `(conta_id, external_id)` não reconhece os dois como o mesmo crédito e
  duplicaria o valor. Migration `20260713140000` adiciona
  `getnet_arquivos.espelho_origem` (nullable); a origem usada na 1ª
  importação de um arquivo trava para sempre nos reprocessamentos seguintes,
  ignorando a config atual. `NULL` (arquivo importado antes desta coluna
  existir, ou seja, antes da F6) conta como tipo 1. Função pura
  `resolverUsoTipo5` em `getnetExtratoParser.ts` (3 estados: nunca
  importado → decide pela config; travado em tipo1 [incl. `NULL` legado];
  travado em tipo5).
- **Validação**: `deno check` + `deno test` em `getnetExtratoParser.ts`/
  `index.ts` (14 casos: 9 de `selecionarEspelhoTipo5` — PG sem
  numero_operacao, duas linhas PG com chave/valor distintos, todas as
  operações não-PG filtradas fora, reimportação gera external_id idêntico,
  **mesmo PG sob nome de arquivo diferente gera external_id idêntico (fix
  P2 rodada 1)**, **assinatura não aceita integracao_id (fix P2 rodada 2)**,
  fallback de `chaveUr` para `numeroOperacao`, fallback de data, linha sem
  nenhuma data descartada — + 5 de `resolverUsoTipo5`, incluindo o cenário
  exato do P1: arquivo legado com `espelho_origem NULL` trava em tipo 1
  mesmo com corte retroativo cobrindo a data). `npx tsc` mantém os 62
  erros pré-existentes catalogados desde a F5, zero novos.

### 9.7 Notas de implementação F7 — revogação de escrita direta (jul/2026)

Três migrations (`20260713141000`, `20260713150000`, `20260713160000`, todas
jul/2026, mesma leva de trabalho). Fecham **só a sub-frente (1)** do roadmap F7
("revogar escrita direta do role `authenticated`") — **agora completa: as 7
tabelas do domínio revogadas** — as outras 4 (decompor telas de conciliação,
bottom-nav, DRE mobile, limpeza de código morto genérica) permanecem pendentes
e não foram tocadas nesta fatia.

A sub-frente foi entregue em duas rodadas: a 1ª (`20260713141000`) revogou as 5
tabelas já 100% migradas e tratou as RPCs legadas; a auditoria daquela rodada
encontrou call-sites de escrita direta ainda vivos em
`transacoes_financeiras`/`extratos_bancarios` e deixou as duas de fora do
`REVOKE` (não revogar coisa que quebraria produção). A 2ª rodada
(`20260713150000` + `20260713160000`) migrou esses call-sites para RPCs `fin_*`
(duas novas) e só então estendeu o `REVOKE` às duas tabelas restantes.

**Auditoria (passo obrigatório antes de qualquer `REVOKE`)**: grep exaustivo por
`.insert(`/`.update(`/`.delete(`/`.upsert(` encadeado em `.from(<tabela>)` nas 7
tabelas do CORE (`transacoes_financeiras`, `transferencias_contas`,
`extratos_bancarios`, `conciliacoes_lote`, `conciliacoes_lote_extratos`,
`conciliacoes_divisao`, `conciliacoes_divisao_transacoes`), em `src/**` e
`supabase/functions/**`, fora de `core/api/`. Resultado — **não** o que as notas
das fases anteriores sugeriam por analogia; precisou ser confirmado call-site a
call-site:

- **100% migradas → `REVOKE INSERT, UPDATE, DELETE` de `authenticated, anon`
  aplicado**: `transferencias_contas`, `conciliacoes_lote`,
  `conciliacoes_lote_extratos`, `conciliacoes_divisao`,
  `conciliacoes_divisao_transacoes`. Zero `.insert/.update/.delete` diretos
  restantes fora das RPCs `fin_*` (confirmado em `src/` e
  `supabase/functions/**`).
- **1ª rodada: deixadas de fora, depois migradas na 2ª rodada e revogadas
  (`20260713160000`)**: `transacoes_financeiras` e `extratos_bancarios`
  tinham escrita direta viva no **frontend** (rodando como `authenticated`
  via PostgREST/JWT — não `service_role`, que não é afetado por este
  `REVOKE`). Achados originais: gerenciamento de conciliação manual fora do
  fluxo migrado nas fases anteriores (`TransacaoActionsMenu.
  handleToggleConferidoManual`, `TransacaoDetalheDrawer.handleSave`,
  `VincularTransacaoDialog.handleVincular`, `QuickCreateTransacaoDialog`,
  `HistoricoExtratos.handleIgnorar/handleReativar/handleDesvincular`,
  `ConciliacaoManual.handleIgnorar`, `DashboardConciliacao.handleIgnorar`,
  marcação `conciliado_manual` em `ConciliacaoInteligente`); e criação direta
  de lançamento fora do CORE (`ImportarTab`/`ImportarFinancasPage` — insert em
  lote de lançamentos do Excel/CSV; `MeusCursos`, `InscricoesTabContent` e
  `AdicionarInscricaoDialog` — criam a transação de pagamento de
  inscrição/curso direto). **Todos os 13 call-sites foram migrados** para RPCs
  `fin_*` (existentes ou 2 novas — ver abaixo) antes do `REVOKE` de
  `20260713160000`. Reauditoria pós-migração: zero `.insert/.update/.delete`
  vivo restante nessas 2 tabelas fora de `core/api/`, exceto
  `ImportarExcelDialog.tsx`/`ImportarExcelWizard.tsx` — **código morto
  confirmado** (nenhuma rota/tela importa esses componentes; superados por
  `ImportarTab`/`ImportarFinancasPage`), não removidos (limpeza de código
  morto genérica é a frente 5/5, fora de escopo desta fatia).
- **`supabase/functions/**` não bloqueia o REVOKE em nenhuma tabela**: os únicos
  edges que ainda escrevem direto nessas tabelas (`getnet-sftp` em
  `extratos_bancarios`, `santander-extrato` em `extratos_bancarios`,
  `reclass-transacoes`/`undo-reclass`/`undo-import` em `transacoes_financeiras`)
  usam `SUPABASE_SERVICE_ROLE_KEY` para o client de escrita — rodam como
  `service_role`, não como `authenticated`, e portanto não são afetados por este
  `REVOKE` (mesmo continuando a violar a "regra de ouro" arquitetural — débito
  já conhecido, fora de escopo desta fatia).

**RPCs legadas (mesma migration)**: `reconciliar_transacoes`,
`aplicar_conciliacao` e `gerar_candidatos_conciliacao` — deprecadas via
`COMMENT` na F4 — tiveram seus call-sites reconfirmados: **zero** vivos em
`src/**`/`supabase/functions/**` (a edge `gerar-sugestoes-ml` já chama
`fin_gerar_candidatos_conciliacao`, o motor único, desde a F5 — confirmado lendo
o corpo do arquivo, o comentário de cabeçalho é que ficou desatualizado). As 3
foram **DROPadas**. Achado extra da mesma auditoria: `aplicar_sugestao_conciliacao`
(mesma categoria de risco — `SECURITY DEFINER` escrevendo direto em
`extratos_bancarios`/`transacoes_financeiras`/`conciliacoes_lote`) só tinha um
call-site, em `src/components/financas/SugestoesML.tsx` — componente **órfão**
(sem import em nenhuma rota/tela). Tratada junto, mesmo não estando nos 3 nomes
originais do roadmap, por ser a mesma categoria de risco e ter zero uso real.
`rejeitar_sugestao_conciliacao` **não** entrou — segue com call-site vivo em
`ConciliacaoInteligente.tsx`.

Descoberta relevante no histórico de migrations: `aplicar_conciliacao` teve
**duas assinaturas** ao longo do tempo (`(uuid, uuid)` na criação original,
`(uuid, uuid, text, integer, uuid)` a partir de 20260203172530) sem nenhum
`DROP FUNCTION` explícito no meio — plausível que os dois overloads coexistissem
no schema real. A migration não assume a assinatura; itera `pg_proc` por
`proname` e faz `DROP FUNCTION` de **todo** overload encontrado, blindando
contra o risco de drift schema real × migrations já registrado no §11.

**Por que revogar de `authenticated` não quebra as RPCs `fin_*`**: todas são
`SECURITY DEFINER`, de propriedade do role que roda as migrations (mesmo dono
de todo o resto do schema, com privilégio pleno de escrita) — o corpo da
função roda com o privilégio do **dono**, não do chamador. Confirmado (não
assumido) lendo cada `CREATE OR REPLACE FUNCTION` das migrations
`20260710120000`/`20260710123000`/`20260711140000`/`20260711150000`/
`20260712120000`/`20260712130000`: todas `SECURITY DEFINER`, todas com `GRANT
EXECUTE ... TO authenticated, service_role` explícito.

**Validação — harness docker (postgres:15 real)**: réplica de todas as
migrations `fin_*` (F1-F5) + stubs das 4 RPCs legadas (assinaturas reais) +
simulação do bootstrap padrão Supabase (`GRANT ALL ON ALL TABLES` para
`anon`/`authenticated`/`service_role`, já que hoje esse é o estado real em
produção) + a migration desta fase. Diferente das fases anteriores, o teste
usa `SET ROLE authenticated` (não apenas `postgres` superuser) nos dois lados:

- **Ataque** (authenticated, escrita direta): `INSERT`/`UPDATE`/`DELETE` direto
  em cada uma das 5 tabelas revogadas → `insufficient_privilege` (permission
  denied) em todos os 5 casos; chamar cada uma das 4 RPCs legadas (incluindo os
  2 overloads de `aplicar_conciliacao`) → `undefined_function` (não existem
  mais) nos 5 casos.
- **Controle positivo** (authenticated, via RPC): `fin_criar_lancamento`,
  `fin_alterar_status_lancamento`, `fin_criar_transferencia`,
  `fin_ingerir_extratos`, `fin_confirmar_conciliacao`, `fin_desconciliar`,
  `fin_gerar_candidatos_conciliacao`, `fin_desfazer_ingestao` — todas chamadas
  com `SET ROLE authenticated` de verdade (não como superuser) e todas
  funcionando normalmente, incluindo gravar de fato na tabela revogada
  (`fin_criar_transferencia` grava em `transferencias_contas` mesmo com
  `authenticated` sem `INSERT` direto nela).
- **`service_role`**: `INSERT` direto em `transferencias_contas` (a mesma tabela
  do teste de ataque) continua funcionando sem erro.

Todos os cenários da 1ª rodada batidos. Typecheck: 0 erros novos (baseline de
62 pré-existentes em Dashboard/Insights/outros, não relacionados).

**2ª rodada — migração dos call-sites e fechamento do REVOKE**: para cada
call-site, a regra foi checar se uma RPC `fin_*` **já existente** cobria a
operação antes de criar uma nova:

- **RPC existente reaproveitada** (nenhuma mudança de schema):
  `fin_atualizar_lancamento` (`TransacaoDetalheDrawer.handleSave` — os campos
  valor/taxas/juros/multas/desconto/valor_liquido já estavam no `p_patch`
  permitido); `fin_confirmar_conciliacao` (`VincularTransacaoDialog.
  handleVincular` — troca uma sequência manual de 3 updates pelo 1:1 transacional,
  ganhando de brinde a baixa `pendente→pago` que o fluxo antigo não fazia;
  `QuickCreateTransacaoDialog` — fecha o TODO deixado desde a F3 "vínculo
  permanece direto até a F3"); `fin_desconciliar` (`HistoricoExtratos.
  handleDesvincular`, ramo com vínculo — trocou a chamada pelo **nome antigo**
  `desconciliar_transacao`, que fica sem call-site vivo a partir daqui, mas
  não foi tocada nesta fatia — não é uma das RPCs nomeadas para `DROP`);
  `fin_criar_lancamento` (`MeusCursos`, `InscricoesTabContent`,
  `AdicionarInscricaoDialog` — inserts pontuais de transação de pagamento; e
  `ImportarTab`/`ImportarFinancasPage` — o `INSERT` em lote virou um
  `fin_criar_lancamento` **por linha**, dentro do mesmo loop de chunks;
  ganho colateral: isola erro por linha — antes uma linha ruim rejeitava o
  `INSERT` inteiro do chunk, até 100 linhas; `tipo_lancamento: "avulso"`, um
  valor usado só nesses 2 pontos sem nenhum outro consumidor, foi normalizado
  para `"unico"`, o vocabulário canônico da RPC; status `"cancelado"`, não
  aceito na criação (só `pendente|pago`), cria como pendente e transiciona via
  `fin_alterar_status_lancamento`).
- **RPC nova — nenhuma existente cobria a operação**:
  - `fin_alternar_conferencia_manual(p_id, p_conferido, p_contexto)`: toggle de
    `conferido_manual` + `conciliacao_status` (`nao_conciliado`↔
    `conciliado_manual`) **sem extrato correspondente** (dinheiro conferido em
    caixa) — `fin_confirmar_conciliacao` não serve porque exige sempre
    `extrato_ids` não vazio. Sincroniza a perna irmã de transferência (mesmo
    padrão de `fin_confirmar_conciliacao`). Usada por
    `TransacaoActionsMenu.handleToggleConferidoManual` (toggle nos dois
    sentidos) e `ConciliacaoInteligente` (marcar, um sentido só).
  - `fin_marcar_extrato_ignorado(p_extrato_id, p_ignorado, p_contexto)`:
    toggle de `extratos_bancarios.reconciliado` para um extrato **sem nenhum
    vínculo de conciliação** ("ignorar"/"reativar" ruído do extrato) —
    `fin_ingerir_extratos`/`fin_desfazer_ingestao` são sobre criação em lote,
    não alternância pontual de uma flag. Usada por `HistoricoExtratos`
    (`handleIgnorar`/`handleReativar`/`handleDesvincular` no ramo sem
    vínculo), `ConciliacaoManual.handleIgnorar` e `DashboardConciliacao.
    handleIgnorar`.

  Checklist de segurança (§7.2) aplicado às duas: `SECURITY DEFINER` +
  `fin_resolver_contexto` (mesmo gate admin|tesoureiro no JWT / `p_contexto`
  estrito no service role das demais RPCs `fin_*`); escopo por `igreja_id` via
  `FOR UPDATE ... WHERE id = $1 AND igreja_id = $2` (mesmo padrão de
  `fin_atualizar_lancamento`/`fin_alterar_status_lancamento`/
  `fin_desconciliar` — não há seleção de filial nem candidatos multi-linha
  numa RPC de alternância pontual por id, então o item do checklist sobre
  CTE/`p_filial_id` não se aplica aqui); imutabilidade D4 (bloqueiam alternar
  quando já há conciliação real via extrato/bot ou lote/divisão — fecha um
  estado *dangling* que o fallback antigo do frontend podia produzir, já que
  ele limpava `reconciliado` sem checar lote/divisão antes); auditoria em
  `fin_audit_log`; `GRANT EXECUTE ... TO authenticated, service_role` +
  `REVOKE ALL ... FROM anon` explícitos no fim da migration.

**Reauditoria + REVOKE final (`20260713160000`)**: com os 13 call-sites
migrados, `transacoes_financeiras` e `extratos_bancarios` entraram no mesmo
`REVOKE INSERT, UPDATE, DELETE ... FROM authenticated, anon` das outras 5 —
as 7 tabelas do domínio agora enforçam a "regra de ouro" do §7.1 no banco, não
só por convenção de código.

**Validação da 2ª rodada — harness docker**: mesma réplica de migrations +
stubs, com as 2 migrations novas aplicadas por cima. `SET ROLE authenticated`
nos dois lados de novo:

- **Ataque**: `INSERT`/`UPDATE`/`DELETE` direto em `transacoes_financeiras` e
  `extratos_bancarios` como `authenticated` → `insufficient_privilege` nos 5
  casos (as 5 tabelas da 1ª rodada continuam bloqueadas — sem regressão).
- **Controle positivo**: `fin_alternar_conferencia_manual` (marcar e
  desmarcar) e `fin_marcar_extrato_ignorado` (ignorar e reativar) chamadas
  como `authenticated` de verdade, com efeito real confirmado nas tabelas
  agora revogadas.
- **Guardas D4-like**: `fin_marcar_extrato_ignorado` recusa extrato já
  vinculado 1:1 (`FIN_CONCILIADO`); `fin_alternar_conferencia_manual` recusa
  lançamento já `conciliado_extrato` (`FIN_CONCILIADO`).
- **`service_role`**: `INSERT` direto em `transacoes_financeiras` continua
  funcionando sem erro.

Todos os cenários das duas rodadas (17 no total) batidos. Typecheck: 0 erros
novos (baseline 62) — confirmado a cada commit incremental (migração feita
call-site por call-site, não num único commit monolítico).

### 9.8 Notas de implementação F7 — decomposição/responsivo (sub-frente 2/5, jul/2026)

Sub-frente **em andamento** (não completa): dos 4 alvos listados em §3.4/§6.3
(`ConciliacaoInteligente.tsx`, `Reconciliacao.tsx`, `ConciliacaoManual.tsx` +
`DashboardConciliacao.tsx`, `HistoricoExtratos.tsx`), esta rodada entregou os
dois primeiros — na ordem de prioridade que o próprio §6.3 já apontava
("`ConciliacaoInteligente.tsx:841` — crítico... inutilizável em celular").
Os outros dois ficam para uma próxima rodada.

**`ConciliacaoInteligente.tsx` (item crítico)**: 1033 l., duas colunas fixas
lado a lado + coluna central `w-32` sem nenhuma classe responsiva/`isMobile`
— decomposto e movido para `src/features/financeiro/conciliacao/`, espelhando
o padrão que a F2 já aplicou em `TransacaoDialog` (§6.2, "o mais bem adaptado"
do módulo: `useIsMobile` + layout mobile dedicado + barra de ações fixa no
rodapé + grids `md:grid-cols-2`):

- `hooks/useConciliacaoInteligente.ts`: toda a lógica de dados/mutações
  (3 queries — extratos/transações/candidatos do motor F4 —, filtros
  derivados, `confirmarConciliacao`/`marcarConferenciaManual`/
  `rejeitarSugestao`). Extraída **preservando as query keys originais**
  (`extratos-pendentes-inteligente`, `transacoes-pendentes-inteligente`,
  `candidatos-motor-inteligente`, `contas-conciliacao`,
  `transacoes-conciliacao`) — de propósito: `QuickCreateTransacaoDialog`
  invalida as duas primeiras e `ConciliacaoManual` compartilha
  `transacoes-conciliacao`; renomear teria quebrado invalidação cross-file
  silenciosamente.
- `components/`: `ExtratoPainel`+`ExtratoListItem` (painel "Banco"),
  `TransacaoPainel`+`TransacaoListItem` (painel "Sistema"),
  `ConciliacaoInteligenteFiltros` (busca/conta/tipo/regenerar sugestões ML),
  `ConciliacaoInteligenteBalanco` (resumo Banco×Sistema×Diferença + botão
  Confirmar — **2 variantes visuais da mesma lógica**: `sidebar` replica a
  coluna vertical fixa original no desktop, `footer` é uma barra compacta
  fixa no rodapé para o mobile).
- `ConciliacaoInteligente.tsx` (orquestrador, 203 l.): `useIsMobile` decide o
  layout. **Desktop (≥768px)**: mantém os 3 painéis lado a lado
  (`h-[calc(100vh-320px)]`) idêntico ao original. **Mobile**: os dois painéis
  viram abas — reaproveitando o padrão de `Tabs`/`TabsList` já usado em
  `ConciliacaoManual:552` (a direção que o §6.5 já mandava seguir, não uma
  escolha nova) — com contadores no rótulo (`Banco (N)` / `Sistema (N)`); o
  resumo/confirmar usa a variante `footer`, sempre visível **independente da
  aba ativa** (mesmo padrão de rodapé fixo do `TransacaoDialog`) porque a
  confirmação depende de seleção nos dois lados ao mesmo tempo — escondê-lo
  atrás de uma aba obrigaria o usuário a alternar só para ver se pode
  confirmar. Aceitar uma sugestão ML no mobile troca automaticamente para a
  aba "Sistema" (a transação sugerida já vem selecionada, então faz sentido
  o usuário já ver onde ela caiu).

**`Reconciliacao.tsx` (item 2, §6.3)**: `TabsList` com `grid grid-cols-5`
fixo esmagava os rótulos das 5 abas abaixo de ~640px. **Decisão de scroll
horizontal vs `<Select>`** (o doc deixava em aberto): procurado por outro
`TabsList` do app com tratamento responsivo para muitas abas — não existe
nenhum precedente direto (`EscalaDetailsSheet`/`EventoDetalhes` lidam com
2-4 abas via `flex-1`/`flex-wrap`, não scroll). Optamos por **scroll
horizontal** (`overflow-x-auto` + `flex w-max`, virando `grid` só a partir de
`sm:`) em vez de `<Select>` por ser o padrão recomendado pelo próprio
Radix/shadcn para "abas demais": preserva a semântica nativa de `Tabs`
(navegação por teclado, ARIA `tablist`/`tab`) sem precisar sincronizar um
`<Select>` controlado à parte — que duplicaria estado por pouco ganho real
com apenas 5 itens (um `<Select>` faria mais sentido com muito mais opções,
onde a rolagem horizontal deixasse de ser prática).

**Estrutura de pastas** (§7.3): primeira ocupação de
`src/features/financeiro/conciliacao/` — reaproveita `core/api`,
`core/hooks` já existentes (nenhuma duplicação; a única lógica nova é
específica da tela e mora em `conciliacao/hooks/`, não em `core/`).

**Verificação visual**: não há ferramenta de browser/screenshot disponível
neste ambiente (conferido via busca de ferramentas antes de começar) — a
adaptação responsiva foi validada por leitura de código/classes Tailwind e
por paridade com o padrão já em produção do `TransacaoDialog`, **não** por
inspeção visual real em viewport 375px/768px. Fica pendente uma conferência
manual antes de abrir a PR.

**Pendente para a próxima rodada da sub-frente 2/5**: `ConciliacaoManual.tsx`
(1037 l.) já usa `Tabs` para alternar "Por Extrato"/"Por Transação" em
qualquer viewport (não tem o problema de colunas fixas do `ConciliacaoInteligente`),
mas ainda é monolítico e concentra bastante lógica que poderia compartilhar
componentes com `DashboardConciliacao.tsx` (853 l., mesmo domínio do motor
único F4) — decompor os dois juntos faz sentido, como o item 3 já
antecipava. `HistoricoExtratos.tsx` (865 l.) já foi tocado na sub-frente 1
(migração de RPC) e acompanha o mesmo domínio; decomposição/responsivo ficam
para quando o tempo permitir, sem prioridade sobre os outros.

### 9.9 Notas de implementação F7 — decomposição/responsivo (sub-frente 2/5, continuação — itens 3-4, jul/2026)

Continuação do §9.8: itens 3 (`ConciliacaoManual` + `DashboardConciliacao`) e
4 (`HistoricoExtratos`) do roadmap de decomposição. Com isso, a sub-frente
2/5 fica **quase completa** — só falta a decomposição plena de
`HistoricoExtratos` em subcomponentes (recebeu apenas ajuste responsivo
nesta rodada, ver abaixo).

**Item 3 — `ConciliacaoManual.tsx` (1037 l.) + `DashboardConciliacao.tsx`
(853 l.)**: mesmo domínio (motor único F4 — `fin_gerar_candidatos_conciliacao`
+ `fin_confirmar_conciliacao`), decompostos juntos para
`src/features/financeiro/conciliacao/`. Diferente do `ConciliacaoInteligente`,
nenhuma das duas telas tinha o problema crítico de colunas fixas — ambas já
usavam padrões responsivos razoáveis (`ConciliacaoManual` já alternava as
duas visões via `Tabs`; `DashboardConciliacao` já usava
`grid-cols-2 md:grid-cols-4`/`grid-cols-1 lg:grid-cols-3`). O trabalho foi
sobretudo decomposição + eliminação de duplicação real encontrada entre as
duas:

- **Compartilhado de verdade** (extraído primeiro, antes de decompor cada
  tela): `hooks/useAutoReconciliar.ts` — a lógica de "Reconciliar Automático"
  (dedupe extrato↔transação 1:1 + loop de aplicação via
  `fin_confirmar_conciliacao` + montagem do `MatchResult[]`) estava duplicada
  quase linha a linha nas duas telas; só a *busca* de candidatos (janela de
  datas, lista de contas) genuinamente difere, então fica a cargo de cada
  tela via callback (`buscarCandidatos`). `hooks/useConciliacaoDialogs.ts` +
  `components/ConciliacaoDialogs.tsx` — estado e render dos 4 diálogos
  secundários (vincular 1:1, dividir 1:N, lote N:1, resultado), também
  quase idênticos nas duas telas. `model/types.ts` —
  `ExtratoItem`/`TransacaoConciliacao`/`ContaConciliacao` (não reaproveita os
  tipos de `useConciliacaoInteligente`: aquela tela busca colunas adicionais
  que aqui não existem — unificar criaria acoplamento artificial).
- **Não forçado**: as duas telas continuam orquestradores **separados**
  (`ConciliacaoManual.tsx`, `DashboardConciliacao.tsx`) — os propósitos
  divergem o bastante (uma é o modo clássico com abas paginadas por extrato/
  transação; a outra é um dashboard com stats + ações recentes + sugestões
  inline) para não valer a pena forçar um componente-mãe comum além dos
  hooks/tipos já listados.
- `ConciliacaoManual`: `hooks/useConciliacaoManualData.ts` (queries/filtros/
  paginação das 2 abas — mesmas query keys originais:
  `extratos-pendentes`, `transacoes-conciliacao`, `transacoes-ja-vinculadas`,
  `contas-conciliacao`) + `components/manual/`: `ManualFiltrosBar`
  (as duas abas tinham a mesma barra de filtros quase idêntica —
  parametrizada por `tipoOptions` em vez de duplicada), `ExtratoManualCard`,
  `TransacaoManualCard`, `PaginacaoCompacta` (a paginação também estava
  duplicada *dentro do próprio arquivo*, entre as duas abas).
- `DashboardConciliacao`: `hooks/useDashboardConciliacaoData.ts` (as 5
  queries + `fetchSugestoes1x1`/`periodoDosExtratos`, helpers do arquivo
  original — mesmas query keys: `contas-dashboard`, `reconciliacao-stats`,
  `extratos-pendentes-dashboard`, `transacoes-dashboard`, `audit-logs-recent`,
  `sugestoes-match`) + `components/dashboard/`: `ConciliacaoStatsCards`,
  `AcoesRecentesCard`, `PendentesCard` + `PendenteExtratoCard`. Nuance de
  escala: `fetchSugestoes1x1` devolve score 0-100 (usado para exibir a
  sugestão inline no card), mas `useAutoReconciliar` espera 0..1 (escala
  nativa da RPC) — `buscarCandidatosAutoReconciliar` faz a conversão de volta
  antes de entregar ao hook compartilhado, em vez de alterar a escala de
  exibição já em uso.
- **Escrita direta**: nenhuma encontrada para migrar em nenhuma das duas
  telas — ambas já usam só RPCs `fin_*` desde a F4, como esperado (a F7
  frente 1 tinha revogado exatamente as tabelas que essas RPCs escrevem).

**Item 4 — `HistoricoExtratos.tsx` (865 l.)**: prioridade menor, conforme o
roadmap já registrava. Diagnóstico: os itens da lista (`renderExtratoItem`)
já eram responsivos (`flex flex-col md:flex-row`) e os cards de estatística
já usavam grid responsivo — **não** tinha o problema crítico de
`ConciliacaoInteligente`. O que precisava de ajuste era a barra de filtros
(6 controles com largura fixa em px, formando várias linhas de "chips"
apertados abaixo de ~375px) e a linha de paginação (rótulo + controles
espremidos lado a lado). Aplicado **só o ajuste responsivo pontual, sem
decomposição em subcomponentes/hook** — os filtros passam a ocupar um grid
de 2 colunas full-width no mobile (`sm:contents` devolve o layout original
em linha única com wrap a partir de `sm:`) e a paginação empilha em coluna
no mobile. A migração de RPC da sub-frente 1
(`fin_marcar_extrato_ignorado`/`fin_desconciliar`) não foi tocada.
**Pendente**: decomposição completa (hook de dados + subcomponentes, mesmo
padrão de `ConciliacaoManual`) fica para uma rodada futura — o arquivo
continua em `src/components/financas/HistoricoExtratos.tsx` (não movido para
`features/financeiro/conciliacao/` nesta rodada, já que não houve
decomposição estrutural).

**Débito nomeado — dialogs do domínio ainda em `components/financas/`**: os
orquestradores decompostos importam de `src/components/financas/` vários
componentes que pertencem conceitualmente ao domínio conciliação —
`QuickCreateTransacaoDialog`, `VincularTransacaoDialog`,
`ExtratoDetalheDrawer`, `ConciliacaoLoteDialog`, `DividirExtratoDialog`,
`ResultadoReconciliacaoDialog`, `TransacaoActionsMenu`,
`TransacaoDetalheDrawer` — além do próprio `HistoricoExtratos.tsx`. Coerente
com o strangler fig (mesmo precedente da F2; sem violação da regra
módulo→módulo do §7.3), mas fica registrado como a lista concreta da próxima
rodada de migração para `features/financeiro/`, para não precisar ser
redescoberta.

**Verificação visual**: mesma ressalva do §9.8 — sem ferramenta de
browser/screenshot disponível neste ambiente; validado só por revisão de
código/classes Tailwind, não por inspeção visual real. Pendente conferência
manual antes da PR.

### 9.10 Notas de implementação F7 — frentes 3, 4 e 5 (bottom-nav, DRE mobile, código morto, jul/2026)

Fecha as 3 frentes restantes do roadmap F7. Com isso, **as 5 frentes da F7
estão endereçadas** — a única pendência remanescente é a decomposição
completa de `HistoricoExtratos.tsx` em subcomponentes (§9.9), tratada com
ajuste responsivo mínimo por decisão explícita de escopo (prioridade baixa).

**Frente 5 — limpeza de código morto**: auditoria restrita ao módulo
financeiro (`src/components/financas/`, `src/features/financeiro/`,
`src/pages/financas/`) por arquivos sem nenhuma referência em `src/`
(grep do nome de cada componente, excluindo a própria definição — a mesma
técnica usada para confirmar código morto nas sub-frentes 1/5 e 2/5).
**14 arquivos removidos** (4786 linhas): os 2 já documentados como órfãos
na frente 1 (`ImportarExcelDialog.tsx`, `ImportarExcelWizard.tsx`,
superados por `ImportarTab`/`ImportarFinancasPage`) e `SugestoesML.tsx`
(único call-site de `aplicar_sugestao_conciliacao`, já `DROP`ada); mais 11
achados nesta varredura — `FornecedorDialog`/`CentroCustoDialog`/
`SubcategoriaDialog`/`FormaPagamentoDialog`/`BaseMinisterialDialog.tsx`
(confirmado que `Fornecedores.tsx`/`CentrosCusto.tsx`/etc. implementam o
próprio dialog inline via `ResponsiveDialog`, não usam mais os componentes
extraídos), `ProcessarNotaFiscalDialog.tsx` (a funcionalidade de OCR
continua viva, chamada direto da edge `processar-nota-fiscal` por
`TransacaoDialog.tsx`/`Reembolsos.tsx` — só este componente específico
ficou órfão), `SincronizacaoTransferenciasWidget.tsx` (nenhum caller
restante da edge `sync-transferencias-conciliacao` — provavelmente
superado pelo sincronismo automático de perna irmã já embutido em
`fin_confirmar_conciliacao`/`fin_alternar_conferencia_manual`),
`ExtratoSugestaoMLB.tsx` (variante "B" órfã — `ExtratoSugestaoMLA` é a
usada; mesma família do `ModoABToggle` já removido na F4),
`ReconciliacaoBancaria.tsx`/`TransacaoFiltros.tsx`/
`TransacaoVinculadaDialog.tsx` (sem caller identificável). Confirmação
adicional: typecheck sem nenhum erro "cannot find module" após a remoção.
**Fora de escopo, só registro**: `supabase/functions/
sync-transferencias-conciliacao` ficou sem nenhum caller frontend
identificado após a remoção do widget — não é código do módulo financeiro
frontend, não foi tocado (limpeza de edge functions é outra frente).

**Frente 3 — Finanças no bottom-nav**: `MobileNavbar.tsx` ganha um item
"Finanças" (ícone `DollarSign`, rota `/financas`) condicionado à mesma
permissão que a `Sidebar` já usa para mostrar/esconder a seção
("financeiro.view", via `checkPermission`) — segue o padrão condicional já
existente no arquivo (Pessoas vira Perfil se `!hasPessoasAccess`) em vez de
inventar um mecanismo novo. Quem não tem acesso ao financeiro continua
vendo exatamente os 5 itens de sempre, tamanho inalterado — zero mudança
visual. Quem tem acesso vê 6 ícones; para não apertar em telas estreitas
(~360-375px), ícone/padding/label reduzem levemente só quando há mais de 5
itens (`24px→22px`, `p-1.5→p-1`, `text-[10px]→text-[9px]`) — nenhum item
existente foi removido ou reordenado, "Finanças" entra entre Pessoas/Perfil
e Menu. Decisão sem alternativa avaliada (o roadmap deixava em aberto
"bottom-nav OU atalho contextual"; a direção de seguir com bottom-nav
condicional foi definida pelo usuário para não gastar mais uma rodada de
pergunta) — fica documentada aqui para reverter fácil se o resultado visual
não agradar.

**Frente 4 — DRE mobile em cards**: `DRE.tsx` (522 l., tabela de 12 meses +
total só com `overflow-x-auto`) decomposto e movido para
`src/features/financeiro/relatorios/` (primeira ocupação dessa pasta,
prevista em §7.3), seguindo o padrão "casca de rota" que a F2 já aplicou em
Entradas/Saidas — `src/pages/financas/DRE.tsx` vira um wrapper de 6 linhas.
`lib/dreCalculos.ts` isola as funções puras (`processarDados`,
`calcularResultadoLiquido`, sem mudança de comportamento);
`components/DreMonthGrid.tsx` é uma grade compacta 3×4 dos 12 meses (evita
recriar o problema original — scroll horizontal — dentro do próprio card);
`components/SecaoDreCard.tsx` reaproveita o mesmo estado `expandedSections`
da tabela original (cabeçalho sempre visível com o total do ano, expande
para o detalhe mensal + por categoria — mesmo dado, reorganizado em
drill-down); `components/ResultadoLiquidoCard.tsx` fica sempre visível (não
colapsável) e é posicionado no **topo** da lista mobile — no desktop
permanece na última linha da tabela; a única reorganização deliberada é
essa (mostrar o resultado líquido primeiro no card, já que é o número mais
consultado), sem esconder nenhum dado. `useIsMobile` decide entre a tabela
original (desktop/tablet, inalterada) e a lista de cards; exportação Excel
(`handleExport`) não foi tocada.

**Verificação visual**: mesma ressalva das rodadas anteriores — sem
ferramenta de browser/screenshot disponível neste ambiente; as 3 frentes
foram validadas só por revisão de código/classes Tailwind. Pendente
conferência manual antes da PR, em especial o bottom-nav com 6 ícones
(frente 3) e a densidade dos cards do DRE em telas pequenas (frente 4).

### 9.11 Correções pós-F7 — conferência visual real (PR #54, jul/2026)

A conferência visual manual pendente desde §9.8-§9.10 (sem ferramenta de
browser disponível para os agentes) aconteceu de verdade após o merge da F7
(#53) e achou 3 problemas reais na tela de Conciliação Inteligente — nenhum
deles pego pelo typecheck, já que envolvem valor de string em runtime ou uma
query filtrada demais:

1. **`QuickCreateTransacaoDialog` ("Lançamento Rápido") não mostrava o tipo
   (entrada/saída) nem filtrava a categoria por ele.** O tipo é inferido do
   extrato (não é escolha do usuário) mas ficava invisível na tela — agora
   tem um badge Entrada/Saída no header. A lista de categorias passou a
   filtrar por tipo via a mesma convenção de `useDadosApoio`/`TransacaoDialog`
   (`categorias_financeiras.tipo`, queryKey `"categorias-select"`).
2. **Bug real achado testando o item 1**: o cálculo do tipo comparava
   `extratoItem.tipo === "credit"` (inglês) — mas `extratos_bancarios.tipo`
   sempre vem em português (`credito`/`debito`, mesma convenção usada em
   `ExtratoDetalheDrawer.tsx:224` e em todo `useConciliacaoInteligente.ts`).
   A comparação nunca batia, então **todo** lançamento rápido criado a partir
   de um crédito no extrato nascia como saída — silenciosamente, desde antes
   da F7. Corrigido comparando com `"credito"`.
3. **Painel "Sistema" (transações pendentes) não indicava a conta** quando o
   filtro "Todas as contas" está ativo — badge de conta adicionado ao lado da
   data em `TransacaoListItem`. Review do Codex na PR #54 (P2) achou que o
   lookup usava `data.contas`, que só traz contas `ativo=true` (filtro correto
   para o dropdown "Todas as contas", mas não para o lookup do badge — uma
   transação pendente ligada a uma conta já desativada ficava sem badge,
   silenciosamente). Nova query `contasComInativas` (mesma tabela, sem o
   filtro `ativo`) alimenta só o lookup do badge.

Commits: `ac109d5`→`5ce4e0e`/`3415fe0` (itens 1/3, extraído em branch própria
`fix/conciliacao-quickcreate-tipo-badge-v2`, PR #54, já que a #53 tinha
mergeado antes dessa conferência acontecer), `a3c340a` (item 2), `d9c83e5`
(item 3, fix do P2).

### 9.12 Detecção de duplicata cross-canal Getnet×Santander (jul/2026)

Auditoria de antecipação de recebíveis Getnet (2026-07-17, focada no registro
tipo 5/`AC` e tipo 6/UR do Manual Extrato Eletrônico V10.1) confirmou com o
usuário um bug ativo na operação real, não coberto pela F6: o canal **Getnet
SFTP** (`getnet-sftp`, roda sozinho via `pg_cron` todo dia, `origem`
`getnet_sftp_tipo5`/`getnet_sftp_txt`) e o canal **Santander** (`santander-api`
ação `sync`, 100% manual via "Ver Extrato" em `Contas.tsx`, `origem`
`api_santander`) podem gerar **duas linhas em `extratos_bancarios` para a
mesma movimentação real** (o crédito líquido de uma antecipação). O único
dedupe existente, `UNIQUE(conta_id, external_id)`, nunca pega esse caso —
cada provedor gera `external_id` a partir de campos só seus (RV/chave-UR da
Getnet vs `transactionId`/`fitId` do Santander).

Correção (migration `20260717150000_fin_extratos_duplicata_provavel.sql`):
nova coluna `extratos_bancarios.possivel_duplicata_de` (FK para outra linha da
mesma tabela) + `fin_ingerir_extratos` estendida para, a cada linha realmente
nova (não duplicata técnica por `external_id`), procurar uma "irmã" na mesma
`conta_id`/`tipo`/`valor` com `origem` diferente e `data_transacao` até 2 dias
de diferença (cobre liquidação D+1/D+2 entre o arquivo Getnet e o crédito
bancário real) e, se achar, apontar a linha mais nova para a mais antiga.
**Decisão deliberada: só sinaliza, não decide** — é dinheiro real, então a
confirmação de que é de fato duplicata fica com o tesoureiro, reaproveitando
a RPC `fin_marcar_extrato_ignorado` (F7) já existente para "ignorar ruído do
extrato" — nenhuma RPC nova de ação foi criada. Frontend: badge "possível
duplicata" nos 3 componentes que já listam extratos pendentes
(`ExtratoListItem` do Modo Inteligente, com scroll-to-highlight até a linha
original; `PendenteExtratoCard` do Dashboard; `ExtratoManualCard` do Modo
Clássico) — todos já tinham `Badge` e a ação de ignorar; só o sinal era novo.

Validado via harness Docker isolado (postgres:15 standalone, sem afetar o
`supabase start` local de outro projeto rodando na mesma porta): 7 cenários —
cross-canal dentro da janela detecta, fora da janela (5 dias) não detecta,
mesma `origem` não é tratada como cross-canal, o fluxo de "ignorar" convive
sem conflito com o novo campo, re-ingestão do mesmo `external_id` não quebra
a nova lógica (dedupe técnico continua funcionando), limite exato de 2 dias
detecta (inclusivo), e contas diferentes não se cruzam (isolamento por
`conta_id` preservado). `npx tsc --noEmit`: 62 erros (baseline, nenhum novo).

Fora de escopo (deliberado): `HistoricoExtratos.tsx` não recebeu a badge
(tela de histórico já resolvido, não de pendências); `santander-extrato/index.ts`
não foi tocado (código órfão, sem caller, confirmado na auditoria).

### 9.13 Fix: depósito duplicado (mesma assinatura) descartado no sync Santander (jul/2026)

Achado em produção: extrato real tinha duas linhas "DEP DINHEIRO BCO 24H"
(depósito em terminal 24h) de R$ 100,00 no mesmo dia, mas só uma foi
importada. Causa raiz confirmada com o payload bruto do Santander: a API de
extrato **não devolve nenhum campo de identificação por transação** para esse
tipo de lançamento — só `creditDebitType`, `transactionName`,
`historicComplement`, `amount`, `transactionDate`. Sem `transactionId`/
`fitId`/`id`/`documentNumber`, o fallback de `syncExtrato()`
(`santander-api/index.ts`) monta o `external_id` a partir de
`data|valor|descrição|documento|tipo` — para as duas linhas de R$ 100,00
isso é **idêntico**, gera o mesmo hash SHA-256 e a constraint
`UNIQUE(conta_id, external_id)` descarta a segunda no `ON CONFLICT DO
NOTHING`. Perda silenciosa de dinheiro real da reconciliação, sem erro nem
aviso.

Correção: `syncExtrato()` passa a contar quantas vezes a mesma assinatura já
apareceu **dentro do mesmo lote** (`Map` local) antes de gerar o hash — só
sufixa a partir da 2ª ocorrência (`#1`, `#2`, ...). A 1ª ocorrência mantém o
hash exatamente igual ao de antes (não duplica o que já está importado em
produção); as ocorrências extras passam a ter `external_id` próprio e deixam
de colidir. Verificado reproduzindo a lógica isolada contra o payload real
enviado pelo usuário: hash da 1ª ocorrência inalterado, 2ª ocorrência com
hash novo e distinto. `deno check` limpo.

Ação operacional pós-deploy: reabrir "Ver Extrato" pra essa conta/período e
"Importar para Conciliação" de novo — o depósito que faltava entra como
novo, o que já foi importado não duplica (mesmo `external_id`).

Fora de escopo (mesma limitação, não corrigida agora): o fallback genérico
de `fin_ingerir_extratos` (usado por canais que não passam `external_id`
explícito, ex. importação manual) tem o mesmo risco teórico de colisão por
assinatura idêntica — não confirmado como problema ativo em nenhum canal
além do Santander até este momento.

### 9.14 Fix: "malformed array literal" em 4 RPCs (jul/2026)

Achado em produção: excluir um lançamento com `status='pago'` sempre
falhava com `22P02 malformed array literal`. Causa: `v_warnings text[] ||
'string sem cast'` é ambíguo pro Postgres entre `array_cat(anyarray,
anyarray)` e `array_append(anyarray, anyelement)` — com um literal de tipo
"unknown" (sem cast explícito), o Postgres resolve como `array_cat` e tenta
fazer PARSE da string como array literal (que precisa começar com `{`),
falhando sempre que a string não é uma sintaxe de array válida. Reproduzido
isoladamente (Docker standalone):
```sql
DO $$ DECLARE v text[] := '{}'; BEGIN
  v := v || 'string sem chave'; -- ERRO: malformed array literal
END $$;
```
Migration `20260728160000_fin_fix_array_literal_warnings.sql` recria (via
`CREATE OR REPLACE`, sem nenhuma outra mudança de comportamento) as 4
funções que tinham esse padrão exposto — todas em algum branch de warning,
então o erro é 100% reprodutível sempre que aquele caminho específico é
tomado, não intermitente:
- `fin_alterar_status_lancamento` — mudar pro MESMO status que já está.
- `fin_excluir_lancamento` — excluir lançamento com `status='pago'` (achado
  original, reportado pelo usuário).
- `fin_lancar_sessao` — item do Relatório de Ofertas com `valor <= 0`.
- `fin_pagar_reembolso` — solicitante de reembolso sem `user_id`.

Outros usos de `v_warnings || ...` no schema (`format(...)`,
`left(SQLERRM,...)`) já retornam `text` explicitamente e nunca tiveram esse
problema — só os 4 casos com literal cru estavam expostos (confirmado por
`grep` em todas as migrations). Fix: `::text` explícito no literal, que
desambigua pro `array_append`. Sintaxe validada com `check_function_bodies
= off` num Postgres isolado (sem precisar recriar as ~5 tabelas
referenciadas, já que o corpo de cada função é idêntico ao que já roda em
produção, só com o cast adicionado).

### 9.15 Fix: taxa administrativa somava em vez de subtrair em ENTRADAS (jul/2026)

Achado a partir de um print real: lançamento "Oferta - C.Débito", Valor
(Bruto) R$200,00, Valor Pago (Líquido) R$203,58, Taxas Administrativas
R$3,58 — o líquido ficava **maior** que o bruto, o que não corresponde a
dinheiro real (a adquirente fica com a taxa; a igreja recebe menos, não
mais). Avaliação completa (2 agentes em paralelo, sem código, registrada
antes da implementação) confirmou que a fórmula `valor + juros + multas +
taxas_administrativas - desconto` estava correta para SAÍDA (você paga mais
por causa de uma taxa) mas era aplicada igual para ENTRADA em 4 pontos:
`fin_lancar_sessao` (cria a oferta a partir do Relatório de Ofertas — a taxa
já é calculada automaticamente do cadastro de `formas_pagamento`, o
tesoureiro nunca digita nada, então toda oferta em cartão já nascia com o
líquido inflado), `fin_criar_lancamento`, `fin_atualizar_lancamento`
(recálculo automático) e `fin_alterar_status_lancamento` (baixa
pendente→pago). `TransacaoDetalheDrawer.tsx` (ajuste manual na tela de
conciliação) já calculava na direção certa — o sistema "sabia" a fórmula
certa em um lugar, só não usava no ponto de criação.

Fix (migration `20260728170000_fin_taxa_entrada_subtrai_liquido.sql`):
`taxas_administrativas` agora subtrai quando `tipo='entrada'` e continua
somando quando `tipo='saida'` — `juros`/`multas` continuam somando e
`desconto` continua subtraindo nos dois tipos (fazem sentido nas duas
direções). Escopo estrito: só a fórmula de `valor_liquido` — motor de
conciliação comparar por líquido, fonte real da taxa via
`getnet_financeiro_resumo`, relatório agregado de taxas e a reconciliação
em duas camadas (Oferta↔Getnet↔Banco, cada uma com granularidade própria:
oferta por culto, Getnet por transação individual com bruto/custo/líquido
reais, banco por lote de liquidação por bandeira) ficam para fases
seguintes — avaliação completa registrada, aguardando decisão de onde
implementar (motor genérico estendido vs. lógica própria).

Validado via harness Docker isolado — 7 cenários: `fin_criar_lancamento`
entrada (subtrai) e saída (soma, sem regressão), parcela 2+ da mesma RPC
(ramo de fórmula separado), `fin_atualizar_lancamento` recálculo
automático, `fin_alterar_status_lancamento` baixando entrada e saída, e
`fin_lancar_sessao` reproduzindo exatamente o cenário do print (bruto
R$200 + taxa R$3,58 → líquido R$196,42, não mais R$203,58). Todos
passaram.

**Addendum — mesmo bug (+ um segundo) em `TransacaoDialog.tsx` (jul/2026,
mesmo dia)**: um segundo print (Bruto R$50, Taxa R$0,90, Líquido R$59,00 —
59, não 50,90 nem 49,10) revelou que essa tela tem sua PRÓPRIA cópia do
cálculo de `valor_liquido`, independente das RPCs corrigidas acima, com
dois bugs empilhados:

1. **Sinal** — o `useEffect` de recálculo ao vivo (linha ~181) e o cálculo
   automático no submit quando o campo líquido fica vazio (linha ~873)
   somavam a taxa sempre, mesmo bug do backend, nunca corrigidos aqui.
2. **Formatação** — ao abrir "Editar", `taxas_administrativas`/`juros`/
   `multas`/`desconto` eram preenchidos com `String(numero)` cru (`"0.9"`,
   formato JS) em vez do formato BR-locale usado por `valor`/`valor_liquido`
   (`"0,90"`). O parser do recálculo ao vivo assume formato BR e remove
   todo ponto como se fosse separador de milhar antes de trocar vírgula por
   ponto — aplicado em `"0.9"`, o ponto decimal some e sobra `"09"` → **9**,
   dez vezes o valor real. `50 + 9 = 59`, exatamente o print.

**Isso não era só exibição**: o formulário manda `valor_liquido` (já
corrompido) explícito no PATCH ao salvar, e `fin_atualizar_lancamento` só
recalcula quando o campo está AUSENTE do patch — ou seja, abrir esse
dialog pra editar qualquer coisa e salvar gravava o valor errado de
verdade no banco, inclusive sobrescrevendo um lançamento que a criação já
tivesse calculado certo. Fix: mesma correção de sinal (condicionado a
`tipo`) nos dois pontos, mais formatação consistente
(`transacao.taxas_administrativas` etc. formatados como `valor` no
`useEffect` de preenchimento). Verificado isolando a lógica de
formatação+parse em Node contra o cenário exato do print — reproduz os
R$59,00 com o bug e dá R$49,10 (correto) depois do fix, sem regressão pra
saída (R$50,90, taxa continua somando). `npx tsc --noEmit`: 62 erros
(baseline, nenhum novo). Ver também `docs/adr/ADR-027-valor-bruto-vs-
valor-liquido.md`, fórmula atualizada.

### 9.16 Visibilidade de taxa na tela de Entradas (jul/2026)

Fecha o "Achado 4" da avaliação de taxa administrativa (§9.15) diretamente
na tela `Entradas` (`TransacoesPage.tsx`, `tipo='entrada'`), sem relatório
novo — critério de aceite do usuário: contabilidade/membros veem o bruto,
tesouraria confirma o líquido, auditoria acha a taxa "nos relatórios que já
existem". Os 4 cards de resumo (Total/Recebido/Pendente/Transferências)
viram 5 só para `tipo='entrada'` (Saídas não muda, fora de escopo):

- **Receita Bruta** (era "Total") — `SUM(valor)` de tudo no período, sem
  mudança de valor, só de rótulo.
- **Recebido** (rótulo inalterado) — passa a somar `valor_liquido` (não
  mais `valor`) dos lançamentos já pagos.
- **Pendente** — mesma troca, `valor_liquido` dos ainda pendentes (usa a
  taxa estimada gravada na criação — `fin_confirmar_conciliacao` não
  corrige `taxas_administrativas`/`valor_liquido` para o valor real ao
  confirmar, só `status`/`conciliacao_status`/`data_pagamento` — então
  Pendente e Recebido carregam a mesma precisão de estimativa, a
  conciliação não "melhora" o número, só confirma que o dinheiro chegou).
- **Taxas** (novo) — `SUM(taxas_administrativas)` de pago + pendente juntos
  — quanto a adquirente retém/vai reter no período. **Não** é
  `valor − valor_liquido` (review Codex P1, PR #60): essa subtração também
  carrega juros/multas/desconto (`valor_liquido = valor + juros + multas −
  taxas − desconto`), então dava um número contaminado — inclusive negativo
  em lançamentos com desconto sem taxa. `taxas_administrativas` já é
  gravada como magnitude positiva pelas RPCs `fin_*`, soma direta resolve.
- **Transferências** — sem mudança (não tem taxa de adquirente).

Filtro `status IN ('pago','pendente')` no card Taxas (review Codex P2):
`status='cancelado'` mantém `taxas_administrativas` preenchida no registro,
mas não deve contar — mesmo escopo de Recebido + Pendente.

Grid responsivo condicional (`lg:grid-cols-3 xl:grid-cols-5` só para
entrada, mantém `lg:grid-cols-4` para saída). Verificado isolando a soma
em Node contra um cenário com múltiplas ofertas em cartão + dinheiro +
transferência interna (Bruta − Taxas = Recebido quando tudo está pago) e
contra o cenário dos 2 achados do review (desconto sem taxa + lançamento
cancelado, confirmando que não contaminam mais o total). Testado com o dev
server real (Playwright headless): app carrega sem erro de console, rota
`/financas/entradas` redireciona corretamente pra `/auth` sem sessão (não
foi possível validar os números renderizados contra dado real de produção
— sem credencial de login disponível neste
ambiente).

### 9.20 D11 — Tipo de Data (Vencimento/Pagamento) e Regime de Caixa real no DRE (jul/2026)

Usuário relatou ficar perdido sobre qual data cada filtro de "Período"
usava — motivado por um caso real: lançamento com competência em maio,
vencimento em julho e pagamento em agosto aparecendo em mês diferente
dependendo da tela. Decisão completa, alternativas e trade-offs em
[ADR-031](adr/ADR-031-tipo-de-data-filtro-e-regime-caixa.md); resumo
técnico da implementação:

- **`TipoDataFiltroSelect`** (novo componente) — Select controlado com
  duas opções (Vencimento/Pagamento), label da segunda opção varia por
  tela (`transacoesPage.config.tsx.tipoDataPagamentoLabel`). Adicionado
  em `TransacoesPage`, `ExportarTab`, `Dashboard`, `Insights`, `Contas`.
- **`colunaDataFiltro(tipoData)`** (`core/model/types.ts`) — resolve
  `"data_vencimento" | "data_pagamento"`, usado em todo `.gte/.lte/.order`
  que antes hardcoded `data_vencimento`.
- **`MonthPicker` ganha `variant="pill"`** — em Entradas/Saídas, Dashboard,
  Contas e DRE, o próprio seletor de período vira o badge clicável que
  antes era só leitura (mesmo visual `text-xs`/`rounded-full`/ícone
  `w-3 h-3` do Badge outline já usado no resto do app).
- **`fin_resumo_periodo` ganha `p_eixo`** (migration `20260729160000`) e
  **`get_dre_anual`** troca o eixo de agrupamento por regime (migration
  `20260729120000`) — ambos exigem `status='pago'` explicitamente no eixo
  Pagamento/Caixa, não só "tem a data no período" (transação paga e
  cancelada mantém `data_pagamento`).
- **Exportação** ganha 4 colunas no início do arquivo: Ano/Mês (derivados
  do eixo selecionado), CNPJ (`fornecedor.cpf_cnpj`), Competência.

**3 rodadas de review automático (Codex) pós-implementação** encontraram
que trocar o eixo na busca não bastava — várias apresentações downstream
continuavam hardcoded em `data_vencimento`, todas corrigidas na mesma PR:
`agruparPorData` (lista agrupada/calendário de `TransacoesPage`),
`transacoesAgrupadas`/6 reduces de calendário/`getStatusDisplay` em
`Contas.tsx` (este último ficou **intencionalmente** em vencimento —
"Atrasado" é conceito de vencimento vencido, não do eixo escolhido),
`processarInsights` (tendência mensal e data das anomalias), `LancamentoCard`
(bloco de data compacto do card), comparativo "mês anterior" do Dashboard
(mistura de eixo com o período atual) e totais por conta em `Contas.tsx`
(faltava `status='pago'` no eixo Caixa). Também apareceu um shift de UTC
pré-existente em `formatDateForExport`/`processarInsights` — `new
Date("YYYY-MM-DD")` vira meia-noite UTC, que em fuso Brasil volta um dia;
corrigido usando `parseLocalDate` (`utils/dateUtils.ts`) só para strings
`YYYY-MM-DD` puras, preservando o comportamento correto para colunas
timestamptz completas (ex: `pessoas.data_primeira_visita`).

**Efeito colateral encontrado ao aplicar a migration do DRE em produção**:
outra migration aplicada em paralelo (`fin_lote_antecipacao_vinculo_
desagio`, Fase B do Recebível Getnet) colidiu de timestamp com
`get_dre_anual`'s migration — `supabase db push` rastreia por número de
versão, não por conteúdo, então a migration Getnet ficou marcada como
"aplicada" no histórico sem o SQL ter rodado de fato. Corrigido renomeando
pra uma versão livre e reaplicando; ambas as migrations Getnet Fase B
pendentes que ainda não tinham chegado a nenhum branch (`fin_forma_
pagamento_fk`, `fin_conferencia_totais_getnet`, `fin_competencia_grupo_
parcelado`) foram reconciliadas em `main` no mesmo momento.

### 9.21 D12 — Campo de data digitável nos dialogs do financeiro (jul/2026)

Usuário reportou UX ruim pra mexer nos campos de data dos dialogs
(Vencimento, Competência etc.) — só popover-calendário, sem digitar, sem
pular ano rápido. Decisão completa em
[ADR-032](adr/ADR-032-campo-de-data-digitavel-financeiro.md).

Novo `DateFieldPicker` (`src/components/financas/`): `MaskedInput`
(`dd/mm/aaaa`, `react-imask` — já usado em telefone/CPF, sem dependência
nova) + ícone de calendário como atalho pro mesmo `Popover`+`Calendar` de
antes. Contrato só em `Date | undefined`, sem tocar strings — cada dialog
manteve sua própria conversão Date↔string. Aplicado nos 8 campos de data
única do financeiro: `TransacaoDialog` (Vencimento, Competência, Data fim
de recorrência, Data de pagamento/recebimento), `AjusteSaldoDialog`,
`ConfirmarPagamentoDialog`, `GetnetImportDialog` (mantém a trava de não
aceitar data futura via `disabledDate`), `RelatorioOferta`.

**1 achado de review automático (Codex, P1)**: digitar uma data completa
mas inválida (`31/02/2026`) ou barrada por `disabledDate` mantinha o texto
visível sem nunca atualizar o valor do form — dialog continuava
habilitado a salvar/importar usando a data anterior enquanto exibia a
rejeitada. Corrigido com borda de erro visual + reversão pro último valor
válido ao perder foco.

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Camada canônica no banco (ADR-029) | Aprovar — pré-requisito de tudo |
| D2 | Padrão `features/` no frontend | Financeiro inaugura; demais domínios depois |
| D3 | Modelo de vínculo de conciliação | (a) manter 3 estruturas via RPC agora; (b) modelo único N:M `conciliacoes`+`conciliacao_itens` como evolução. FK física em `transacao_vinculada_id` após saneamento |
| D4 | Imutabilidade | Editar/excluir lançamento conciliado? Parcela do meio? A RPC precisa de resposta — exclusão resolvida desde a F1 (escopo `este_e_futuras`); edição de competência da parcela do meio resolvida por D10 (jul/2026) |
| D5 | Getnet tipo 1 vs tipo 5 | Tipo 5 como verdade do espelho, só novos períodos — ✅ implementado na F6 (opt-in via `config.espelho_tipo5_desde`) |
| D6 | Recorrência/parcelamento | Materializar tudo na criação (parcelado); job mensal (recorrente) |
| D7 | Efeitos colaterais (alertas) | Fila no banco lida por edge — bot e front geram os mesmos alertas |
| D8 | Status ENUM vs TEXT+CHECK | Padronizar na F1 (barato agora, caro depois) — inclui sanear os status de `sessoes_contagem` (CHECK × `finalizado` × StatusBadge) |
| D9 | Workflow de reembolso | O estado `aprovado` entra no fluxo real (com ação de aprovar/rejeitar na UI e notificação) ou sai do schema? Quem aprova: `admin` (trigger atual) ou também `tesoureiro` (UI atual)? |
| D10 | Competência de grupo em lançamentos parcelados | `fin_criar_lancamento` (D6) já materializa todas as parcelas com a mesma `data_competencia`; `fin_atualizar_lancamento` recusa divergir a competência de uma parcela isolada (`FIN_COMPETENCIA_GRUPO`) — sincronização explícita via `fin_alterar_competencia_grupo` — ✅ implementado (jul/2026, ver §9.19) |
| D11 | Tipo de Data (Vencimento/Pagamento) como eixo de filtro | Dois eixos ortogonais — Tipo de Data (qual coluna filtra a listagem) e Regime (o que entra no relatório) — ✅ implementado (jul/2026, ver §9.20 e [ADR-031](adr/ADR-031-tipo-de-data-filtro-e-regime-caixa.md)) |
| D12 | Campo de data digitável nos dialogs do financeiro | `DateFieldPicker` (MaskedInput + Calendar como atalho) substitui popover-calendário-só nos 8 campos de data única — ✅ implementado (jul/2026, ver §9.21 e [ADR-032](adr/ADR-032-campo-de-data-digitavel-financeiro.md)) |

### 9.17 Importação do Recebível Extrato Detalhado (portal Getnet) — Fase A (jul/2026)

O SFTP da Getnet ficou indisponível num período (set-nov/2025), sem o arquivo
EDI (layout V10.1) que alimenta `getnet_*`/`extratos_bancarios` hoje. O
usuário baixou manualmente do **portal** Getnet o CSV "Recebível Extrato
Detalhado" — único arquivo indispensável entre os 4 formatos alternativos do
portal: sozinho cobre tanto o nível de venda (bruto/taxa/líquido/NSU/
autorização/parcelas) quanto o mecanismo de cessão/antecipação (via
`Contrato Registradora`), que nenhum outro arquivo do portal revela.

Esta fase (A) só **importa e agrupa** — vínculo com extrato bancário e
lançamento do deságio de antecipação como saída ficam para a Fase B, depois
de validar a importação com dado real.

**Tabelas novas** (padrão RLS `fin_*`: `igreja_id` + `filial_id` recortados +
`user_filial_access`, **não** o padrão antigo `get_current_user_igreja_id()`/
`has_role()` de `getnet_resumo`/`getnet_financeiro_resumo` — ver
`[[feedback-fin-rpc-security-checklist]]`):

- **`getnet_recebivel_lancamentos`** — uma linha por linha do CSV (exceto
  `Subtotal`, derivável por soma). `dedupe_key` = `md5` das colunas naturais
  da linha (vencimento + bandeira + tipo_lançamento + lançamento + NSU +
  valor_líquido + data_venda) **+ contador de ocorrência dentro do lote de
  import** — mesmo padrão do dedupe Santander (commit `5adc3f0`, §9.13) e do
  `external_id` `file:...#occ` do `ImportarExtratosTab`. Necessário porque o
  CSV real tem linhas `Saldo Anterior` genuinamente duplicadas (confirmado:
  mesma data+bandeira+valor 0,00 repetida 2x no mesmo arquivo) — sem
  contador, a segunda seria descartada como falso duplicado.
- **`getnet_antecipacao_lotes`** — um row por `Contrato Registradora`, upsert
  automático durante a importação (`Valor Atual Do Contrato` é fixo repetido
  em toda linha do mesmo contrato). `UNIQUE (igreja_id, contrato_registradora)`
  — **desvio deliberado** do desenho original (`UNIQUE` global): evita que o
  upsert via `SECURITY DEFINER` (que bypassa RLS) atualize a linha de outro
  tenant caso dois números de contrato colidam entre igrejas diferentes.

**RPC `fin_importar_recebivel_getnet(p_integracao_id, p_linhas, p_contexto)`**
— valida tenant/filial da integração (deve ser `provedor='getnet'`), insere
deduplicado (`ON CONFLICT DO NOTHING`), upsert de lote por contrato (sem
tocar `status`, pra não reverter progresso da Fase B num reimport), 1 job em
`fin_extrato_ingestao_jobs` (reaproveitada; `origem='getnet_recebivel_portal'`
— exigiu relaxar `conta_id` pra nullable nessa tabela, já que um lote da
Getnet não tem conta bancária associada). Isolamento por linha (`BEGIN...
EXCEPTION`) igual `fin_ingerir_extratos` — uma linha malformada não derruba o
lote inteiro.

**Achado durante a calibração contra CSV real do usuário**: o portal usa o
valor literal `"0"` em `Contrato Registradora` como sentinel de "sem
contrato" (visto em linhas `Pagamento Realizado`/`Valor Liquidado (R$)`) —
não é um contrato de verdade. A RPC normaliza `"0"` para `NULL` (mesma regra
de `""`), senão o upsert criaria um lote fantasma `contrato_registradora='0'`
compartilhado por todas as igrejas que importassem essa linha.

**Parser client-side** (`ImportarRecebivelGetnetTab.tsx`, ao lado do
`ImportarExtratosTab` genérico em Gerenciar Dados): **não reaproveita a lib
`xlsx`** como o desenho original previa — o CSV real do portal Getnet é
**ISO-8859-1 (Latin-1), não UTF-8**; decodificar como UTF-8 corrompe todo
campo acentuado (`LANÇAMENTO`, `VALOR LÍQUIDO` etc.) antes mesmo de tentar
mapear coluna. O componente decodifica via `TextDecoder("iso-8859-1")` e
faz `split(";")` manual — o layout real tem 26 colunas fixas, sem aspas/
escaping (confirmado contra os 2 CSVs reais do usuário), então não precisa
do parser CSV completo da lib. Cabeçalho validado por comparação exata
(normalizada) contra as 26 colunas esperadas — rejeita o arquivo se a Getnet
mudar o layout, em vez de importar com colunas erradas silenciosamente.
Campo `parcelas` fica como texto bruto (`"1 de 7"`, não quebrado em
atual/total — a coluna do portal mistura os dois conceitos numa string só,
ambíguo demais pra normalizar nesta fase sem mais exemplos reais).

**Verificação**: `npx tsc --noEmit`: 62 erros (baseline, nenhum novo).
Harness Docker (`postgres:15` standalone) com 6 cenários: idempotência de
`Saldo Anterior` duplicada dentro do lote, reimport idempotente (0 inseridos
na 2ª rodada), upsert de lote sem duplicar por contrato + sentinel `"0"`
ignorado, rejeição de integração de outro tenant (`FIN_FK`), rejeição de
integração não-Getnet (`FIN_VALIDACAO`), RLS bloqueando `SELECT` cross-tenant
e `INSERT` direto (só a RPC escreve). Reprodução isolada em Node do parser
contra os 2 CSVs reais do usuário (arquivos de maio/2025 e setembro/2025):
217 linhas parseadas, 66 `Subtotal` ignoradas, valores batendo linha a linha
com o que já tinha sido conferido manualmente na investigação — venda de
R$100 em 18/05/2025 → R$97,91 cedidos, lote de 30/09/2025 (contrato
`2025093000995438317`) → R$1.523,81 em 7 linhas, deságio R$168,62
(consistente com o valor depositado real de R$1.355,19 no extrato bancário,
já importado via API Santander).

**Fase B implementada em seguida, mesma sessão** — ver §9.18.

### 9.18 FK real de forma de pagamento + Fase B do Recebível Getnet (jul/2026)

Ao planejar a Fase B (vínculo do lote de antecipação com o extrato bancário +
conferência de totais por período), a "conferência de totais" precisava
somar **entradas via cartão** — e não havia jeito confiável de identificar
isso: `transacoes_financeiras.forma_pagamento` sempre foi texto solto, nunca
uma FK real pra `formas_pagamento.id`. Usuário confirmou: corrigir a causa
raiz antes de construir o card em cima dela.

**`forma_pagamento_id uuid` (FK real)** — migration
`20260729130000_fin_forma_pagamento_fk.sql`. 4 escritores gravavam formatos
incompatíveis na coluna texto antiga: `fin_lancar_sessao`/`TransacaoDialog.tsx`
→ `formas_pagamento.id::text` (válido, mas como texto); `fin_pagar_reembolso`
→ `'pix'|'dinheiro'|'transferencia'` (vocabulário de preferência, CHECK
próprio, **fora de escopo** — conceito diferente de "qual formas_pagamento foi
usado"); `fin_criar_transferencia` → string fixa `'Transferência Bancária'`;
`chatbot-financeiro` (edge function) → rótulo em Português exato. Consequência
real, não hipotética: `fin_ofertas_periodo` só resolvia nome pras linhas com
UUID; `isPagamentoDinheiro` (frontend) fazia `.includes("dinheiro")` e só
batia pros rótulos; a tela de edição de transação perdia o valor original ao
reabrir linhas gravadas por bot/reembolso (Select não achava o item).

Coluna nova mantém a texto antiga (não dropada — ainda é a única fonte de
verdade pra `fin_pagar_reembolso`/parte de `fin_criar_transferencia`, e
fallback de exibição pras linhas não mapeadas). Backfill tenant-scoped em 2
passes (UUID-como-texto; rótulo case-insensitive, cobrindo tanto o rótulo
exato do bot quanto o minúsculo do reembolso numa query só) — sem recorte
por `igreja_id` seria bug cross-tenant real, já que `formas_pagamento` não
tem `UNIQUE(igreja_id, nome)`. `fin_criar_lancamento`/`fin_atualizar_
lancamento` passam a validar `forma_pagamento_id` via `fin_validar_fk_tenant`
(antes um id de outro tenant passava batido — regressão real coberta no
harness) e resolvem rótulo sem id explícito quando só vier texto (cobre o
chatbot sem tocar na edge function). `fin_lancar_sessao` passa a gravar as
duas colunas. `fin_ofertas_periodo` simplifica o join (sem `::text`) — exigiu
`DROP FUNCTION` antes do `CREATE OR REPLACE` por mudança de tipo de retorno.
Leitores heurísticos corrigidos: novo hook `useFormaPagamentoDinheiroId`
resolve o id do "Dinheiro" da igreja uma vez; `isPagamentoDinheiro` compara
id, não mais substring; exports (`ExportarTab.tsx`/`TransacoesPage.tsx`)
mostram o nome resolvido via embed, com o texto legado só como fallback.

**Fase B do Recebível Getnet** (migrations `20260729120000`/`20260729140000`):
- `fin_vincular_lote_antecipacao(p_lote_id, p_extrato_bancario_id)` — grava
  o vínculo manual, calcula o deságio (`valor_atual_contrato - extrato.valor`,
  nunca persistido, sempre recalculado em leitura), recusa trocar o vínculo
  depois do lançamento criado. Tela `LotesAntecipacaoTab.tsx` (aba "Lotes de
  Antecipação" dentro de Reconciliação Bancária): `VincularExtratoLoteDialog`
  sugere candidatos por proximidade de data (`data_contratacao_contrato` ±
  30 dias) + descrição contendo "antecipa"/"getnet", sem auto-selecionar — a
  escolha final é sempre manual, mesmo padrão de `VincularTransacaoDialog`.
- `fin_lancar_desagio_antecipacao(p_lote_id, p_categoria_id, p_conta_id)` —
  chama `fin_criar_lancamento` de verdade (não um INSERT direto — é a
  primeira chamada SQL-a-SQL da porta única neste repo), `tipo='saida'`,
  `status='pago'` imediato (o dinheiro já saiu na antecipação), descrição
  referenciando o Contrato Registradora. Recusa relançar (`FIN_JA_LANCADO`)
  se `lancamento_desagio_id` já preenchido — idempotente por rejeição, não
  por no-op silencioso. `LancarDesagioDialog.tsx` deixa o tesoureiro escolher
  conta/categoria de saída (sem categoria hardcoded — sugestão do plano era
  "Custo de Antecipação de Recebíveis", criável na tela de categorias já
  existente).
- `fin_conferencia_totais_getnet(p_conta_id, p_data_inicio, p_data_fim)` —
  só leitura, sem `fin_registrar_auditoria`. `Σ Oferta bruto (forma_pagamento
  classificada como cartão, nome ILIKE '%cart%') − Σ MDR − Σ deságio lançado
  no período = esperado no banco`, comparado contra `Σ Banco creditado`
  (`extratos_bancarios`, mesma conta/período). Não decide a causa da
  diferença — só torna o gap visível, card em `ConferenciaTotaisGetnetCard.tsx`
  (topo da aba, reaproveita `MonthPicker`/`getPeriodoRange`). Classificação
  "cartão" por nome (não por `taxa_administrativa > 0`, que pegaria boleto
  com taxa se algum dia existir) — só ficou confiável depois da FK real
  acima; antes não dava pra confiar no join.

**Verificação**: `npx tsc --noEmit`: 62 baseline, 0 novos. Harness Docker
(`postgres:15` standalone) com 6 cenários: backfill correto nos 4 padrões
históricos (UUID-texto, rótulo maiúsculo, rótulo minúsculo, texto livre não-
mapeável fica NULL) + isolamento de tenant (2 igrejas com "PIX" cada, sem
vazamento cross-tenant); `fin_criar_lancamento` grava `forma_pagamento_id`
válido e rejeita id de outro tenant (`FIN_FK`, regressão real antes não
coberta); `fin_atualizar_lancamento` sincroniza as duas colunas e rejeita
patch cross-tenant; `fin_lancar_sessao` grava as duas colunas consistentes;
`fin_ofertas_periodo` resolve `forma_nome` via join sem cast; Fase B ponta-a-
ponta com o exemplo real já validado (contrato `2025093000995438317`,
R$1.523,81 − R$1.355,19 = R$168,62 de deságio) — vínculo calcula o deságio
certo, `fin_lancar_desagio_antecipacao` cria o lançamento via
`fin_criar_lancamento` de verdade, recusa relançar, e
`fin_conferencia_totais_getnet` soma os 4 componentes corretamente.

### 9.19 D10 — Competência de grupo em lançamentos parcelados (jul/2026)

Usuário colou uma avaliação externa questionando se, numa compra parcelada
(ex.: equipamento em 10x), o DRE por Competência deveria diluir o valor ao
longo dos meses (competência = vencimento de cada parcela) ou concentrar o
valor cheio no mês do fato gerador (competência compartilhada por todas as
parcelas). Investigação no código, antes de decidir qualquer direção,
mostrou que o alicerce já existia: `fin_criar_lancamento` (D6, F1) já
materializa as N parcelas com a mesma `data_competencia` (mesmo `p_extras`
reaproveitado em todas as iterações do loop) e `get_dre_anual(p_regime=
'competencia')` já agrega por `data_competencia` incluindo `pendente` — ou
seja, a leitura já entrega o resultado desejado desde que os dados fiquem
consistentes. O gap real (não coberto por nenhuma RPC até então): **edição**
não propagava. `fin_atualizar_lancamento` fazia `UPDATE` só na linha
editada — mudar a competência da parcela 5/10 não atualizava as parcelas
1-4/6-10, e `reclass-transacoes` tinha o mesmo problema (bloqueava só por
conciliada, nunca verificava parcelas irmãs fora da seleção). Decisão
confirmada com o usuário: endurecer o modelo existente (reaproveitar
`lancamento_pai_id`), não migrar para uma entidade "Documento Financeiro"
separada; imobilizado/depreciação de equipamentos ficou fora de escopo
(decisão de produto futura, independente desta).

**Migration `20260729150000_fin_competencia_grupo_parcelado.sql`**:

- `fin_atualizar_lancamento` (CREATE OR REPLACE): bloqueia com erro nomeado
  `FIN_COMPETENCIA_GRUPO` quando `p_patch` contém `data_competencia` e o
  lançamento é `tipo_lancamento='parcelado'` com `lancamento_pai_id` setado
  ou `total_parcelas > 1` — a menos que o patch traga
  `_permitir_divergencia_competencia: true` (escape hatch para renegociação
  pontual de uma parcela; não exposto na UI, só via chamada direta). Regra
  restrita a `parcelado` — `recorrente` mantém competência própria por
  ocorrência, sem bloqueio (validado no harness).
- **Nova RPC `fin_alterar_competencia_grupo(p_lancamento_id, p_nova_competencia,
  p_contexto)`**: resolve `v_pai := COALESCE(lancamento_pai_id, id)` (mesmo
  padrão de `fin_excluir_lancamento`), rejeita se `tipo_lancamento <>
  'parcelado'`, rejeita se qualquer parcela do grupo já estiver conciliada
  (lista os ids no erro), atualiza `data_competencia` de todas as parcelas
  numa única transação, audita snapshot antes/depois, e avisa (warning, não
  bloqueia) quando alguma parcela afetada já está `status='pago'` — a
  competência pode retroagir sobre um período de DRE já reportado.
- `reclass-transacoes/index.ts`: antes do bloqueio existente por campo
  conciliado, se `data_competencia` está em `updateFields`, calcula os
  "pais" das transações-alvo `tipo_lancamento='parcelado'`, busca o grupo
  completo de cada um e compara com a seleção. Havendo irmã fora da
  seleção, recusa com 409 `GRUPO_PARCELADO_INCOMPLETO` (payload com
  `ids_irmas_faltantes`) sem aplicar nada — mesmo espírito de "recusar e
  informar" do bloqueio de conciliada, sem expandir a seleção por conta
  própria.
- Frontend: `TransacaoResumo` ganhou `tipo_lancamento`/`lancamento_pai_id`/
  `numero_parcela`/`total_parcelas` (colunas que já vinham do `select("*")`
  de `useLancamentos.ts`, sem query nova); `LancamentoCard.tsx` mostra badge
  "Parcela X/Y"; `lancamentos.api.ts` ganhou o wrapper
  `alterarCompetenciaGrupo`; `TransacaoDialog.tsx` detecta
  `FIN_COMPETENCIA_GRUPO` no catch do submit e oferece um `AlertDialog` de
  confirmação antes de sincronizar o grupo; `Reclassificacao.tsx` passou a
  ler o corpo JSON de `error.context` (Response não consumida da
  `FunctionsHttpError`) para exibir a mensagem estruturada de erros 409
  nomeados (cobre `GRUPO_PARCELADO_INCOMPLETO` e, de bônus, o
  `TRANSACAO_CONCILIADA` pré-existente, que tinha o mesmo problema de
  mensagem genérica).

**Verificação**: harness Docker (`postgres:15` standalone com stubs de
`auth.*`/tenant, não replay das migrations reais) com 7 cenários cobrindo
o bloqueio isolado, a sincronização completa do grupo, o bloqueio por
parcela conciliada, a rejeição de `tipo_lancamento='unico'`, a exceção de
`recorrente`, o escape hatch e isolamento de tenant — todos OK. Lógica de
detecção de grupo incompleto do `reclass-transacoes` isolada em Node (5
cenários: seleção parcial bloqueia, grupo completo aplica, dois grupos
simultâneos aplicam, patch sem `data_competencia` não aciona a checagem,
lançamento único nunca aciona) — mesmo padrão já usado no repo para lógica
pura de gate (PR #59/#63), sem harness SQL por não haver SQL nesse trecho.

### 9.22 Fix pós-review (Codex + /code-review, PR #67): forma_pagamento_id e sinal da taxa perdidos + edição descartada no sync de competência (jul/2026)

Review Codex sobre o PR #67 (frontend do Recebível Getnet + FK de forma de
pagamento + D10) acharam 2 P1 e 1 P2 reais; a rodada seguinte de `/code-
review` (angle line-by-line) achou uma 4ª regressão do MESMO padrão que a
correção do 1º achado ainda não tinha coberto:

1. **`fin_atualizar_lancamento` tinha perdido `forma_pagamento_id`.** A
   migration da FK (§9.18, `20260729130000`) deu `CREATE OR REPLACE` na
   função adicionando `forma_pagamento_id`; a migration do D10 (§9.19,
   `20260729150000`, sessão paralela) deu OUTRO `CREATE OR REPLACE` na
   mesma função, a partir de uma cópia anterior à reconciliação das duas
   sessões — apagou o suporte à FK sem ninguém perceber (`CREATE OR
   REPLACE` substitui o corpo inteiro). Efeito real: editar a forma de
   pagamento de uma transação existente devolvia sucesso com um warning
   "campo ignorado" — sem erro, sem reverter a UI, só nunca gravava.
   Fix: nova migration `20260730100000_fin_atualizar_lancamento_forma_
   pagamento_id.sql` reincorpora o bloco de `forma_pagamento_id` na versão
   atual da função (já com o bloqueio D10), mantendo as duas features
   juntas desta vez.
2. **Sincronizar competência do grupo descartava o resto da edição.**
   `TransacaoDialog.tsx` sempre mandava `data_competencia` no patch de
   qualquer edição (mesmo sem mudança real), então `fin_atualizar_
   lancamento` recusava com `FIN_COMPETENCIA_GRUPO` qualquer edição numa
   parcela de grupo parcelado — não só quando a competência de fato
   mudava. O fluxo de recuperação (`handleSincronizarCompetenciaGrupo`)
   só sincronizava a competência e fechava o dialog, jogando fora
   silenciosamente as outras mudanças (descrição, valor, forma de
   pagamento, status...) que o usuário tinha pedido no mesmo submit. Fix
   em duas camadas: (a) só inclui `data_competencia` no patch de edição
   quando o valor realmente difere do que já estava salvo — elimina o
   falso-positivo na maioria dos casos; (b) quando o bloqueio ainda assim
   dispara (mudança deliberada de competência numa parcela, junto com
   outros campos), o resto do patch é preservado e reaplicado via
   `atualizarLancamento` depois de `fin_alterar_competencia_grupo`
   sincronizar o grupo — nada se perde.
3. **P2**: `useTransacoesFiltro.ts` — `formaDinheiroId` faltava no array
   de dependências do `useMemo`; o filtro "Conferido Manual" ficava vazio
   até algum outro filtro mudar, porque a resolução assíncrona do id do
   "Dinheiro" não disparava recálculo. Fix: adicionado à lista de deps.
4. **`fin_atualizar_lancamento` TAMBÉM tinha perdido o sinal da taxa
   administrativa** (§9.15, PR #58/#59: taxa subtrai de `valor_liquido` em
   entrada, soma em saída) — a mesma colisão de `CREATE OR REPLACE` do
   achado 1 apagou os dois ao mesmo tempo (a cópia usada como base pelo
   D10 precedia AMBAS as correções), só que a 1ª rodada de fix (achado 1)
   só notou o `forma_pagamento_id`, sem checar se mais alguma coisa tinha
   sido revertida junto. Achado pelo `/code-review` (angle line-by-line)
   ao revisar o próprio fix do achado 1 — confirmado direto no arquivo
   antes de aplicar. Como `TransacaoDialog.tsx` sempre manda
   `valor_liquido` já calculado com o sinal certo, o recálculo server-side
   quebrado não disparava na prática pelo único chamador atual — mas a RPC
   é a porta única (ADR-029) e qualquer chamador futuro sem `valor_liquido`
   explícito receberia o valor errado sem aviso. Fix: reincorporado no
   mesmo `20260730100000` (`v_sinal_taxa`, idêntico ao de `20260729130000`).

**Verificação**: harness Docker (`postgres:15`) com 6 cenários — grava
`forma_pagamento_id` numa transação única sem warning de campo ignorado;
rejeita `forma_pagamento_id` de outro tenant (regressão do `fin_validar_
fk_tenant`, não voltou a passar batido); edita uma parcela sem tocar
competência sem acionar o bloqueio D10; muda competência de fato numa
parcela e o bloqueio D10 continua disparando; recálculo de `valor_liquido`
sem `valor_liquido` explícito no patch — entrada com taxa 3 dá líquido 97
(100−3), saída com taxa 3 dá líquido 103 (100+3). `npx tsc`: 63 baseline
(herdado de `origin/main` pós-#65/#66), 0 novos.

**Lição**: ao restaurar um campo apagado por uma colisão de migrations,
não basta reincorporar SÓ o campo que o review apontou — vale diffar a
função inteira contra a última versão correta conhecida antes de assumir
que só aquele campo foi afetado (aqui, os dois achados vieram do MESMO
`CREATE OR REPLACE` malfeito, mas em duas rodadas de review separadas).

### 9.23 Achado do `/code-review` (não corrigido nesta PR): ExportarTab perdeu o eixo Competência — e correção com 3ª opção (jul/2026)

Dois agentes independentes do `/code-review` (cross-file tracer e removed-
behavior auditor) acharam, cada um por conta própria, que `ExportarTab.tsx`
tinha perdido a capacidade de filtrar/exportar por `data_competencia` —
antes da PR #65 ("seletor Tipo de Data"), o export sempre filtrava por
competência; depois, só `data_vencimento`/`data_pagamento` ficaram
disponíveis via `TipoDataFiltroSelect`/`colunaDataFiltro` (ADR-031).
**Confirmado que isso não veio desta PR** — já estava em `origin/main`
antes do rebase (PR #65, já mergeada); só apareceu no `/code-review` porque
a ferramenta rastreia efeito através de arquivos adjacentes, não só linhas
adicionadas por este branch.

Usuário pediu a correção direto: Exportar precisa das 3 opções
(Vencimento/Pagamento/Competência). Implementado **só dentro de
`ExportarTab.tsx`**, sem tocar no `TipoDataFiltro`/`colunaDataFiltro`/
`TipoDataFiltroSelect` compartilhados — dois motivos, achados investigando
o blast radius antes de mexer:

1. **`TipoDataFiltroSelect` é um componente único sem lista de opções
   parametrizável** — widening o tipo compartilhado faria a 3ª opção
   aparecer em TODAS as 6 telas que usam o seletor (`TransacoesPage`,
   `Contas`, `Dashboard`, `Insights`, `ExportarTab`, `LancamentoCard`), não
   só em Exportar.
2. **`Dashboard.tsx` manda `tipoData` direto pra `fin_resumo_periodo` como
   `p_eixo`**, e essa RPC tem `CHECK`/`IN ('vencimento','pagamento')` — um
   3º valor vindo do tipo compartilhado quebraria essa tela com uma
   exceção Postgres não tratada.
3. **ADR-031 documenta a separação "Tipo de Data" (qual coluna ordena)
   vs. "Regime" (o que entra no relatório) como decisão deliberada**, não
   uma omissão — misturar Competência ali confundiria os dois conceitos
   que o ADR foi escrito pra manter separados.

Local em `ExportarTab.tsx`: `TipoDataFiltroExport` (tipo local, 3 valores),
`colunaDataFiltroExport()` (helper local), `Select` de 3 itens substituindo
`<TipoDataFiltroSelect>`. A regra "Data de Caixa exporta só pago" (bloco
`if (colunaPeriodo === "data_pagamento")`) não precisou de ajuste —
Competência cai naturalmente no mesmo ramo `else` que Vencimento já usava,
respeitando o filtro de Status normal. Mesma ressalva de `data_pagamento`
se aplica a `data_competencia`: é nullable no banco (coluna adicionada bem
depois de `data_vencimento`, sem backfill), então lançamentos legados sem
competência preenchida somem silenciosamente de um export filtrado por
esse eixo — mesmo comportamento já aceito pro eixo Pagamento, não uma
regressão nova.

`npx tsc`: 63 baseline, 0 novos.

### 9.24 Paridade bruto×líquido em Saídas + desconto de antecipação (jul/2026)

Usuário apontou duas lacunas em `TransacoesPage.tsx`/`ExportarTab.tsx`,
ambas cobertas por ADR-027 (`valor_liquido = valor + juros + multas +
(sinal_taxa * taxas_administrativas) - desconto`) mas nunca expostas na UI
pro lado de Saídas nem pro campo `desconto`:

1. **Boleto pago antecipado tem desconto** — banco cobra menos que o valor
   nominal do título. Esse `desconto` já é gravado pelas RPCs `fin_*` desde
   o D-ADR-027, mas nunca apareceu em tela nem em export — usuário só via
   taxa/juros/multa, nunca o abatimento.
2. **Cards de bruto×líquido só existiam pra Entradas** — o gate
   `tipo === "entrada"` escondia a separação valor-nominal × valor-líquido
   pra Saídas, mesmo elas tendo a mesma divergência (juros/multa de atraso
   fazem o líquido pago ser MAIOR que o nominal; desconto de antecipação faz
   ser MENOR).

**`TransacoesPage.tsx`**: removido o gate `tipo === "entrada"` de
`valorLiquidoOuBruto`/`totalPagoLiquido`/`totalPendenteLiquido` — a mesma
lógica de bruto×líquido (§9.15/9.16) agora se aplica a Entradas e Saídas
igualmente, já que `valor_liquido` vem calculado certo pro tipo direto da
RPC. Card "Taxas" virou "Taxas e Encargos" e passou a somar
`taxas_administrativas + multas + juros` juntos (antes só a taxa
administrativa) — do jeito que o usuário pediu ("precisamos colocar dentro
de taxas, multas e juros tb"), restrito a `status IN ('pago','pendente')`
(mesma ressalva do §9.16: `cancelado` mantém os campos preenchidos mas não
deve contar). Novo card "Desconto" (ícone `Tag`, cor teal) soma `desconto`
das mesmas transações, mostrado pros dois tipos. Grid do Resumo unificado
em `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6` (era
condicional por tipo) — 6 cards fixos: total, pago/recebido, pendente,
taxas e encargos, desconto, transferências.

**`ExportarTab.tsx`**: `desconto` estava ausente da query, do tipo
`TransacaoExportacao`, da lista `COLUNAS_DISPONIVEIS` e do
`handleExportar` — nunca tinha sido exportável, diferente de
`taxas_administrativas`/`multas`/`juros` que já tinham coluna própria desde
antes. Adicionado seguindo exatamente o mesmo padrão dos três campos
irmãos: `desconto` no `.select()`, `desconto?: number | null` no tipo,
`{ id: "desconto", label: "Desconto" }` em `COLUNAS_DISPONIVEIS`, e
`row.Desconto = t.desconto ?? 0` no `handleExportar`.

Fora do escopo: `handleExportar` dentro de `TransacoesPage.tsx` (função
morta, marcada `void handleExportar; // exportação via página Arquivos,
mantido para atalho futuro`, não ligada a nenhum botão) não foi tocada —
o caminho de export real e único é `ExportarTab.tsx`.

`npx tsc`: 63 baseline, 0 novos.

### 9.25 Toggle Bruto/Líquido + badges de composição + ordenar por data (jul/2026)

Extensão direta do §9.24: não bastava ter os campos de desconto/taxa/juros/
multa nos totais do topo — o usuário queria poder alternar, lançamento a
lançamento, entre o valor nominal do título (bruto) e o que efetivamente
foi pago/recebido (líquido), com um resumo visual de por que os dois
diferem. Pedido em 3 partes, na mesma conversa:

1. Botão Bruto/Líquido no cabeçalho da Lista/Agrupada/Calendário (Entradas
   e Saídas), badges de composição (Desconto/Taxa/Juros/Multa) antes do
   valor quando em modo Líquido.
2. O código do lançamento (6 primeiros chars do id, copiável) sai de onde
   estava (botão destacado à direita da descrição) e vai pro fim do texto
   da descrição, liberando espaço pros badges.
3. Botão de ordenar por data (mais recente/mais antiga primeiro) na Lista
   e na Agrupada.

**Decisões de UX fechadas com o usuário antes de implementar** (AskUserQuestion):
Bruto é o padrão ao abrir a tela (Líquido é opt-in); lançamento sem nenhum
encargo não mostra badge nenhum no modo Líquido (bruto == líquido, nada a
explicar); o código do lançamento mantém o mesmo estilo, só reposicionado.

**Novo módulo compartilhado** — `core/lib/encargos.ts` (puro, sem React,
respeita a regra "core não importa de módulo nenhum") com `somarEncargos`,
`encargosAtivos` e `temEncargo` operando sobre `{ desconto,
taxas_administrativas, juros, multas }`; e `components/financas/
EncargoBadges.tsx` (apresentacional, consome o core) — usado por
`LancamentoCard`, pelos totais de grupo em `TransacoesPage` e pelos 4
calendários (Entradas/Saídas × Mês/Timeline). Um componente só, 6 pontos de
uso — a alternativa era repetir a mesma lógica de composição em 6 arquivos
diferentes, exatamente o tipo de duplicação cliente-a-cliente que rendeu
bug em rodadas anteriores desta sessão.

**`LancamentoCard.tsx`**: novo prop `visaoValor?: "bruto" | "liquido"`
(default `"bruto"`) controla `valorExibido` e, em modo líquido, renderiza
`<EncargoBadges>` acima do valor (right-aligned) — que retorna `null`
sozinho quando não há nenhum encargo, então a regra "sem badge quando não
há o que explicar" cai de graça sem `if` duplicado no call site. Descrição
virou `<h3 className="flex items-baseline gap-1.5">` com o texto (`flex-1
min-w-0 truncate`) e o botão de ID como filho — sai do canto direito da
linha do título e passa a ficar logo depois do texto, mesmo estilo
monoespaçado/copiável, só com opacidade reduzida (`text-muted-foreground/70`)
já que agora divide espaço com a descrição.

**`TransacoesPage.tsx`**: dois estados novos, `visaoValor` e `ordemData`
(`"asc" | "desc"`, default `"desc"` — mesmo sentido que a query já usa).
Botão Bruto/Líquido é um segmented-control de 2 `Button` dentro de uma
borda comum (não é `ToggleGroup` do design system — o padrão já usado nesta
tela pra Lista/Agrupar/Calendário é `Button` + `Tooltip`, mantido por
consistência). Botão de ordenar (`ArrowDown`/`ArrowUp`) só aparece fora da
visão Calendário (grade de dias não tem uma noção linear de "ordem" pra
inverter). Ordenação implementada client-side — `transacoesOrdenadas`
(novo `useMemo`) reordena `transacoesFiltradas` pela mesma coluna de data
usada pra buscar o período (`colunaDataFiltro(tipoData)`, comparação de
string ISO `yyyy-MM-dd`, sem parsing de `Date`) e alimenta a paginação;
pra Agrupada, `ordenarDatasDesc` virou `ordenarDatas(grupos, ordem)`
(único caller, generalização direta, sem wrapper). Totais de grupo
(Agrupada) ganharam o mesmo toggle: `totalGrupo` alterna bruto/líquido e
badges de composição (soma de todos os lançamentos do dia) aparecem acima
do total quando em modo Líquido.

**Calendários (`SaidasCalendario`/`SaidasTimelineCalendario`/
`EntradasCalendario`/`EntradasTimelineCalendario`, 4 arquivos quase
idênticos, sem componente compartilhado — decisão herdada, não revisitada
aqui)**: sem toggle (não fazia sentido nesse layout) — sempre mostra os
dois números. Na célula do dia (grade do mês ou timeline), valor líquido
aparece como uma segunda linha discreta abaixo do valor bruto, **só quando
diferem** (mesma regra de "nada a explicar, nada a mostrar" da Lista). No
modal "Detalhes do dia", cada lançamento e o "Total do Dia" ganharam um
`<EncargoBadges bruto=... liquido=... totais=.../>` — aí sim sempre com
Bruto e Líquido explícitos (não só a diferença), porque o pedido explícito
foi literal: "Bruto / Líquido / Descontos / Taxas / Multa / Juros" — só
renderizado quando existe pelo menos 1 encargo (`temEncargo`), pra não
duplicar "Bruto R$X / Líquido R$X" idênticos na maioria dos lançamentos.
`EntradasCalendario`/`EntradasTimelineCalendario` somam entrada e saída
separadamente pra achar o líquido do dia (`totalEntradasLiquido -
totalSaidasLiquido`) — mesmo padrão redundante que o bruto já usava (essas
telas só recebem transações de um tipo por vez, o split por `t.tipo` é
defensivo/pré-existente, não alterado aqui).

**Ajuste de tipos**: `Transacao` (`hooks/useTransacoesFiltro.ts`) ganhou os
5 campos (`valor_liquido`, `taxas_administrativas`, `multas`, `juros`,
`desconto`) como propriedades nomeadas — já chegavam via `[key: string]:
any` e funcionavam em runtime, mas `somarEncargos(grupo)` falhava no
"weak type" check do TS (`EncargoCampos` só tem campos opcionais; o TS
exige pelo menos 1 propriedade em comum *declarada*, índice não conta).

`npx tsc`: 63 baseline, 0 novos. `npx eslint` nos 10 arquivos tocados: os
9 erros de `no-explicit-any` pré-existentes (props `dadosPorDia:
Record<string, Array<any>>` dos calendários, `[key: string]: any` de
`Transacao`) continuam nos mesmos arquivos, confirmado por diff antes/depois
via `git stash` — nenhum novo. Sem ambiente de browser disponível nesta
sessão pra teste visual — só verificação estática (tsc + eslint + leitura
cuidadosa do diff completo).

### 9.26 Fix: Forma de Pagamento duplicada no dialog de lançamento (jul/2026)

Usuário reportou, com print, o dropdown "Forma de pgto" do `TransacaoDialog`
mostrando cada nome duplicado (Cartão de Débito, Cheque, Débito em conta,
Dinheiro, PIX, Transferência Bancária — cada um 2×). Investigação inicial
suspeitou de falta de filtro por `tipo` (entrada/saída) — **descartada
depois de confirmar com o usuário**: `categorias_financeiras` já filtra por
tipo corretamente (`useDadosApoio.ts`), e `formas_pagamento` nunca teve
coluna `tipo` (catálogo único pros dois lados, por design — não é bug).

Causa real, achada comparando a query de `formasPagamento` com a de
`contas` no mesmo hook (`useDadosApoio.ts`): `contas` já filtra
`igreja_id` + (`filial_id` quando `!isAllFiliais`), mas `formasPagamento`
não filtrava nem `igreja_id` nem `filial_id` — buscava a tabela inteira
(mitigado de vazamento cross-tenant só pela RLS, mas sem filtro nenhum de
filial). Igrejas com mais de uma filial, cada uma com seu próprio cadastro
de formas de pagamento de mesmo nome (mesmo padrão de
`FormasPagamento.tsx`, que já filtra por filial no cadastro), acabavam
tendo as duas linhas retornadas e exibidas juntas no dropdown do dialog.

Fix: `formasPagamento` em `useDadosApoio.ts` passou a seguir exatamente o
mesmo padrão de `contas` (mesmo arquivo, poucas linhas acima) —
`.eq("igreja_id", igrejaId)` + `.eq("filial_id", filialId)` só quando
`!isAllFiliais`, `enabled: !!igrejaId`, queryKey com
`igrejaId/filialId/isAllFiliais`. Não mexeu em `useFormaPagamentoDinheiroId.ts`
(hook relacionado, também sem filtro de filial) — esse já usa
`.limit(1).maybeSingle()` então não duplica/quebra visualmente; resolver
determinística mas potencialmente pra filial errada quando há mais de um
"Dinheiro" cadastrado é um problema mais sutil, de correção do "Conferido
Manual"/isPagamentoDinheiro, não do sintoma reportado — fica para outra
sessão, com o mesmo cuidado.

`npx tsc`: 63 baseline, 0 novos. `npx eslint` no arquivo: limpo.

### 9.27 Checkboxes multi-seleção em ExportarTab: Tipo de Dados vira abas do Excel (jul/2026)

Plano salvo numa sessão anterior (`podemos-transformar-essa-op-o-hidden-diffie.md`,
nunca implementado) — usuário confirmou execução ao perguntar "perdemos a
seleção múltipla?". Os 4 filtros de `ExportarTab.tsx` (Tipo de Dados,
Status, Conta, Categoria) eram `Select` de valor único; viram checkbox
multi-seleção (popover), com uma decisão central confirmada no plano
original: **"aba" = worksheet dentro do MESMO arquivo `.xlsx`**, não uma
tela nova — marcar Entradas + Saídas gera 1 arquivo com 2 abas.

**Novo `src/components/financas/MultiSelectFilter.tsx`**: combobox
genérico (`Popover` + `Checkbox`, "Selecionar todos"/"Limpar" no topo),
mesmo formato visual de um `SelectTrigger`. `selected: string[]` vazio =
"todos/todas" (sem filtro), reaproveitado nos 4 filtros.

**`src/lib/exportUtils.ts`**: `exportToExcel` (assinatura inalterada,
ainda usada por `DRE.tsx`/`TransacoesPage.tsx`/`Todos.tsx`/
`SalaDeGuerra.tsx` sem mudança) teve sua lógica de montar worksheet
(number format + autosize de coluna) extraída pra `buildWorksheet()`
privada, reusada pela função nova `exportSheetsToExcel(sheets, filename)`
— um `book_new()` só, uma aba por item de `sheets` (pula abas vazias, erro
só se todas vierem vazias).

**`ExportarTab.tsx`**: os 4 `useState` de valor único viraram arrays
(`tiposSelecionados`, `statusSelecionados`, `contasSelecionadas`,
`categoriasSelecionadas`). Mudanças de maior risco, todas conforme o plano
original:
- **Categorias** (filtro compartilhado): a query passou de `.eq("tipo",
  tipo)` pra `.in("tipo", tiposConceito)` — união dos tipos funcionais
  marcados, já que a lista de categorias precisa cobrir Entradas E Saídas
  quando os dois estão marcados.
- **Query de transações**: 1 query virou 2 (`entradasQuery`/`saidasQuery`,
  uma por tipo funcional), cada uma habilitada só quando seu tipo está
  marcado — extraídas pra `fetchTransacoesExportacao()` (função de módulo,
  sem closures, parametrizada por `tipo`) pra não duplicar a query
  inteira. Preserva TODAS as regras já existentes (Data de Caixa força
  `status=pago` e ignora o filtro de Status; `.in()` em conta/categoria
  quando array não vazio).
- **Status multi-seleção**: `statusParaQuery()` combina Pago/Pendente/
  Atrasado num `.or()` do PostgREST — Atrasado é subconjunto de Pendente
  (pendente + vencimento passado), então marcar os dois junto simplifica
  pra só `status.eq.pendente` (não perde nenhuma linha, não duplica).
- **Preview**: quando mais de 1 tipo funcional está marcado, um seletor
  "Visualizando: [Entradas] [Saídas]" (mesmo estilo dos botões Todas/
  Nenhuma de Colunas) decide qual dataset a tabela mostra —
  `previewTipoEfetivo` é **derivado do state**, não sincronizado via
  `useEffect` (se o tipo em preview for desmarcado, cai pro primeiro tipo
  funcional que sobrou automaticamente). O card "Preview (N registros)" e
  o botão Exportar mostram o TOTAL somado de todos os tipos marcados; só a
  tabela em si mostra o tipo em preview.
- **Exportar**: monta as linhas de cada tipo marcado (mesmo mapeamento de
  colunas de sempre, extraído pra `montarLinhasExportacao()`) e chama
  `exportSheetsToExcel` uma vez com todas as abas. Efeito colateral
  positivo: o nome do arquivo não duplica mais timestamp (o código antigo
  carimbava manualmente E `exportToExcel` carimbava de novo por dentro).
- **Zero tipos selecionados**: `Alert` pedindo pra selecionar ao menos um
  tipo substitui o Preview; botão Exportar desabilitado.

`npx tsc`: 63 baseline, 0 novos. `npx eslint`: 1 warning de
`exhaustive-deps` (memo de `transacoesPreview` faltando), corrigido
envolvendo o cálculo em `useMemo` próprio.

### 9.28 Fix crítico: saldo de conta somava valor BRUTO, não líquido + paridade em Contas.tsx (jul/2026)

Usuário pediu pra replicar em `Contas.tsx` o mesmo tratamento Bruto/
Líquido de Entradas/Saídas/Calendário (§9.25), e perguntou se o valor ali
"provavelmente vai ter que bater com o saldo da conta". Investigação antes
de mexer em UI achou algo mais sério: **o saldo real da conta
(`contas.saldo_atual`) nunca considerou taxa/desconto/juros/multa.**

`atualizar_saldo_conta()` — o trigger `AFTER UPDATE OF status` que é o
executor único do saldo (D-2025-11, documentado no cabeçalho da F1) — soma/
subtrai `NEW.valor`/`OLD.valor` (bruto) desde que foi criado em
`20251130045754`, **antes** do conceito de `valor_liquido` existir
(ADR-027, jul/2026). Nenhuma migration posterior redefiniu essa função.
Mesmo bug em `fin_recalcular_saldo_conta()` (utilitário de correção de
drift, existia desde a F1, nunca tinha sido chamado pela UI — sem call-site
até este fix). Impacto real: toda entrada com taxa administrativa, toda
saída com desconto de antecipação/juros/multa de atraso, fazia
`saldo_atual` divergir do saldo de banco de verdade — ex.: entrada bruta
R$203,58 com R$3,58 de taxa (líquido R$200,00) somava R$203,58 no saldo,
não os R$200,00 que entraram de fato.

**Fix** (`20260730110000_fin_saldo_conta_valor_liquido.sql`): as duas
funções passam a usar `COALESCE(valor_liquido, valor)` em vez de `valor` —
fallback pro bruto quando `valor_liquido` é NULL (lançamentos anteriores
ao ADR-027, ou qualquer INSERT fora de `fin_criar_lancamento`), mesmo
padrão de fallback já usado no frontend desde §9.15/9.24. `fin_criar_
transferencia`/`fin_ajustar_saldo` NÃO tocados — não têm conceito de
bruto×líquido (movimento interno de conta / ajuste manual direto).
Harness Docker (`harness_saldo_liquido.sql`/`_tests.sql` no scratchpad): 7
cenários — entrada com taxa, saída com multa, fallback pro bruto quando
`valor_liquido` é NULL, reversão pago→pendente desfazendo pelo valor
certo, dry-run do recálculo (não aplica), aplicação do recálculo corrige o
drift, isolamento de tenant. Todos OK.

**Corrigir o código só resolve daqui pra frente** — não reescreve
`saldo_atual` já acumulado errado em produção. Como `fin_recalcular_saldo_
conta` nunca tinha um botão na UI, adicionado um em `Contas.tsx`: ícone
`RefreshCw` no card de cada conta chama a RPC em modo dry-run
(`p_aplicar=false`) primeiro, mostra `window.confirm` com saldo registrado
× saldo calculado, só aplica (`p_aplicar=true`) se o tesoureiro confirmar —
nunca sobrescreve saldo sem revisão humana do diff, mesmo cuidado usado em
toda mudança que mexe em dinheiro real nesta sessão.

**Paridade visual** (o pedido original): `Contas.tsx` tem sua própria
lista de "Lançamentos" (não usa `LancamentoCard` — implementação própria,
pré-existente, fora de escopo revisitar aqui) que ganhou o mesmo toggle
Bruto/Líquido + `EncargoBadges` + ID reposicionado pro fim da descrição de
§9.25: total do período (Entradas/Saídas/Saldo), badges por lançamento, e
os mini-totais "Entradas/Saídas/Saldo" dentro de cada card de conta
(`totaisPorConta`, período selecionado — dado diferente de `saldo_atual`,
que é o saldo corrente/histórico da conta). A visão Calendário de
`Contas.tsx` já reusa `EntradasCalendario`/`EntradasTimelineCalendario`
(mesmos componentes de §9.25) — herdou o líquido-abaixo-do-bruto e os
badges do detalhe do dia de graça, sem código novo; aliás é o primeiro
lugar onde o split entrada/saída desses 2 componentes realmente processa
dado misto (em `TransacoesPage.tsx` só chega um tipo por vez).

`npx tsc`: 63 baseline, 0 novos. `npx eslint`: mesmos 13 problemas
pré-existentes (confirmados via `git stash`), nenhum novo.

**Follow-up (mesmo dia)**: faltou o botão de ordenar por data — usuário
notou a ausência comparado a `TransacoesPage.tsx` (§9.25). Adicionado
`ordemData` (`"asc"|"desc"`, default `"desc"`) com o mesmo botão
`ArrowDown`/`ArrowUp` ao lado do toggle Bruto/Líquido, escondido na visão
Calendário. Duas ordenações client-side existentes em `Contas.tsx`
precisaram do parâmetro: `transacoesFiltradas` (lista "Todos", comparação
de string ISO no eixo `colunaData`) e o sort interno de
`renderTransactionListGrouped` (chaves de data da visão agrupada). Note
que a função `datasOrdenadas`/`transacoesAgrupadas` (linhas ~513-537) é
código morto — não alimenta nenhuma renderização (a agrupada de verdade é
`renderTransactionListGrouped`, que recomputa por conta própria) —
pré-existente, não tocado aqui.

### 9.29 Fixes pós-review (Codex, PR #67, jul/2026): trigger de saldo em INSERT + filial em Fase B + forma_pagamento legada

Usuário pediu pra triar os comentários do Codex na PR #67 (9 no total, 3
rodadas). Cada um verificado por leitura direta do código antes de agir —
não corrigido por suposição:

**3 achados stale** (código já corrigia o problema descrito, de commits
anteriores desta mesma sessão): `TransacaoDialog.tsx` linha do patch de
competência (patchRestante já reaplicado, §9.22), linha do
`forma_pagamento_id` em `fin_atualizar_lancamento` (migration
`20260730100000` já resolve), `useTransacoesFiltro.ts` (`formaDinheiroId`
já está no array de dependências do `useMemo`). Confirmados por leitura
direta, não descartados por suposição.

**1 achado real, corrigido no frontend**: `TransacaoDialog.tsx` mandava
`forma_pagamento_id: null` no patch de UPDATE mesmo quando o campo nunca
tinha sido tocado pelo usuário — para uma transação legada sem
`forma_pagamento_id` mapeado (reembolso/transferência, fora do escopo da
FK de `20260729130000`), isso fazia `fin_atualizar_lancamento` zerar
também o texto legado `forma_pagamento`, mesmo editando um campo
completamente não relacionado. Fix: mesmo padrão já usado pra
`data_competencia` (§9.22) — só inclui `forma_pagamento_id` no patch
quando o valor efetivamente muda em relação ao carregado.

**3 achados reais na Fase B do Getnet, corrigidos no backend + frontend**
(migration `20260731100000_fin_pos_review_pr67_fixes.sql`):

1. **`fin_vincular_lote_antecipacao` não validava filial do extrato** — na
   visão "todas as filiais", um lote de uma filial podia ser vinculado a um
   crédito bancário de outra. Fix: rejeita quando `extrato.filial_id ≠
   lote.filial_id` (lote sem filial = global, aceita qualquer extrato do
   tenant).
2. **`fin_lancar_desagio_antecipacao` não validava filial da conta** —
   mesmo problema na escolha de conta pro lançamento da saída de deságio.
   Mesma regra de fix.
3. Frontend (`VincularExtratoLoteDialog.tsx`/`LancarDesagioDialog.tsx`):
   as queries de candidatos/contas escopavam pelo seletor global
   "todas as filiais", não pelo `lote.filial_id` — corrigido pra sempre
   escopar pelo lote quando ele tem filial definida, com o backend como
   última linha de defesa. `useLotesAntecipacao.ts` passou a expor
   `filial_id` (faltava no select/tipo).

**Achado adicional, fora do que o Codex sinalizou, encontrado investigando
o #3** (`fin_lancar_desagio_antecipacao` usa `fin_criar_lancamento` com
`status:'pago'` direto no INSERT): **o trigger de saldo
(`atualizar_saldo_conta`) só dispara em `AFTER UPDATE OF status` — nunca
em `INSERT`.** Qualquer lançamento criado JÁ pago (não via
pendente→pago) nunca move `contas.saldo_atual`. Isso não é exclusivo do
deságio — afeta **`fin_lancar_sessao`** (toda oferta com
`forma_pagamento.gera_pago=true`, ex. PIX/Cartão — o caminho mais comum do
Relatório de Ofertas) e **`fin_pagar_reembolso`** (todo pagamento de
reembolso) igualmente, ambos pré-existentes, não introduzidos nesta PR.
`fin_criar_transferencia` já sabia disso e compensava com um `UPDATE`
manual de `saldo_atual` logo após os 2 INSERTs.

Fix: trigger passa a cobrir `INSERT OR UPDATE OF status` (função ganha um
branch `IF TG_OP = 'INSERT'`, testando só `NEW.status='pago'` — sem
`OLD` pra comparar). `fin_criar_transferencia` perde a compensação manual
duplicada (senão o saldo se moveria 2× pro mesmo valor: uma vez pelo
UPDATE explícito, outra pelo trigger agora reagindo ao INSERT). Nenhuma
mudança em `fin_criar_lancamento`/`fin_lancar_sessao`/`fin_pagar_reembolso`
foi necessária — o fix no trigger cobre todos os call-sites de uma vez,
sem precisar tocar em cada RPC individualmente.

**Harness Docker** (`harness_pos_review_trigger.sql`/`_tests.sql`,
extensão de `harness2_schema.sql` já usado nesta sessão): 9 cenários — 3
de INSERT (entrada pago move saldo, saída pago move saldo, pendente não
move nada), regressão do UPDATE pendente↔pago existente, `fin_criar_
transferencia` de ponta a ponta confirmando que o saldo se move
**exatamente 1×** em cada conta (não duplicado), os 2 guards de filial
(rejeita cross-filial, aceita same-filial) e `fin_lancar_desagio_
antecipacao` de ponta a ponta confirmando que o saldo se move sozinho
agora. Todos OK.

**Limitação de transição documentada, não corrigida por não ter solução
sem uma trilha de auditoria que não existe**: uma transação já paga
*antes* de `20260730110000` (fix bruto→líquido) rodar, se revertida
*depois*, é desfeita pelo valor líquido — mas tinha sido somada
originalmente em bruto pelo trigger antigo, deixando um pequeno drift
permanente pra aquela transação específica. Mitigado pelo mesmo
`fin_recalcular_saldo_conta`/botão "Recalcular Saldo" (§9.28) — o
recálculo soma tudo do zero, não depende de qual versão do trigger rodou
historicamente. Texto do `confirm()` de "Recalcular Saldo" em
`Contas.tsx` também ganhou um aviso explícito sobre ajustes manuais
pré-F1 (gravados direto em `saldo_atual`, sem transação correspondente)
não entrarem na soma recalculada — mesmo achado do Codex, mitigado por
aviso explícito no fluxo de confirmação humana já existente, não por
detecção automática (não há como diferenciar programaticamente "drift de
bug" de "ajuste legítimo antigo" sem mais dados).

`npx tsc`: 63 baseline, 0 novos. `npx eslint`: mesmos erros/warnings
pré-existentes em todos os arquivos tocados (confirmado via `git stash`),
nenhum novo.

### 9.30 Fix pós-`/code-review`: lote global de antecipação deixava passar deságio cross-filial

Rodada de `/code-review` (não Codex) sobre o commit de §9.29 achou um
loophole real que os 6 fixes anteriores não cobriam: `fin_lancar_
desagio_antecipacao` só validava a conta contra `getnet_antecipacao_
lotes.filial_id` — mas esse campo é nullable ("lote global", quando a
integração não amarra a uma filial fixa). Nesse caso a validação inteira
era pulada: lote global vinculado a um extrato da filial B (aceito, nada
pra cruzar ainda) podia depois ter o deságio lançado numa conta da filial
C — nada validava B contra C, e o lançamento final gravava
`filial_id=NULL` (o do lote), não o da filial que o dinheiro realmente
passou.

**Fix** (`20260731110000_fin_desagio_filial_lote_global.sql`):
`fin_lancar_desagio_antecipacao` passa a validar a conta contra a filial
do **extrato já vinculado** (`v_extrato.filial_id`), não a do lote —
cobre os dois casos: lote com filial (extrato já é garantidamente da
mesma, por causa do fix de §9.29) e lote global (o extrato concreto
escolhido é quem ancora a filial real do fluxo). O lançamento final grava
`filial_id = COALESCE(extrato.filial_id, conta.filial_id)`, nunca mais o
`filial_id` cru do lote.

**Segunda rodada do `/code-review` sobre esse mesmo fix** achou mais uma:
o frontend (`LancarDesagioDialog.tsx`) replicava a regra caindo pra
`lote.filial_id` quando a do extrato vinha NULL — divergindo do backend
(que só olha o extrato, nunca o lote). Isso vira bug de verdade porque
`getnet_antecipacao_lotes.filial_id` nunca teve FK real (diferente de
`extratos_bancarios.filial_id`/`contas.filial_id`, que já tinham `ON
DELETE SET NULL`): deletar uma filial depois de um lote vinculado a um
extrato dela zera extrato/contas por cascade, mas deixava o lote com um
UUID solto (dangling) — o frontend filtrava contas por esse UUID morto,
dropdown sempre vazio, mesmo o backend aceitando qualquer conta nesse
caso. Fix duplo: `ALTER TABLE getnet_antecipacao_lotes ADD CONSTRAINT
... REFERENCES filiais(id) ON DELETE SET NULL` (raiz do problema — agora
o lote nunca fica com UUID morto) + frontend para de cair pro
`lote.filial_id`, usa só `lote.extratos_bancarios?.filial_id`, espelhando
o backend à risca.

Harness Docker estendido (`harness_pos_review_tests.sql`, T10-T13): lote
global vincula com extrato de qualquer filial (T10); deságio numa conta
de filial diferente da do extrato é rejeitado (T11); com a conta certa,
aceita e grava a filial do extrato, não NULL (T12); deletar a filial
depois do vínculo zera `getnet_antecipacao_lotes.filial_id` via FK (T13a)
e o backend segue aceitando qualquer conta quando a filial do extrato já
é NULL, consistente com o que o frontend corrigido passaria a filtrar —
nada, sem UUID fantasma (T13b). 13/13 cenários (T1-T9 de §9.29 + T10-T13)
OK.

`npx tsc`: 63 baseline, 0 novos. `npx eslint`: limpo nos arquivos tocados.

### 9.31 3 achados reais na 5ª rodada de review (Codex): saldo pago→pago, autorização de filial, contexto não repassado

Mesmo ciclo de `/code-review` do §9.30, rodada seguinte, sobre o commit do
fix anterior. 6 dos 9 comentários eram repetição do que já estava
corrigido (mesmos 3 stale de sempre — competência, forma_pagamento legada,
`useMemo` deps — confirmados de novo por leitura direta; mais os 2
achados já mitigados de §9.29/9.28 — reversão pós-deploy, ajuste manual
legado — que o Codex não tem como enxergar resolvidos porque a mitigação
vive noutro arquivo/é uma decisão de produto, não uma mudança de código
que o diff mostra). 3 eram reais, verificados por leitura direta antes de
corrigir (`20260731120000_fin_pos_review_pr67_fixes3.sql`):

1. **`atualizar_saldo_conta()` não cobria pago→pago.** O trigger (mesmo já
   com o fix de §9.29 pra INSERT) só tratava as transições pendente↔pago —
   editar valor/desconto/taxas/conta de uma transação que **continua**
   `pago` (ex.: corrigir um valor digitado errado em algo já confirmado,
   via `TransacaoDialog`) mudava `valor_liquido` na linha mas não tocava
   `contas.saldo_atual`, que ficava desatualizado silenciosamente. Fix:
   terceiro branch (`OLD.status='pago' AND NEW.status='pago'`) desfaz o
   movimento antigo (conta/tipo/valor de antes) e aplica o novo — cobre
   tanto o caso comum (mesma conta, valor mudou) quanto o mais raro
   (conta_id ou tipo trocados mantendo pago).
2. **`fin_vincular_lote_antecipacao`/`fin_lancar_desagio_antecipacao` não
   verificavam acesso à filial do chamador** — só igreja_id. Sendo
   `SECURITY DEFINER` (bypassa RLS), um tesoureiro restrito a uma filial
   que soubesse o UUID de um lote/extrato de outra conseguia agir nele
   direto via RPC, ignorando a segmentação de filial da UI — mesma classe
   de gap que `fin_importar_recebivel_getnet` já cobria (e que o checklist
   de `[[feedback-fin-rpc-security-checklist]]` prevê). Fix: os dois
   ganharam `has_filial_access(v_igreja, filial_efetiva)` — filial do lote
   quando definida, senão a do extrato (mesmo conceito de "filial efetiva"
   de §9.30).
3. **`fin_lancar_desagio_antecipacao` passava `NULL` pro `p_contexto` da
   chamada aninhada a `fin_criar_lancamento`**, em vez do `v_ctx` já
   resolvido. Sem efeito hoje (só tem call-site via UI/web, onde
   `fin_resolver_contexto(NULL,...)` recalcula do zero sem problema), mas
   quebraria um caller service-role (bot/edge) futuro — `fin_resolver_
   contexto` exige `p_contexto` não-nulo nesse canal. Bug pré-existente
   (a chamada já vinha assim antes desta PR), barato de corrigir já que a
   função estava sendo tocada mesmo.

Harness Docker estendido (T14-T16): editar valor de uma transação já paga
rebalanceia o saldo pelo delta (T14); trocar `conta_id` mantendo pago move
o saldo da conta antiga pra nova (T15); tesoureiro com `get_jwt_filial_id()`
setado pra uma filial é rejeitado tentando vincular lote de outra e segue
liberado pra vincular lote da própria (T16 — precisou de um pequeno stub
novo no harness, `get_jwt_filial_id()` lendo de uma GUC setável por teste,
já que o stub original do `harness2_schema.sql` retornava `NULL` fixo
= acesso irrestrito sempre, incapaz de exercitar o caminho de rejeição).
16/16 cenários no total (T1-T13 de §9.29/9.30 + T14-T16).

`npx tsc`: 63 baseline, 0 novos (mudança 100% backend, nenhum arquivo TS
tocado nesta rodada).

### 9.32 6ª rodada de review: bug de sinal herdado do trigger original (nov/2025) + rede de segurança na FK

Mesmo ciclo de `/code-review` de §9.29-9.31, rodada seguinte sobre o
commit do fix anterior. 8 dos 10 comentários eram repetição (3 stale de
sempre + 2 já mitigados fora do diff + 3 apontando pra versões antigas de
arquivo já substituídas nos commits de §9.30/9.31 — o Codex ainda não
tinha "visto" esses fixes quando gerou os comentários, mesmo já
existindo). 2 reais, verificados por leitura direta
(`20260731130000_fin_pos_review_pr67_fixes5.sql`):

1. **Bug de sinal herdado do trigger original (nov/2025), nunca notado em
   3 reescritas desta sessão.** A branch "pago → pendente/cancelado" de
   `atualizar_saldo_conta()` desfaz o movimento testando `NEW.tipo` — mas
   deveria testar `OLD.tipo` (o tipo que efetivamente gerou o movimento
   quando a linha ficou paga). `fin_atualizar_lancamento` permite trocar
   `tipo` E `status` no mesmo patch (os dois estão na allow-list): mudar
   uma entrada paga de R$100 pra saída pendente no mesmo patch cai nessa
   branch, mas testa o tipo NOVO ('saida') em vez do velho ('entrada') —
   soma R$100 de novo em vez de subtrair os R$100 originais, um desvio de
   R$200. As outras duas branches (pago novo, pago→pago — as duas escritas
   nesta sessão) já usavam o tipo certo em cada lado; só a branch herdada
   do código de nov/2025 tinha o bug, e ninguém reparou porque trocar
   `tipo` e `status` juntos é raro na prática (a UI nunca faz isso — só a
   RPC permite). Fix: troca `NEW.tipo` por `OLD.tipo` nessa branch
   especificamente.
2. **FK de `getnet_antecipacao_lotes.filial_id` (§9.30) sem limpeza prévia
   de linha órfã** — se existisse uma linha com UUID de filial já
   deletada, o `ADD CONSTRAINT` falharia (Postgres valida linhas
   existentes). Avaliado e considerado sem risco real hoje: a tabela nasce
   nesta mesma sequência de migrations e o deploy é sempre atômico no
   merge (não há janela pra uma filial ser deletada "no meio"). Mantida
   como rede de segurança mesmo assim — barato, e confirmado via harness
   que não afeta nenhuma linha quando não há órfã (`UPDATE 0`).

Harness Docker (T17): patch único trocando `tipo` (entrada→saida) e
`status` (pago→pendente) ao mesmo tempo confirma que o saldo volta a zero
(desfaz os R$100 originais), não sobe pra R$200 (bug antigo). 17/17
cenários no total desta sequência de fixes pós-review.

`npx tsc`: 63 baseline, 0 novos (mudança 100% backend).

### 9.33 7ª rodada de review: `useFormaPagamentoDinheiroId` só resolvia uma forma "Dinheiro" por igreja

Mesmo ciclo de review, rodada seguinte. 12 dos 13 comentários eram
repetição do que já estava corrigido em commits anteriores (§9.28-9.32).
1 real, verificado por leitura direta antes de corrigir:

`useFormaPagamentoDinheiroId` resolvia só a forma de pagamento "Dinheiro"
mais antiga da igreja (`.order("created_at").limit(1)`), mas
`formas_pagamento` pode ter uma linha "Dinheiro" por filial (mesmo padrão
de duplicação já visto em §9.26 — a causa raiz ali era outra, falta de
filtro de igreja/filial, mas o CONCEITO de "mais de um Dinheiro por
igreja" é o mesmo). Igrejas com "Dinheiro" cadastrado por filial faziam
`isPagamentoDinheiro` nunca bater pras transações que não usassem
especificamente a forma mais antiga — "Conferido Manual" ficava invisível
e o filtro correspondente excluía essas linhas silenciosamente, em
`LancamentoCard`, `SessaoLancamentos` e `useTransacoesFiltro`. Achado
antecipado já em §9.26 ("resolver determinística mas potencialmente pra
filial errada... fica para outra sessão") — corrigido agora.

Fix: `useFormaPagamentoDinheiroId` passa a retornar um `Set<string>` com
TODOS os ids "Dinheiro" da igreja (não só o mais antigo);
`isPagamentoDinheiro` (core/lib/status.ts) passa a checar pertencimento no
Set em vez de igualdade com um id único. Aproveitado pra também matar a
duplicação que `useTransacoesFiltro.ts` já tinha (reimplementava o mesmo
`isDinheiro` inline em vez de chamar o helper compartilhado) — agora
importa e usa `isPagamentoDinheiro` direto.

`npx tsc`: 63 baseline, 0 novos — os 3 call-sites (`LancamentoCard`,
`SessaoLancamentos`, `TransacoesPage`→`useTransacoesFiltro`) só passam a
variável adiante, sem precisar de edição própria, o tipo `Set<string>`
flui de ponta a ponta. `npx eslint`: mesmos 2 erros pré-existentes
(confirmados via `git stash`), nenhum novo. Verificado por leitura
cuidadosa da lógica (mudança pequena e mecânica — igualdade vira
pertencimento em Set — sem harness dedicado, mesmo critério de escopo já
usado nesta sessão pra fixes puramente de lógica TS de baixa
complexidade).

### 9.34 8ª rodada de review: vínculo lote↔extrato não era concurrency-safe

Mesmo ciclo de review, rodada seguinte. 11 dos 12 comentários eram
repetição (`useTransacoesFiltro.ts:72` não voltou — a linha mudou de
verdade no commit de §9.33, então o Codex parou de ancorar comentário
nela). 1 real, verificado por leitura direta:

`fin_vincular_lote_antecipacao` trava a linha do LOTE (`FOR UPDATE WHERE
id = p_lote_id`) e faz um `EXISTS` pra checar se o extrato já está
vinculado a outro lote — mas isso não trava nada no EXTRATO. Duas
chamadas concorrentes vinculando **lotes diferentes** ao **mesmo
extrato** travam linhas de lote diferentes, então nenhuma bloqueia a
outra: os dois `EXISTS` rodam antes de qualquer `UPDATE` comitar, os dois
passam, os dois committam — o mesmo crédito bancário vira antecipação de
2 lotes, e lançar os 2 deságios conta o mesmo dinheiro duas vezes.
Clássico TOCTOU (time-of-check-to-time-of-use); o `EXISTS` sozinho nunca
fecha esse tipo de janela, só uma constraint no banco fecha de verdade.

Fix (`20260731140000_fin_lote_extrato_unique.sql`): índice único parcial
em `extrato_bancario_id` (parcial porque a coluna é nullable — lotes
ainda não vinculados podem ter `NULL` à vontade, só valores não-nulos
precisam ser únicos). O `EXISTS` continua ali como fast-path (evita ida
ao banco pro caso comum, sem corrida), mas quem garante de verdade é o
índice; o `UPDATE` final ganha um handler de `unique_violation`
convertendo o erro técnico do Postgres na mesma mensagem `FIN_VALIDACAO`
amigável que o `EXISTS` já dava.

Harness Docker (T18): confirma o fast-path via RPC (regressão) e, mais
importante, simula a corrida de verdade fazendo um `UPDATE` direto
(bypassando o `EXISTS` da RPC) tentando duplicar `extrato_bancario_id` —
sem concorrência real de duas conexões, mas validando que a garantia que
realmente importa (a constraint do banco) rejeita mesmo quando a camada
de aplicação é contornada. 18/18 cenários no total desta sequência.

`npx tsc`: 63 baseline, 0 novos (mudança 100% backend).

### 9.35 9ª rodada de review: total agrupado ignorava toggle líquido + conta global excluída no deságio

Mesmo ciclo de review, sobre o commit de §9.34. 13 dos 15 comentários eram
repetição de achados já corrigidos em commits anteriores desta mesma PR
(inclusive 2 casos — FK órfã em `20260731110000` e índice único em
`20260731140000` — onde a "correção" é reconhecer que não há risco real:
a tabela `getnet_antecipacao_lotes` e a função vulnerável nasceram nesta
mesma PR ainda não deployada, então não existe dado de produção que possa
ter passado pela janela de corrida antes da constraint existir). Todas as
13 threads stale foram respondidas com o commit onde já haviam sido
corrigidas (ou a razão de não haver risco real) e marcadas como resolvidas
na PR. 2 achados novos e reais, verificados por leitura direta:

1. `Contas.tsx` → `renderTransactionListGrouped` (visão agrupada por data)
   calculava o total do grupo e o valor de cada linha expandida sempre com
   `Number(t.valor)` (bruto), ignorando o toggle Bruto/Líquido —
   `valorEfetivo(t)` (que usa `valor_liquido` quando `visaoValor ===
   "liquido"`) já existia e era usado corretamente na lista não-agrupada
   (`renderTransactionList`), só não tinha sido aplicado na agrupada. Fix:
   troca `Number(t.valor)` por `valorEfetivo(t)` nos 3 branches do total
   (só-entrada, só-saída, misto) e no valor individual da linha expandida.

2. `LancarDesagioDialog.tsx` → dropdown de conta filtrava com
   `.eq("filial_id", filialEfetivaLote)` quando o extrato vinculado tinha
   filial — em SQL, `NULL` nunca é igual a nada, então contas globais
   (`filial_id IS NULL`) desapareciam do dropdown mesmo o backend
   (`fin_lancar_desagio_antecipacao`, §9.30) aceitando explicitamente
   conta global nesse caso (só rejeita quando `v_conta_filial IS NOT NULL
   AND` diverge). Fix: troca por `.or("filial_id.eq.<uuid>,filial_id.is.null")`
   pra incluir as globais, espelhando a regra do backend.

Mudança 100% frontend, sem migration nova. `npx tsc`: 63 baseline, 0 novos
nos dois arquivos.

### 9.36 10ª rodada de review: mesmo padrão de filtro de filial em mais 2 hooks

Mesmo ciclo, sobre o commit de §9.35. 26 dos 28 comentários retornados pela
API eram os 13 threads de §9.35 (já resolvidas, a API de comments as lista
de novo independente do estado de resolução) mais as próprias 13 respostas.
2 novos, mesma classe de bug do item 2 de §9.35 — filtro `.eq("filial_id",
filialId)` excluindo registro global (`filial_id IS NULL`) que deveria
ficar visível em qualquer filial:

1. `useLotesAntecipacao.ts:43` — lista de lotes de antecipação Getnet, na
   visão de uma filial específica, excluía lotes globais
   (`getnet_antecipacao_lotes.filial_id IS NULL`) que o backend
   (`fin_vincular_lote_antecipacao`, §9.30) aceita vincular a qualquer
   extrato do tenant — tesoureiro de filial não conseguia nem ver o lote
   pra iniciar o fluxo.

2. `useDadosApoio.ts:120` — lista de formas de pagamento pro
   `TransacaoDialog`, mesma exclusão para formas criadas em "Todas as
   filiais" (`filial_id NULL`). Confirmado via RLS antes de corrigir
   (`has_filial_access`, migration `20260105153404`: `... OR _filial_id IS
   NULL`) — RLS já trata `filial_id NULL` como compartilhado; o filtro do
   frontend era mais restritivo que a política real.

Fix nos dois: troca `.eq("filial_id", filialId)` por
`.or("filial_id.eq.<uuid>,filial_id.is.null")`.

Achado extra (não corrigido, fora de escopo): grep por
`.eq("filial_id"` no restante do código mostra ~150 outras ocorrências do
mesmo padrão, em módulos fora do diff desta PR (Kids, Pessoas, Eventos,
Voluntariado, Escalas etc.) — não faz parte deste PR nem foi sinalizado
pelo Codex (só comenta linhas do diff). Candidato a uma varredura dedicada
futura, não desta sessão.

Mudança 100% frontend, sem migration nova. `npx tsc`: 63 baseline, 0 novos
nos dois arquivos.

### 9.37 11ª rodada de review: extrato global pulava o check de acesso à conta

Mesmo ciclo, sobre o commit de §9.36. 2 novos, ambos reais:

1. **`fin_lancar_desagio_antecipacao`** (última versão: 20260731120000) —
   `has_filial_access(v_igreja, v_extrato.filial_id)` recebia a filial do
   EXTRATO. Quando o extrato vinculado ao lote é global (`filial_id NULL`
   — conta compartilhada), `has_filial_access` retorna `true` pra
   QUALQUER usuário do tenant (mesma convenção de sempre: registro global
   é compartilhado). E como o check de compatibilidade logo abaixo só
   roda quando `v_extrato.filial_id IS NOT NULL`, ele também era pulado
   nesse caso — nada validava que a CONTA escolhida (`p_conta_id`)
   pertence a uma filial que o chamador realmente acessa. Um tesoureiro
   da filial A que soubesse o UUID de uma conta da filial B conseguia
   lançar o deságio nela diretamente via RPC (`SECURITY DEFINER` bypassa
   RLS), desde que o lote estivesse vinculado a um extrato global.

   Fix (`20260731150000_fin_desagio_filial_efetiva_extrato_global.sql`):
   busca `v_conta_filial` ANTES do guard de acesso e checa
   `has_filial_access(v_igreja, COALESCE(v_extrato.filial_id,
   v_conta_filial))` — extrato com filial mantém o comportamento
   original; extrato global passa a validar acesso contra a filial da
   CONTA escolhida.

   Harness Docker dedicado (schema mínimo reconstruído do zero — os
   arquivos de sessões anteriores não sobreviveram no scratchpad; stubs
   de `has_filial_access`/`fin_resolver_contexto` controlados por GUC de
   sessão em vez de JWT real). 5 cenários rodados 2x (função pré-fix e
   pós-fix, mesmos dados): T1/T2 (extrato com filial, conta mesma/outra
   filial — regressão, comportamento idêntico nas duas versões) e T4/T5
   (extrato global, conta própria/global — regressão, sempre sucede).
   T3 (extrato global, conta de outra filial — o exploit) sucede
   indevidamente na versão pré-fix e é corretamente rejeitado
   (`FIN_TENANT: sem acesso à filial deste lote/extrato`) na pós-fix.

2. **`LancarDesagioDialog.tsx`** — o fix de §9.35 (contas globais no
   dropdown) só cobria o branch `filialEfetivaLote` truthy; o `else`
   (extrato global, `filialEfetivaLote` null) ainda filtrava com
   `.eq("filial_id", filialId)` puro, excluindo contas globais do mesmo
   jeito. Mesma correção: `.or("filial_id.eq.<uuid>,filial_id.is.null")`
   também nesse branch — espelha a regra efetiva do backend após o fix
   do item 1 (extrato global valida contra a filial da conta, que pode
   ser a própria filial do usuário OU global).

`npx tsc`: 63 baseline, 0 novos.

### 9.38 12ª rodada de review: mais 2 dropdowns excluindo registro global

Mesmo ciclo, sobre o commit de §9.37. 2 novos, mesma classe de bug (`.eq
("filial_id", filialId)` excluindo `filial_id IS NULL`), confirmados
antes de corrigir:

1. `VincularExtratoLoteDialog.tsx:109` — ao vincular um lote GLOBAL
   (`lote.filial_id IS NULL`) num extrato, a lista de extratos candidatos
   filtrava só pela filial atual, excluindo extratos compartilhados.
   Confirmado contra o backend: `fin_vincular_lote_antecipacao`
   (20260731140000) checa `has_filial_access(v_igreja,
   COALESCE(v_lote.filial_id, v_extrato.filial_id))` — pra lote global,
   isso é o acesso à filial do EXTRATO, que passa tanto pra extrato da
   própria filial quanto pra global.

2. `ConferenciaTotaisGetnetCard.tsx:37` — dropdown de conta pro card de
   conferência de totais Getnet excluía contas compartilhadas. Confirmado
   contra `fin_conferencia_totais_getnet` (20260729140000): a RPC só
   valida `fin_validar_fk_tenant` (tenant), sem nenhuma restrição de
   filial — o filtro do frontend era mais restritivo que a RPC.

Fix nos dois: mesmo `.or("filial_id.eq.<uuid>,filial_id.is.null")` já
usado em §9.35/9.36/9.37.

Verificação de escopo: grep de `.eq("filial_id"` nos demais arquivos
tocados por esta PR encontrou 1 ocorrência a mais dentro do diff
(`ExportarTab.tsx:177`), mas é o mesmo código pré-existente apenas
realocado por um refactor desta PR (aparece como remoção em uma posição
e adição idêntica em outra no `git diff main...HEAD`) — não é lógica nova
introduzida por esta PR, mesmo critério de "fora de escopo" de §9.36.

`npx tsc`: 63 baseline, 0 novos.

### 9.39 Varredura proativa (sem esperar 13ª rodada): mais um dropdown de conta

4 rodadas seguidas (§9.35-9.38) encontraram a mesma classe de bug em
arquivo diferente a cada vez — pedido do usuário pra rodar a varredura
completa de uma vez em vez de continuar reativo por rodada do Codex.

Grep de `.eq("filial_id"` em todos os 34 arquivos tocados por esta PR
encontrou mais ocorrências além das já corrigidas. Escopo discutido e
delimitado com o usuário: corrigir só o que interage diretamente com o
fluxo Getnet desta PR; o resto fica registrado, não corrigido nesta
sessão (evita inflar o diff da PR com bugs pré-existentes sem relação
com Getnet).

**Corrigido:** `useDadosApoio.ts` (dropdown de conta do `TransacaoDialog`,
linha ~29) — mesmo padrão, `.eq("filial_id", filialId)` excluía contas
compartilhadas. Trocado por `.or("filial_id.eq.<uuid>,filial_id.is.null")`.

**Registrado, não corrigido (pré-existente, sem relação direta com
Getnet — decisão explícita do usuário):**
- `useLancamentos.ts` (linhas 67, 103, 121, 171) — mesma classe de bug em
  `transacoes_financeiras`/`contas`/`categorias_financeiras`/
  `extratos_bancarios`: registro global some das listas de Entradas/
  Saídas e dos filtros quando o usuário está numa filial específica.
  Confirmado que `categorias_financeiras` também suporta registro global
  (`CategoriaDialog.tsx:82` grava `filial_id: !isAllFiliais ? filialId :
  null`) e que a RLS de `transacoes_financeiras` usa `has_filial_access`
  (mesma convenção NULL=compartilhado).
- `useLancamentos.ts:138` (fornecedores) — **bug diferente, não desta
  classe**: a tabela `fornecedores` nunca recebeu coluna `filial_id`
  (só `igreja_id`, migration `20260103150000`); o filtro
  `.eq("filial_id", filialScope)` provavelmente falha em runtime sempre
  que `filialScope` é truthy. Não investigado a fundo — decisão do
  usuário foi só registrar.
- `Contas.tsx` (linhas 135, 288, 326) — página principal de Contas: lista
  de contas, lista de transações do período e cálculo de totais por
  conta, todos excluindo registro global do mesmo jeito.
- `Reclassificacao.tsx:309` + `supabase/functions/reclass-transacoes/
  index.ts:302` — preview de busca e action de aplicar reclassificação em
  lote, ambos com o mesmo filtro; precisariam ser corrigidos EM CONJUNTO
  (preview e apply têm que bater, senão preview mostra transação que o
  apply não toca — risco já documentado em memória de sessão sobre lógica
  duplicada cliente/servidor).
- `ExportarTab.tsx:177` (exportação CSV) — mesmo padrão; código
  pré-existente apenas realocado por esta PR (não é lógica nova), mesmo
  critério de fora-de-escopo de §9.36.

`npx tsc`: 63 baseline, 0 novos.

## 11. Riscos

- **`SECURITY DEFINER` bypassa RLS** → padrão de resolução de tenant (7.2) é
  inegociável; revisão de segurança dedicada (checklist de
  `docs/01-Arquitetura/04-rls-e-seguranca.MD`).
- **Trigger de saldo dentro de RPCs** → testar reentrância; criar
  `fin_recalcular_saldo_conta(conta_id)` para corrigir drift histórico.
- **Schema real de produção vs migrations** (histórico Lovable com hashes) →
  snapshot baseline antes da F1.
- **Paridade na convivência** (F3) → monitorar divergências via audit log
  enquanto a flag antiga existir.
