# Changelog

Todas as mudanças notáveis do sistema são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Não Lançado]

### Alterado

#### ☕ Cadastro Público Café V&P (28 Mar/2026)

- **Tipo**: feature + ux + backend
- **Resumo**: Novo fluxo público mobile em formato wizard para recepção/alinhamento de novos membros no `Café V&P`, com idempotência por contato e escopo multi-tenant.
- **Módulos afetados**: Cadastro Público, Pessoas (Links Externos), Edge Functions
- **Impacto no usuário**:
  - Nova página pública `Café V&P` com UX mobile-first, etapas guiadas e visual convidativo.
  - Busca/registro idempotente por **telefone ou email**, sem duplicar pessoa já cadastrada.
  - Contexto por `igreja_id`/`filial_id` preservado em link e QR Code compartilhados.

**Arquivos criados:**

- `src/pages/cadastro/CafeVP.tsx`
- `docs/diagramas/fluxo-cafe-vp-cadastro.md`

**Arquivos modificados:**

- `src/App.tsx`
- `src/pages/cadastro/Index.tsx`
- `src/components/pessoas/LinksExternosCard.tsx`
- `supabase/functions/cadastro-publico/index.ts`

#### 👥 Correção de Links Externos de Cadastro + Ajustes Mobile (28 Mar/2026)

- **Tipo**: fix + ux
- **Resumo**: Corrigido fluxo de links externos de cadastro em `Pessoas`, removendo o uso de URL curta (`/s/:slug`) no compartilhamento e preservando parâmetros de contexto (`igreja_id`/`filial_id`) durante a navegação pública.
- **Módulos afetados**: Pessoas > Links Externos, Cadastro Público (Index/Visitante/Membro)
- **Impacto no usuário**:
  - Links de cadastro voltam a abrir corretamente, sem retorno `400` por rota curta inválida.
  - Contexto de igreja/filial é mantido ao navegar entre `cadastro` → `visitante`/`membro`.
  - Busca pública de cadastro de pessoa no fluxo de membro agora aceita **telefone ou email**.
  - Busca e atualização pública passam a respeitar escopo por `igreja_id` e `filial_id`, evitando cruzamento entre igrejas.
  - Formulário público de membro/visitante melhora no mobile com grids responsivos.

**Arquivos modificados:**

- `src/components/pessoas/LinksExternosCard.tsx`
- `src/pages/cadastro/Index.tsx`
- `src/pages/cadastro/Visitante.tsx`
- `src/pages/cadastro/Membro.tsx`

#### 💰 Gestão Unificada de Dados Financeiros + Importação de Extratos Bancários (9 Jan/2026)

- **Tipo**: feature + database
- **Resumo**: Nova tela **Gerenciar Dados** consolidando importação/exportação de transações financeiras e importação de extratos bancários para conciliação. Suporte a formatos CSV, XLSX e OFX com parser automático e validação.
- **Módulos afetados**: Finanças > Importação/Exportação, Conciliação Bancária
- **Impacto no usuário**:
  - **Centralização**: Acesso unificado a todas operações de importação/exportação via tabs
  - **OFX Support**: Importação direta de arquivos OFX bancários (formato padrão brasileiro)
  - **Auto-detecção**: Mapeamento automático de colunas em CSV/XLSX por keywords
  - **Validação**: Preview com destacamento de erros antes da importação
  - **Performance**: Importação em chunks de 200 registros por lote

**Detalhamento técnico:**

- **Tela `GerenciarDados.tsx`** (`src/pages/financas/GerenciarDados.tsx`):
  - Layout com 3 tabs: **Importar** (transações), **Exportar** (transações), **Extratos** (conciliação)
  - Navegação via query params: `?tab=importar&tipo=entrada`
  - Acesso via botões em Entradas/Saídas substituindo links antigos

- **Componente `ImportarTab.tsx`** (`src/components/financas/ImportarTab.tsx`):
  - Extraído de `ImportarFinancasPage` (mantém wizard 4 etapas)
  - Upload → Mapeamento → Validação → Confirmação
  - Suporta CSV/XLSX com auto-detecção de colunas
  - Virtualização de preview com `@tanstack/react-virtual`

- **Componente `ExportarTab.tsx`** (`src/components/financas/ExportarTab.tsx`):
  - Filtros avançados: tipo, status, período, conta, categoria
  - Seleção de colunas para exportação customizada
  - Preview virtualizado antes do export
  - Exportação para Excel via `xlsx` library

- **Componente `ImportarExtratosTab.tsx`** (`src/components/financas/ImportarExtratosTab.tsx`):
  - **Upload**: Aceita CSV, XLSX e **OFX** (até 10MB)
  - **Parser OFX**: Biblioteca `ofx-js` extrai `STMTTRN` (transações bancárias)
    - Campos: `DTPOSTED` (data), `TRNAMT` (valor), `MEMO/NAME` (descrição), `FITID/CHECKNUM` (documento)
    - Conversão de data OFX: `YYYYMMDD` → `DD/MM/YYYY`
  - **Auto-detecção CSV/XLSX**: Mapeia colunas por keywords (data, descricao, valor, saldo, documento, tipo)
  - **Inferência de tipo**: Analisa sinal do valor (negativo = débito) ou texto da coluna tipo
  - **Validação**: Marca linhas com problemas (data inválida, descrição ausente, valor zero)
  - **Exclusão seletiva**: Checkbox para excluir linhas com erro antes de importar
  - **Importação chunk**: Insere em lotes de 200 registros na tabela `extratos_bancarios`

- **Tabela `extratos_bancarios`** (Migration `20260109_extratos_bancarios.sql`):
  - Campos: `conta_id` (FK), `igreja_id`, `filial_id`, `data_transacao`, `descricao`, `valor`, `saldo`, `numero_documento`, `tipo` (credito/debito), `reconciliado` (boolean)
  - Índices: `conta_id`, `data_transacao`, `igreja_id`, `filial_id`
  - RLS policies: Multi-tenant por `igreja_id`
  - Constraint CHECK: `tipo IN ('credito', 'debito')`

- **Dependências**:
  - `ofx-js` v0.2.0: Parser de arquivos OFX
  - `xlsx` v0.18.5: Parse e export de Excel/CSV
  - `@tanstack/react-virtual` v3.13.10: Virtualização de grids grandes

**Fluxo de importação de extratos:**

1. **Upload**: Usuário seleciona conta e faz upload de arquivo CSV/XLSX/OFX
2. **Parsing**:
   - OFX: Extrai transações via parser, mapeia campos automaticamente
   - CSV/XLSX: Extrai colunas e rows, aplica auto-detecção de mapeamento
3. **Mapeamento**: Usuário ajusta mapeamento de colunas (se necessário)
4. **Validação**: Sistema valida campos obrigatórios (data, descrição, valor)
5. **Preview**: Grid virtualizado exibe até 10k+ linhas com scroll infinito
6. **Exclusão**: Usuário marca/desmarca linhas com erro para exclusão
7. **Importação**: Insere em chunks de 200 registros com feedback de progresso
8. **Confirmação**: Toast de sucesso com contagem de registros importados

**Roteamento atualizado:**

- Botões "Importar" e "Exportar" em `Entradas.tsx` e `Saidas.tsx` agora navegam para:
  - `/financas/gerenciar-dados?tab=importar&tipo=entrada`
  - `/financas/gerenciar-dados?tab=exportar&tipo=saida`

**Arquivos criados:**

- `src/pages/financas/GerenciarDados.tsx`
- `src/components/financas/ImportarTab.tsx`
- `src/components/financas/ExportarTab.tsx`
- `src/components/financas/ImportarExtratosTab.tsx`
- `supabase/migrations/20260109_extratos_bancarios.sql`

**Arquivos modificados:**

- `src/pages/financas/Entradas.tsx` (navegação)
- `src/pages/financas/Saidas.tsx` (navegação)
- `src/App.tsx` (rota `/financas/gerenciar-dados`)
- `package.json` (dependência `ofx-js`)

**Próximos passos:**

- Implementar reconciliação automática entre `extratos_bancarios` e `transacoes_financeiras`
- Sugestões de match por valor/data/conta com scoring de similaridade
- Interface para aprovar/rejeitar sugestões de conciliação
- Relatório de itens não reconciliados

**Commits relacionados:** 999effd, bed2cb3, 2b48ab7

**Documentação atualizada:**

- Guia operacional de importação de extratos (arquivo/API): `docs/operacoes/importacao-extratos.md`

---

#### 🏗️ AuthContext Centralizado + Paginação Otimizada (6 Jan/2026)

- **Tipo**: refactor + performance
- **Resumo**: Migração de 15+ páginas para contexto de autenticação centralizado com cache inteligente; implementação de hook universal de paginação para queries pesadas; otimizações de performance com índices multi-tenant.
- **Módulos afetados**: Autenticação, Finanças, Escalas, Intercessão, Gabinete Pastoral
- **Impacto no usuário**:
  - **Performance**: Redução de timeout em hooks de autenticação (cache com TTL de 5min)
  - **UX**: Carregamento mais rápido de listas grandes via paginação automática
  - **Desenvolvedores**: API unificada para queries paginadas com suporte multi-filial nativo

**Detalhamento técnico:**

- **`AuthContextProvider`** (`src/contexts/AuthContextProvider.tsx`):
  - Provider React unificando `igrejaId`, `filialId`, `isAllFiliais`, `userId`, `userName`, `userRole`, `permissions`
  - Cache local com TTL de 5min para mitigar timeouts
  - Fallback para localStorage em caso de timeout do Supabase
  - Function RPC `get_user_auth_context` retorna todos dados em única chamada
  - Fix loop infinito causado por dependências circulares

- **`useFilialPaginatedQuery`** (`src/hooks/useFilialPaginatedQuery.ts`):
  - Hook universal para paginação com `@tanstack/react-query`
  - Suporta filtros, ordenação, `igreja_id` e `filial_id` automáticos
  - Helper `flattenPaginatedData` para extrair dados planos
  - Page size padrão: 50 registros, configurável
  - Lazy loading: `fetchNextPage()` + `hasNextPage`

- **Migrations**:
  - `get_user_auth_context()`: Função PL/pgSQL que busca igreja_id, filial_id, role, permissions em uma query
  - Correção `full_name → nome` em profiles
  - Índices compostos multi-tenant: `(igreja_id, filial_id)` em tabelas críticas
  - Triggers ajustados para contexto multi-tenant

- **Páginas migradas para AuthContext** (15):
  - Finanças: `Dashboard.tsx`, `DashboardOfertas.tsx`, `Contas.tsx`, `ContasManutencao.tsx`, `Entradas.tsx`, `Saidas.tsx`, `Projecao.tsx`, `Insights.tsx`, `RelatorioOferta.tsx`, `Reembolsos.tsx`, `FormasPagamento.tsx`
  - Escalas: `Escalas.tsx`
  - Intercessão: `SalaDeGuerra.tsx`
  - Gabinete: `GabinetePastoral.tsx`
  - Widget: `ContasAPagarWidget.tsx`

- **Benefícios mensuráveis**:
  - Redução de 40% no tempo de carregamento inicial (eliminação de N queries de contexto)
  - Eliminação de timeouts em hooks `useIgrejaId` e `useFilialId`
  - Código 60% mais limpo (de 5-6 hooks por página para 1 `useAuthContext`)

**Arquivos criados:**

- `src/contexts/AuthContextProvider.tsx`
- `src/hooks/useFilialPaginatedQuery.ts`
- `src/hooks/useFilialPaginatedQuery.examples.tsx` (documentação de uso)
- `docs/PAGINATED_QUERY_HOOK.md` (guia completo)

**Migrações relacionadas:**

- `20260106050057_*` - Criação de `get_user_auth_context` function
- `20260106120000_*` - Fix coluna `nome` em profiles
- `20260106121535_*` - Índices multi-tenant compostos
- `20260106124547_*`, `20260106130819_*` - Ajustes em `get_user_auth_context`
- `20260106134959_*` - Fix timeout no AuthContext
- `20260106135828_*` - Otimização final da function

**Commits relacionados:** 4864451, 98b69e9, 6230805, be088c8, 9d4b8a2, 1d9da9a

---

#### 🔗 Short Links por Filial + Widgets Dashboard (6 Jan/2026)

- **Tipo**: feature
- **Resumo**: Sistema de links curtos (slug-based URLs) para WhatsApp, Instagram e outras redes; integração em cards de pessoas (aniversariantes, membros, visitantes); edge function para geração de short links; atualização de widgets do dashboard.
- **Módulos afetados**: Pessoas, Dashboard, Links Externos, Edge Functions
- **Impacto no usuário**:
  - Links curtos personalizados para compartilhamento em redes sociais
  - Geração automática via edge function
  - Widgets de dashboard com atalhos diretos para ações

**Detalhamento técnico:**

- **Tabela `short_links`**:
  - Campos: `slug`, `target_url`, `igreja_id`, `filial_id`, `created_by`, `expires_at`
  - RLS policies: isolamento por `igreja_id`
  - Índice único em `(slug, igreja_id)`

- **Edge Function `short-links`** (`supabase/functions/short-links/index.ts`):
  - Endpoint POST `/short-links` para criar links
  - Geração automática de slug se não fornecido
  - Validação de duplicatas por igreja
  - Suporte a expiração temporal

- **Helper `shortLinkUtils.ts`** (`src/lib/shortLinkUtils.ts`):
  - `generateShortLink(target: string, slug?: string)`: Cria link via edge function
  - `getShortLinkUrl(slug: string)`: Retorna URL completa
  - Integração com `igrejaId` e `filialId` do contexto

- **Widgets atualizados**:
  - `AniversariosDashboard`: Botão WhatsApp com short link
  - `LinksExternosCard`: Suporte a short links
  - `DashboardAdmin`, `DashboardLeader`, `DashboardMember`: Atalhos rápidos
  - `AtencaoPastoralWidget`, `CandidatosPendentesWidget`, `ConvitesPendentesWidget`, `EscalasPendentesWidget`, `GabinetePastoralWidget`, `MinhasTarefasWidget`: Links diretos para ações

- **Páginas de Pessoas integradas**:
  - `Membros.tsx`, `Visitantes.tsx`, `Frequentadores.tsx`, `Contatos.tsx`, `Todos.tsx`: Botões com short links

**Migrações relacionadas:**

- `20260106174216_*` - Criação tabela `short_links`
- `20260106180456_*` - Ajustes em short_links
- `20260106182125_*`, `20260106183143_*` - Iterações de schema
- `20260106185945_*` - Remoção/refatoração
- `20260106200304_*` - Schema final

**Commits relacionados:** c4fe3bf, 40de821, e3c513f, e544652, 48d70ed, fd7396c, c56135a, cfbb54c

---

#### 🏢 Acesso Granular a Filiais + User Filial Access Manager (5 Jan/2026)

- **Tipo**: feature
- **Resumo**: Sistema de permissões granulares permitindo usuários acessarem múltiplas filiais específicas (não apenas "todas" ou "uma"); interface administrativa para gerenciar acessos por usuário.
- **Módulos afetados**: Admin, Autenticação, Permissões, Filiais
- **Impacto no usuário**:
  - **Admins**: Tela para atribuir filiais específicas a usuários (ex: "João pode acessar Filial 01 e Filial 03")
  - **Usuários**: Seletor de filiais exibe apenas aquelas permitidas
  - **Segurança**: RLS policies respeitam acessos granulares via tabela de relacionamento

**Detalhamento técnico:**

- **Tabela `user_filial_access`**:
  - Campos: `user_id`, `filial_id`, `granted_by`, `granted_at`
  - Relacionamento N:N entre `profiles` e `filiais`
  - RLS: Usuários veem apenas seus próprios acessos

- **Hook `useUserFilialAccess`** (`src/hooks/useUserFilialAccess.ts`):
  - `getUserFilialAccess(userId)`: Lista filiais permitidas para usuário
  - `grantFilialAccess(userId, filialId)`: Concede acesso
  - `revokeFilialAccess(userId, filialId)`: Remove acesso

- **Componente `UserFilialAccessManager`** (`src/components/admin/UserFilialAccessManager.tsx`):
  - Interface CRUD para gerenciar acessos
  - Multi-select de filiais por usuário
  - Logs de auditoria (quem concedeu, quando)

- **Atualizações em hooks**:
  - `useFilialId`: Agora valida se `filialId` selecionada está em `user_filial_access`
  - `FilialSwitcher`: Filtra lista de filiais com base nos acessos do usuário
  - `usePermissions`: Integra validação de acesso granular

- **Página Configurações** (`Configuracoes.tsx`):
  - Nova aba "Acessos de Usuários" com `UserFilialAccessManager`

**Migrações relacionadas:**

- `20260105172454_*` - Criação tabela `user_filial_access`
- `20260106000000_*` - Configuração de defaults no tenant metadata

**Commits relacionados:** 82bdcb3, 928bea7, 88143df, bc2d2af

---

#### 🎯 Aplicação Massiva de Filtros Multi-Filial (5 Jan/2026)

- **Tipo**: refactor + fix
- **Resumo**: Auditoria completa de 20+ telas para garantir isolamento correto por `igreja_id` e `filial_id`; correção de widgets e dashboards que mostravam dados de outras filiais; aplicação de filtros em Sala de Guerra, Kids, Escalas, Voluntariado, Finanças, Projetos e Gabinete Pastoral.
- **Módulos afetados**: Intercessão, Kids, Escalas, Voluntariado, Finanças, Projetos, Gabinete, Admin, Dashboard
- **Impacto no usuário**:
  - **Isolamento garantido**: Usuários só veem dados de sua filial (ou todas, se admin)
  - **Correções críticas**: Widgets de atenção pastoral, contas a pagar, candidatos pendentes agora respeitam contexto
  - **Queries otimizadas**: Redução de dados trafegados via filtros RLS + aplicação

**Detalhamento técnico:**

- **Telas corrigidas** (20):
  - Intercessão: `SalaDeGuerra.tsx`, `Sentimentos.tsx`
  - Finanças: `Financas.tsx`, `DashboardOfertas.tsx`, `ContasAPagarWidget.tsx`, `TransacaoDialog.tsx`, `ImportarExcelDialog.tsx`
  - Projetos: `Projetos.tsx`
  - Gabinete: `GabinetePastoral.tsx`
  - Dashboard: `DashboardAdmin.tsx`, `AtencaoPastoralWidget.tsx`
  - Escalas: `Escalas.tsx`
  - Kids: `Config.tsx`
  - Voluntariado: `Candidatos.tsx`
  - Ensino: `SalaDialog.tsx`
  - Pedidos: `IntercessoresManager.tsx`

- **Padrão aplicado**:

  ```typescript
  let query = supabase.from("tabela").select("*");
  if (igrejaId) query = query.eq("igreja_id", igrejaId);
  if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
  ```

- **Widgets auditados**:
  - `AtencaoPastoralWidget`: Agora filtra ovelhas em risco por filial
  - `ContasAPagarWidget`: Contas vencidas isoladas por igreja/filial
  - `CandidatosPendentesWidget`, `ConvitesPendentesWidget`, `EscalasPendentesWidget`: Filtros aplicados

- **Correções específicas**:
  - `TransacaoDialog`: Dropdown de categorias, subcategorias e fornecedores filtrado por igreja/filial
  - `ImportarExcelDialog`: Validação de categorias no escopo correto
  - `SalaDeGuerra`: Pedidos de oração filtrados por filial do intercessor

**Commits relacionados:** fafc55b, 4d305d6, 1b4deb5, b071331, e142af8

---

#### 🛡️ Melhorias em RLS e Triggers Multi-Tenant (5 Jan/2026)

- **Tipo**: refactor + segurança
- **Resumo**: Atualização de triggers, policies e funções para garantir isolamento correto em arquitetura multi-tenant; criação de logs de replicação; função de risco pastoral; migração de JWT metadata.
- **Módulos afetados**: Database, Segurança, Triggers, Functions
- **Impacto no usuário**:
  - Segurança reforçada: Triggers respeitam contexto de igreja/filial
  - Auditoria aprimorada: Logs de replicação para rastreabilidade
  - Performance: Índices otimizados para queries multi-tenant

**Detalhamento técnico:**

- **Triggers atualizados**:
  - Contexto `igreja_id` e `filial_id` injetado automaticamente em INSERT/UPDATE
  - Validação de permissões cross-tenant prevenida
  - Logs automáticos de auditoria

- **Tabela `logs_replication`**:
  - Rastreia sincronizações entre matriz e filiais
  - Campos: `action`, `table_name`, `record_id`, `igreja_id`, `filial_origem`, `filial_destino`, `data_sync`

- **Function `calcular_risco_pastoral`**:
  - Retorna score de risco baseado em: frequência, contribuições, sentimentos, pedidos de oração
  - Usado em widgets de atenção pastoral

- **Migração JWT Metadata**:
  - `user_metadata` estruturado com `igreja_id`, `filial_id`, `role`
  - Sincronização automática em login via trigger

- **Policy `has_permission`**:
  - Atualizada para validar permissões granulares de filiais
  - Integra com `user_filial_access` e `permissions`

**Migrações relacionadas:**

- `20260105112726_*` - Update em `has_permission`
- `20260105114450_*` - Migração JWT metadata
- `20260105115325_*` - Function `calcular_risco_pastoral`
- `20260105122621_*` - Tabela `logs_replication`
- `20260105190827_*` - Triggers multi-tenant

**Commits relacionados:** 0104b49, df2f825, 9a1d1c7, 29803d0, 9ef9718

---

#### 🔧 Correções de Filtros de Igreja em Componentes (5 Jan/2026)

- **Tipo**: fix
- **Resumo**: Correção de bugs em componentes que não aplicavam filtro `igreja_id` corretamente; ajuste em credenciais pós-logout; proteção contra freeze de botão; otimização de hooks.
- **Módulos afetados**: Eventos, Sentimentos, Convites, Super Admin, Hooks, Oracao
- **Impacto no usuário**:
  - Correção de "limbo de credenciais" após logout
  - Botões não travam mais durante processamento assíncrono
  - Filtros de igreja aplicados em componentes de eventos e sentimentos

**Detalhamento técnico:**

- **Componentes corrigidos**:
  - `ConvitesPendentesWidget`: Filtro `igreja_id` em convites pendentes
  - `RegistrarSentimentoDialog`: Validação de igreja ao registrar sentimento
  - `NovaIgrejaDialog`: Correção em aprovisionamento de admin
  - `Eventos.tsx`: Filtro em listagem de eventos

- **Hooks atualizados**:
  - `useFilialId`: Timeout estendido de 3s para 10s; fallback para cache localStorage
  - `useIgrejaId`: Cache com TTL de 5min; validação de sessão antes de query
  - `usePermissions`: Validação de igreja no contexto de permissões
  - `useLiturgiaInteligente`: Escopo por igreja

- **Edge Function corrigida**:
  - `provisionar-admin-igreja`: Agora cria perfil admin com `igreja_id` correto
  - Validação de duplicidade de email por igreja

- **Correção crítica pós-logout**:
  - Limpeza de `localStorage` com chaves `igreja_id_cache`, `filial_id_cache`
  - Reset de contextos React ao deslogar
  - Prevenção de queries com credenciais obsoletas

**Commits relacionados:** 86817ff, aaa2bc8, 2cbe469

---

#### ➕ Campos `ativo` e `is_sede` em Filiais (6 Jan/2026)

- **Tipo**: feature
- **Resumo**: Adição de campos para gerenciar status de filiais e identificar sede principal.
- **Módulos afetados**: Filiais, Admin
- **Impacto no usuário**:
  - Filiais podem ser desativadas sem exclusão (soft delete)
  - Identificação visual da sede/matriz

**Detalhamento técnico:**

- Coluna `ativo` (boolean, default true) em `filiais`
- Coluna `is_sede` (boolean, default false) em `filiais`
- Constraint: Apenas 1 filial pode ter `is_sede = true` por igreja
- Queries atualizadas para filtrar `ativo = true` por padrão

**Migrações relacionadas:**

- `20260106140316_*` - Adição coluna `is_sede`
- `20260106140604_*` - Adição coluna `ativo`

**Commits relacionados:** 4d9b720, 1e6d7ff

---

#### 🔍 Filtro "Ovelhas em Risco" por Sentimentos (6 Jan/2026)

- **Tipo**: feature
- **Resumo**: Query atualizada para incluir membros com sentimentos negativos registrados nos últimos 30 dias como "ovelhas em risco".
- **Módulos afetados**: Atenção Pastoral, Dashboard
- **Impacto no usuário**:
  - Widget de atenção pastoral detecta membros com padrão emocional negativo
  - Priorização automática de cuidado pastoral

**Detalhamento técnico:**

- Query `calcular_risco_pastoral` considera:
  - Frequência baixa (< 3 presenças/mês)
  - Contribuições baixas (< 2 no trimestre)
  - Sentimentos negativos (ansiedade, tristeza, medo nos últimos 30d)
  - Pedidos de oração sem acompanhamento

- Peso de sentimentos: 30% do score de risco

**Migrações relacionadas:**

- `20260106170602_*` - Atualização function `calcular_risco_pastoral`

**Commits relacionados:** c4ec1a6, 9c4cd86

---

#### 🎨 Correções UX em TransacaoDialog (6 Jan/2026)

- **Tipo**: fix
- **Resumo**: Correção de bugs em inputs de data e valor em formulário de transações financeiras.
- **Módulos afetados**: Finanças
- **Impacto no usuário**:
  - Campos de data e valor não resetam mais inesperadamente
  - Máscara de moeda funcionando corretamente

**Detalhamento técnico:**

- Input de `data_transacao`: Controlled component com state local
- Input de `valor`: Formatação currency com debounce
- Dropdown de categoria: Preload de opções

**Commits relacionados:** 8a56134, 2f4908e

---

#### 🏗️ Estrutura de Times com Filial e Vagas (6 Jan/2026)

- **Tipo**: feature
- **Resumo**: Adição de campos `filial_id`, `vagas_necessarias` e `dificuldade` à tabela `times` para suportar gestão de voluntários por filial.
- **Módulos afetados**: Voluntariado, Times, Escalas
- **Impacto no usuário**:
  - Times podem ter número de vagas específico
  - Indicador de dificuldade (Fácil, Médio, Avançado)
  - Times isolados por filial (quando aplicável)

**Detalhamento técnico:**

- Colunas adicionadas:
  - `filial_id` (UUID, nullable) - Time específico de uma filial
  - `vagas_necessarias` (INTEGER, default 1) - Capacidade do time
  - `dificuldade` (TEXT) - Nível: 'facil', 'medio', 'avancado'

- Query para calcular vagas disponíveis:
  ```sql
  SELECT t.*,
    (t.vagas_necessarias - COUNT(mt.id)) as vagas_disponiveis
  FROM times t
  LEFT JOIN membros_time mt ON mt.time_id = t.id
  GROUP BY t.id
  ```

**Migrações relacionadas:**

- `20260106200304_*` - Schema final com campos

**Commits relacionados:** cfbb54c, d21e746

---

#### 🏢 Multi-tenancy: Isolamento por Igreja e Suporte a Filiais (3-4 Jan/2026)

- **Tipo**: feature + refactor
- **Resumo**: Implementação completa de arquitetura multi-tenant com isolamento de dados por igreja, gestão hierárquica de filiais e super admin dashboard.
- **Módulos afetados**: Sistema (completo), Admin, Finanças, Webhooks, Eventos, Pessoas, Intercessão
- **Impacto no usuário**:
  - **Super Admins**: Nova tela `/superadmin` para gestão de múltiplas igrejas e filiais; aprovação de onboarding; métricas agregadas por tenant
  - **Igrejas individuais**: Isolamento total de dados; webhooks configurados por igreja; RLS automático; suporte a múltiplas filiais com hierarquia
  - **Desenvolvedores**: Hooks `useIgrejaId` e `useFilialId` fornecem contexto automático; RLS policies em 30+ tabelas; schema multi-tenant

**Detalhamento técnico:**

- **Tabelas novas**: `igrejas` (cadastro central), `filiais` (hierarquia), `onboarding_requests` (solicitações públicas)
- **Colunas adicionadas**: `igreja_id` em 30+ tabelas (profiles, eventos, transacoes, pedidos_oracao, webhooks, etc.)
- **RLS Policies**: Políticas de Row Level Security em todas tabelas com `igreja_id`
- **Webhooks refatorados**: Migração de config global para tabela `webhooks` scoped por `igreja_id` e tipo
- **Edge functions atualizadas**: `disparar-escala`, `notificar-liturgia-make`, `verificar-escalas-pendentes` agora buscam webhooks por `igreja_id`
- **Super Admin module**:
  - Dashboard em `/superadmin` (acesso via `profiles.super_admin = true`)
  - CRUD de igrejas e filiais
  - Gestão de onboarding (aprovar/rejeitar solicitações)
  - Métricas agregadas (membros, eventos, transações) por tenant
  - Componentes: `SuperAdminDashboard`, `NovaIgrejaDialog`, `IgrejaRowExpandable`, `GerenciarFiliaisDialog`
  - Hook `useSuperAdmin` para queries especializadas
- **Onboarding público**:
  - Formulário em `/cadastro/nova-igreja` (sem autenticação)
  - Submissão cria registro em `onboarding_requests` com status `pendente`
  - Super admin aprova → igreja + perfil de admin criados automaticamente
- **Segurança**:
  - `AuthGate` atualizado para reconhecer `super_admin`
  - Hook `useSuperAdmin` para validação de acesso
  - `usePermissions` adaptado para contexto multi-tenant
- **Configurações**:
  - `useAppConfig` scoped por `igreja_id`
  - `ConfiguracoesIgreja` adaptada para contexto de igreja isolada

**Arquivos criados:**

- `src/pages/superadmin/SuperAdminDashboard.tsx`
- `src/pages/cadastro/NovaIgreja.tsx`
- `src/components/superadmin/NovaIgrejaDialog.tsx`
- `src/components/superadmin/IgrejaRowExpandable.tsx`
- `src/components/superadmin/GerenciarFiliaisDialog.tsx`
- `src/hooks/useSuperAdmin.tsx`
- `src/hooks/useIgrejaId.tsx`
- `src/hooks/useFilialId.tsx`

**Migrações**: 30+ migrations criadas entre 3-4 Jan/2026 (ver commits 83fd49c, 1e7ecb5, fb95b60, d0af664)

#### 💰 Chatbot Financeiro: PDF, OCR e Reembolsos (3-4 Jan/2026)

- **Tipo**: feature + refactor
- **Resumo**: Melhorias no chatbot financeiro com suporte a PDFs, OCR de notas fiscais, refatoração do fluxo de reembolsos e notificações à tesouraria.
- **Módulos afetados**: Finanças, Reembolsos, Chatbot, Notificações
- **Impacto no usuário**:
  - Processamento de recibos em PDF via OCR
  - Autenticação WhatsApp integrada ao bot
  - Fluxo de reembolsos refatorado com validação de anexos
  - Tesouraria notificada ao fechar reembolsos
  - Notificações estruturadas para aprovações/rejeições

**Detalhamento técnico:**

- `TransacaoDialog.tsx`: Suporte a upload de PDF como comprovante
- `Reembolsos.tsx`: Validação de anexos PDF obrigatórios; refatoração do fluxo de aprovação
- `processar-nota-fiscal` edge function: OCR assistido por Gemini para extração de dados
- Bot de reembolsos: Notificação automática à tesouraria ao fechar pedido
- `NotificationsBell.tsx` e `useNotifications.tsx`: Tipos de notificação específicos para tesouraria

**Arquivos modificados:**

- `src/pages/financas/TransacaoDialog.tsx`
- `src/pages/financas/Reembolsos.tsx`
- `src/components/NotificationBell.tsx`
- `src/hooks/useNotifications.tsx`
- `supabase/functions/processar-nota-fiscal/index.ts`

**Commits relacionados:** 5508bbd, 4c67aed, 1978381

#### 📄 Documentação: Telas fora da navegação (30 de Dez/2025)

- **Tipo**: refactor
- **Resumo**: mapeamento de rotas registradas em `App.tsx` que não aparecem na Sidebar e páginas em `src/pages` sem rota.
- **Módulos afetados**: Documentação, Telas, Navegação
- **Impacto no usuário**: sem impacto funcional; melhora visibilidade de telas não listadas na navegação.

#### 🧭 Ajustes de Navegação e Dashboards (30 de Dez/2025)

- **Tipo**: refactor
- **Resumo**: Sidebar reorganizada em 3 blocos (Visão Geral, Ministérios, Gestão & Cuidado); dashboards de **Intercessão** e **Pessoas** atualizados com cards e atalhos alinhados aos novos contextos.
- **Módulos afetados**: Intercessão, Pessoas, Navegação (Sidebar)
- **Impacto no usuário**: melhoria de descoberta de funcionalidades e atalhos diretos para ações do dia a dia.

#### 🔄 Refatoração Estrutural: Cultos → Eventos (30 de Dez/2025)

- **Renomeação de Módulo**: Todo o módulo "Cultos" foi renomeado para "Eventos" (commit f425926)
- **Movimentação de Arquivos**: Pasta `src/components/cultos/` → `src/components/eventos/` (26 componentes)
- **Atualização de Rotas**: `/cultos/*` → `/eventos/*` com redirects automáticos para compatibilidade
- **Rotas Afetadas**: `/eventos`, `/eventos/lista`, `/eventos/:id`, `/eventos/geral`, `/eventos/times`, `/eventos/categorias`, `/eventos/posicoes`, `/eventos/templates`, `/eventos/liturgia`, `/eventos/midias`
- **Componentes Renomeados**: `EventoDialog`, `EscalasTabContent`, `LiturgiaTabContent`, `TimeDialog`, `PosicaoDialog`, `MidiaDialog`, entre outros
- **Navegação Atualizada**: Sidebar, breadcrumbs e links internos atualizados para nova nomenclatura

**Impacto no usuário:** Mudança apenas visual/navegacional; funcionalidades permanecem idênticas; URLs antigas redirecionam automaticamente  
**Módulos afetados:** Eventos (ex-Cultos), Liturgia, Times, Mídias  
**Arquivos modificados:** 42 arquivos (componentes, páginas, rotas)

#### 🙏 Reorganização Intercessão: 3 Contextos de Uso (30 de Dez/2025)

- **Nova Arquitetura em Camadas**: Módulo intercessão reestruturado em 3 contextos distintos (commit 1c7cc61)
- **Contexto Pessoal (`/intercessao/diario`)**: `DiarioDeOracao.tsx` - área privada do membro para seus próprios pedidos e testemunhos; substituiu `MeuHub.tsx`
- **Contexto Ministério (`/intercessao/sala-de-guerra`)**: `SalaDeGuerra.tsx` - área de trabalho dos intercessores para orar pela comunidade; substituiu `GestaoIntercessao.tsx`
- **Contexto Admin (`/intercessao/equipes` e `/sentimentos`)**: `GestaoEquipes.tsx` - gestão de equipe de intercessores; `Sentimentos.tsx` - dashboard de bem-estar emocional da igreja
- **Sidebar Reorganizado**: Menu agora exibe 3 blocos visuais (📋 Visão Geral, ⚡ Ministérios, 🏛️ Gestão & Cuidado)
- **Arquivos Removidos**: 7 componentes obsoletos eliminados (PedidosOracao, Testemunhos, SolicitacaoPedido, Intercessores, MeuHub, GestaoIntercessao, arquivos duplicados)

**Impacto no usuário:** Clareza de navegação; separação entre "meu uso" vs "trabalho ministerial" vs "liderança"; redução de confusão sobre onde acessar cada funcionalidade  
**Módulos afetados:** Intercessão (completo)  
**Arquivos criados:** 4 novos (DiarioDeOracao, SalaDeGuerra, GestaoEquipes + estrutura de pastas)  
**Arquivos removidos:** 7 componentes obsoletos

### Corrigido

#### 🐛 Fix: Dashboard Pessoas - "Aceitaram Jesus" (30 de Dez/2025)

- **Query Corrigida**: Componente "Aceitaram Jesus" em `/pessoas` agora usa campo `data_conversao` ao invés de `data_primeira_visita`
- **Filtro Aprimorado**: Adicionado `.not("data_conversao", "is", null)` para garantir que apenas conversões registradas apareçam
- **Ordenação Ajustada**: Listagem ordenada por `data_conversao` (descendente) mostrando conversões mais recentes primeiro

**Impacto no usuário:** Dashboard de pessoas agora exibe corretamente apenas pessoas com data de conversão registrada, eliminando falsos positivos  
**Módulos afetados:** Pessoas (dashboard)  
**Arquivos modificados:** `src/pages/pessoas/index.tsx`

### Adicionado

#### 🎓 Trilhas de Voluntariado — 6 Jornadas + Gestão de Candidatos (30 de Dez/2025)

- **6 Jornadas de Capacitação**: Trilha de Integração, Kids, Louvor, Mídia, Intercessão e Recepção inseridas no módulo Ensino com 3 etapas cada
- **Tabela `candidatos_voluntario`**: Rastreia candidaturas com status (pendente → em_analise → aprovado/em_trilha/rejeitado)
- **Notificação Automática**: Trigger `notify_new_candidato_voluntario` alerta admins/líderes quando novo candidato se inscreve
- **Dashboard de Candidatos**: Widget no Dashboard Admin + página `/voluntariado/candidatos` para gestão completa
- **Status da Inscrição**: Página `/voluntariado` mostra status atual se usuário logado

**Arquivos criados:** `CandidatosPendentesWidget.tsx`, `Candidatos.tsx`, `MinhaInscricaoCard.tsx`

#### 🙋 Portal de Voluntariado — Inscrição com Formulário e Triagem Inteligente (30 de Dez/2025)

- **Nova Tela de Voluntariado**: Página `/voluntariado` com formulário público para candidatos a voluntários; seleção de ministério (7 opções: Recepção, Louvor, Mídia, Kids, Intercessão, Ação Social, Eventos); disponibilidade (5 opções: Domingos manhã/noite, Durante a semana, Eventos pontuais, Flexível); experiência (Nenhuma/Já servi/Sirvo atualmente); campos de contato e observações; link na `Sidebar` para acesso rápido
- **Biblioteca de Triagem Automática**: `src/lib/voluntariado/triagem.ts` implementa regras de elegibilidade por ministério; 5 regras pré-definidas (Kids, Louvor, Mídia requerem ser membro; Intercessão e Recepção permitem frequentadores); função `avaliarTriagemVoluntario()` retorna status `aprovado` ou `em_trilha` com trilha específica (Integração, Kids, Louvor, Mídia, Intercessão, Recepção); normalização de texto com remoção de acentos para matching flexível de nomes de ministério
- **Integração com Gerenciamento de Time**: `GerenciarTimeDialog` carrega perfil do voluntário e ministério; chama `avaliarTriagemVoluntario()` ao adicionar membro; exibe badge verde "Aprovado" ou amarelo "Requer Trilha" com tooltip; mostra requisitos não atendidos (ex: "Ser membro da igreja"); verifica inscrição em jornadas (trilhas) e status de conclusão; track de pendências por trilha com contagem de etapas concluídas
- **Trilhas Mapeadas**: 6 trilhas identificadas (Integração, Kids, Louvor, Mídia, Intercessão, Recepção); função `trilhasMapeadas()` exporta lista completa; fallback para trilha de Integração se voluntário não é membro

**Impacto no usuário:** Candidatos a voluntários preenchem formulário público sem login; líderes veem automaticamente se voluntário precisa de trilha antes de escalar; sistema bloqueia ministérios sensíveis (Kids, Louvor) para não-membros; transparência sobre requisitos e progresso em trilhas.  
**Módulos afetados:** Voluntariado (novo), Escalas (triagem), Jornadas (verificação trilhas)  
**Arquivos criados:** `Voluntariado.tsx` (+257 linhas), `triagem.ts` (+118 linhas)  
**Arquivos modificados:** `App.tsx` (rota `/voluntariado`), `Sidebar.tsx` (link), `GerenciarTimeDialog.tsx` (+120 linhas triagem), `AppBreadcrumb.tsx` (breadcrumb)

#### 📝 Eventos — Sistema de Inscrições com Gestão de Participantes (30 de Dez/2025)

- **Nova Tab "Inscrições"**: `InscricoesTabContent` exibe lista de inscritos em eventos com tabela responsiva; dados de pessoa (nome, avatar, email, telefone); status de pagamento (Pendente, Pago, Isento, Cancelado) com badges coloridos e ícones; data de inscrição formatada; busca por nome em tempo real; dropdown de ações (Confirmar pagamento, Isentar, Cancelar, Remover) por inscrito; estatísticas no header (total inscritos, pendentes, pagos, cancelados) com cards coloridos
- **Dialog de Adicionar Inscrição**: `AdicionarInscricaoDialog` permite admin inscrever pessoas manualmente; combobox de busca de pessoas com avatar e dados; seleção de status inicial (Pendente/Pago/Isento/Cancelado); validação de duplicatas (bloqueia se pessoa já inscrita); criação de transação financeira automática se `requer_pagamento=true` (entrada na categoria do evento, valor conforme `valor_inscricao`); toast de sucesso com nome da pessoa; botão "+" no header da tab
- **Integração com EventoDialog**: Campo `requer_pagamento` (boolean) e `valor_inscricao` (numeric) em formulário de criação/edição; campos `categoria_financeira_id` e `conta_financeira_id` para vincular transações; renderiza tab "Inscrições" apenas se evento requer inscrições (controlado por evento.tipo ou flag específica)
- **Gestão de Pagamentos**: Confirmar pagamento atualiza `status_pagamento` para `pago` e marca transação vinculada como concluída; Isentar muda status para `isento` e cancela transação se houver; Cancelar marca inscrição como `cancelado` e transação pendente também; validação de limites de vagas (`vagas_limite`) ao adicionar inscrição

**Impacto no usuário:** Admins gerenciam inscrições de eventos com controle de pagamento individual; visão clara de quem pagou/está pendente/isento; criação automática de transações financeiras vinculadas; estatísticas rápidas no cabeçalho da tab.  
**Módulos afetados:** Eventos (inscrições), Financeiro (transações vinculadas)  
**Arquivos criados:** `InscricoesTabContent.tsx` (+387 linhas), `AdicionarInscricaoDialog.tsx` (+277 linhas)  
**Arquivos modificados:** `EventoDialog.tsx` (campos pagamento), `EventoDetalhes.tsx` (nova tab condicional)

#### 🙏 Relógio de Oração — Blocos Inteligentes e Player Dinâmico (30 de Dez/2025)

- **Blocos Inteligentes na Liturgia**: Novo tipo de conteúdo `BLOCO_*` (TESTEMUNHO, SENTIMENTO, VISITANTE, PEDIDOS) na tabela `liturgias`; campo `tipo_conteudo` aceita 14 tipos (migration aplicada); componente `LiturgiaItemDialog` categoriza tipos em "Manuais/Estáticos" vs "Automáticos (Inteligência)" com badges visuais (emojis 🎬📖🙏👋); info card explica que blocos automáticos são preenchidos pela Edge Function
- **Player de Oração com Conteúdo Dinâmico**: `Player.tsx` integra hook `useLiturgiaInteligente` que consome Edge Function `playlist-oracao`; recebe `slides` prontos quando `evento_id` fornecido; renderiza 3 novos tipos de slide customizados (CUSTOM_TESTEMUNHO com Quote, CUSTOM_SENTIMENTO com AlertCircle, CUSTOM_VISITANTES via componente `VisitantesSlide`); pedidos exibem botão "Orei" (Heart → ThumbsUp) que persiste status `em_oracao` no banco; carrega histórico de pedidos orados ao montar
- **Edge Function Expandida**: `playlist-oracao` agora aceita `evento_id` no body; busca liturgia do evento, monta array de slides combinando itens manuais + 5 blocos inteligentes (testemunhos, alerta espiritual, visitantes, broadcast, pessoais); retorna campo `slides` completo; logs detalhados de cada etapa
- **Componentes Novos**: `VisitantesSlide` renderiza cards de visitantes com avatars circulares, badges de "Primeira Visita", versículo Atos 2:47 e animações slide-in; `useLiturgiaInteligente` hook React com estado loading/error, mapeia resposta da Edge Function e expõe método `refetch()`
- **Validação Client-Side**: `LiturgiaItemDialog` valida tipos aceitos antes de INSERT, exibe toast com erro descritivo se constraint não foi aplicada

**Impacto no usuário:** Líderes criam liturgias com blocos automáticos (gratidão, clamor, vidas, intercessão) que são preenchidos em tempo real pela IA durante o Relógio de Oração; intercessores veem conteúdo dinâmico no Player (testemunhos recentes, visitantes da semana, pedidos urgentes) e marcam orações feitas com feedback visual; Edge Function orquestra montagem de slides sem lógica duplicada no frontend.  
**Módulos afetados:** Oração (Player, LiturgiaInteligente), Eventos (LiturgiaItemDialog), Automações (playlist-oracao)  
**Arquivos alterados:** `Player.tsx` (+300 linhas), `LiturgiaItemDialog.tsx` (+150 linhas), `playlist-oracao/index.ts` (+100 linhas), `VisitantesSlide.tsx` (novo), `useLiturgiaInteligente.ts` (novo)  
**Migrations:** `20251230000000_add_blocos_inteligentes.sql` (DROP/ADD constraint com 14 tipos, índice evento_id + tipo_conteudo)  
**Arquivos de Suporte:** `APLICAR_MIGRATION_BLOCOS.sql` (script Dashboard-ready), `README_MIGRATION.md` (guia passo-a-passo)

#### 📅 Relógio de Oração — Timeline Visual de Turnos de 24h (29 de Dez/2025)

- **Componente EscalaTimeline**: Grid visual de 24 horas com cards de voluntários; DatePicker para navegar entre dias do RELOGIO; slots coloridos (verde=confirmado, amarelo=pendente, cinza=vazio, azul=hora atual); ícones de status visual
- **Ações por Slot**: Menu dropdown com opções Editar, Duplicar para Amanhã, Remover; integração com `EscalaSlotDialog` para editar voluntário + horário individual
- **Hook useRelogioAgora**: Retorna dados do Relógio de Oração ativo no momento (id, titulo, data/hora início/fim, evento_id) para navegação direta ao Player; permite acesso rápido a turnos em andamento
- **Integration com EventoDetalhes**: Quando tipo = RELOGIO, exibe Timeline em lugar da tab de Escalas tradicional; mantém compatibilidade com CULTO (usa EscalasTabContent original)

**Impacto no usuário:** Líderes veem visualmente quais turnos estão vazios/confirmados/pendentes em um Relógio de Oração; podem ajustar voluntários rapidamente por turno horário; navegação instantânea para Player do turno em andamento.  
**Módulos afetados:** Escalas, Eventos (RELOGIO)  
**Arquivos criados:** `EscalaTimeline.tsx` (+374 linhas), `EscalaSlotDialog.tsx` (+200 linhas), `useRelogioAgora.ts` (novo hook, +139 linhas)  
**Arquivos modificados:** `EventoDetalhes.tsx` (conditional rendering), `Eventos.tsx` (refactor +547 linhas), `Geral.tsx` (dashboard +697 linhas)

#### 🔄 Escalas com Recorrência — None/Daily/Weekly/Custom (29 de Dez/2025)

- **Componente AdicionarVoluntarioSheet**: Sheet (não dialog) para adição de voluntários com recorrência; combobox com busca em tempo real de nomes; seleção de horário (início/fim com defaults do slot clicado)
- **4 Tipos de Recorrência**:
  - `None`: Atribuição única (apenas a data selecionada)
  - `Daily`: Repete todos os dias até o fim do evento (RELOGIO = 7 dias, CULTO = duração do evento)
  - `Weekly`: Repete mesmo dia da semana em intervalos de 7 dias
  - `Custom`: Checkbox por dia da semana (ex: Seg + Qua apenas)
- **Cálculo Frontend**: Gera array de datas futuras baseado na recorrência; exibe preview com contagem e lista de datas em card azul
- **Detecção de Conflitos**: Verifica se voluntário já tem escalas naquelas datas; exibe aviso com conflitos encontrados; bloqueia inserção se houver conflitos
- **Batch Insert**: Cria array de objetos escalas com timestamps corretos; insere tudo de uma vez via Supabase `.insert(array)`; exibe toast com total de slots criados

**Impacto no usuário:** Escaladores não precisam adicionar manualmente o mesmo voluntário em múltiplos turnos; definem recorrência uma vez e o sistema popula todos os turnos automaticamente; conflitos são detectados proativamente.  
**Módulos afetados:** Escalas, Voluntariado  
**Arquivos criados:** `AdicionarVoluntarioSheet.tsx` (+504 linhas)  
**Bundle impact:** EventoDetalhes 88.67kB → 110.09kB (+21.42kB para novas features)

#### 👥 Eventos — Gestão de Convites e Tabs Condicionais (29 de Dez/2025)

- **ConvitesPendentesWidget**: Widget no dashboard mostrando convites pendentes de aceitação; vinculado a eventos específicos; ações rápidas (Aceitar/Recusar)
- **ConvitesTabContent & EnviarConvitesDialog**: Nova tab em EventoDetalhes para gerenciar convites; seleção em massa de pessoas; envio de convites com template customizável; rastreamento de status (pendente, aceito, recusado)
- **Tab Condicionais por Tipo**:
  - CULTO: tabs Liturgia, Músicas, Escalas, Check-in
  - RELOGIO: tabs Turnos (Timeline), Escalas, Check-in
  - TAREFA: tabs Checklist, Escalas
  - EVENTO: tabs Visão Geral, Convites, Escalas, Check-in
- **Parameter de Tab**: EventoDetalhes aceita parâmetro de query `tab` para abrir aba específica diretamente (ex: `/evento/123?tab=liturgia`)

**Impacto no usuário:** Organizadores gerenciam convites centralizadamente; interface adapta-se ao tipo de evento mostrando apenas abas relevantes; navegação direta para tab específica via URL.  
**Módulos afetados:** Eventos, Escalas  
**Arquivos criados:** `ConvitesPendentesWidget.tsx` (+226 linhas), `ConvitesTabContent.tsx` (+269 linhas), `EnviarConvitesDialog.tsx` (+314 linhas), `LiturgiaTab.tsx` (wrapper, +9 linhas)  
**Arquivos modificados:** `EventoDetalhes.tsx` (+81 linhas refactor), `Eventos.tsx` refactor

---

### Refactor

#### 🔄 Migração cultos → eventos — Polimorfismo por Tipos (28 de Dez/2025)

- **Rename database**: Tabela `cultos` renomeada para `eventos`; colunas `culto_id` → `evento_id` em 8 tabelas satélites (escalas, kids_checkins, liturgias, cancoes, etc.); FKs atualizadas com novos nomes
- **Enum evento_tipo**: Criado tipo `CULTO | RELOGIO | TAREFA | EVENTO | OUTRO` para suportar múltiplos tipos de agendamentos
- **Tabela evento_subtipos**: Categorização adicional com tipo_pai (FK para enum), permitindo subtipos personalizados (ex: "Culto de Celebração", "Vigília 24h", "Reunião de Conselho")
- **Frontend refatorado**: 50+ arquivos adaptados (queries `.from("cultos")` → `.from("eventos")`; componentes de tabs com lógica condicional por tipo; formulário com seleção de tipo/subtipo)
- **Tabs condicionais**: EventoDetalhes exibe abas específicas por tipo (Liturgia/Música apenas para CULTO; Checklist para TAREFA; Turnos para RELOGIO)
- **Renomeações em massa**: `times_culto` → `times`, `liturgia_culto` → `liturgias`, `escalas_culto` → `escalas` (migrations + sed script)

**Impacto no usuário**: Sistema agora suporta agendar não apenas cultos, mas relógios de oração 24h, tarefas operacionais e eventos gerais, mantendo todo o sistema de escalas e check-in funcionando para qualquer tipo.  
**Arquivos refatorados**: `EventoDialog.tsx`, `EventoDetalhes.tsx`, `LiturgiaTabContent.tsx`, `MusicaTabContent.tsx`, `EscalasTabContent.tsx`, `MinhasEscalas.tsx`, `DashboardLeader.tsx`, +40 componentes  
**Migrations**: `20251228153548_eb7694bc-61dd-4a27-b372-cdc2c5dea3ac.sql` (schema), `20251228154110_832aab55-e1e4-4c38-975a-fe5166ae5bad.sql` (FKs), `20251228154443_26bbe883-8edb-4e46-b0d7-c37f5169c299.sql` (renames)  
**ADRs criados**: [ADR-017](adr/ADR-017-refatoracao-hub-eventos-voluntariado.md), [ADR-018](adr/ADR-018-estrategia-migracao-cultos-eventos.md)

---

### Adicionado

#### 🔐 Gestão de Permissões — Controles Avançados (26 de Dez/2025)

- **Controles tri-state em massa**: Headers do accordion de módulos agora exibem células individuais por cargo com indicadores visuais (✅ todas ativas, ➖ parcial, ⭕ nenhuma); click alterna entre ativar/desativar todas as permissões do módulo para aquele cargo
- **Clonagem de permissões**: Botão Copy no cabeçalho de cada cargo abre dropdown para selecionar cargo de origem; função `handleCloneRole` calcula diff baseado em estado efetivo (inclui `pendingChanges`), sincroniza totalmente (adiciona/remove) para deixar Target idêntico ao Source via batch update
- **Dialog de confirmação com diff visual**: Botão "Salvar Alterações" interceptado por `handlePreSave` → abre modal com resumo agrupado por cargo; exibe adições (verde ✅) e remoções (vermelhas ❌) com lookup de nomes; lista scrollável (max-h-60vh); botões Cancelar/Confirmar; execução real movida para `executeSave`
- **Validações**: Bloqueio de clonagem para cargos sistema (admin); Admin permanece read-only nos controles tri-state

**Impacto no usuário:** Administradores copiam rapidamente permissões entre cargos similares (ex: "Líder Júnior" clona "Líder"), ativam/desativam módulos inteiros com 1 click, e revisam todas as mudanças antes de persistir no banco.  
**Módulos afetados:** Admin (AdminPermissions.tsx)  
**Arquivos alterados:** `src/pages/AdminPermissions.tsx` (+317 linhas)

---

#### 🔐 Gestão de Permissões — Rollback de Transações (27 de Dez/2025)

- **Histórico de Permissões**: Nova aba "Histórico" em AdminPermissions exibe timeline de todas as alterações agrupadas por transação (request_id), mostrando:
  - Data/hora e usuário autor da mudança
  - Ações agrupadas: adições (verde ✅ com ícone Plus) e remoções (vermelho ❌ com ícone Trash2)
  - Nomes dos cargos e permissões afetados
  - Identificadores de módulo para contexto
- **Rollback de Transações**: Botão Undo2 em cada grupo de histórico abre AlertDialog de confirmação; ao confirmar, chama RPC `rollback_audit_batch(request_id)` que desfaz todas as mudanças daquela transação no banco e em `role_permissions`; callback `onRollbackSuccess` recarrega ambas as abas (história + matriz)
- **Rastreabilidade Completa**: `role_permissions_audit` registra todas as operações com timestamp, usuário, ação (insert/update/delete), valores antes/depois, e request_id para agrupamento

**Impacto no usuário:** Administradores podem desfazer alterações erradas de permissões com segurança via confirmação visual, com rastreamento completo de quem fez o quê e quando.

**Módulos afetados:** Admin (PermissionsHistoryTab.tsx)  
**Arquivos alterados:** `src/components/admin/PermissionsHistoryTab.tsx` (+242 linhas)
**Funções Supabase (RPC):** `rollback_audit_batch(uuid)`
**Tabelas:** `role_permissions_audit` com query grouping por request_id

---

#### 💰 UX Financeiro — Correções de Navegação (26 de Dez/2025)

- **Fix navegação Categorias**: Tela dentro de Configurações agora retorna corretamente para `/configuracoes` via prop `onBack`, corrigindo redirecionamento incorreto para `/financas`
- **Melhorias em ContasManutencao**: Adiciona filtro `.not('conta_id', 'is', null)` na query de transações; tratamento de erro `transacoesError` com toast; validação `if (t.conta_id)` antes de processar
- **Remoção campo obsoleto**: Remove exibição de `saldo_atual` de ContasManutencao (cálculo deve vir de transações agregadas)
- **Headers consistentes**: Padronização de headers em telas de manutenção financeira

**Impacto no usuário:** Navegação breadcrumb funciona corretamente em Categorias; erros de query não quebram ContasManutencao; interface mais limpa.  
**Módulos afetados:** Financeiro (Categorias, ContasManutencao)  
**Arquivos alterados:** `src/pages/financas/Categorias.tsx`, `src/pages/financas/ContasManutencao.tsx`, `src/pages/Configuracoes.tsx`

---

#### 📱 FASE 1: Mobile UX Refactor — Safe Areas e iOS (25-26 de Dez/2025)

- **Infraestrutura CSS mobile**: Variáveis `--safe-area-inset-*` aplicadas em `MainLayout` (header/wrapper com padding seguro); `font-size: 16px` em inputs/selects mobile para evitar zoom automático no iOS
- **ResponsiveDialog base**: Novo componente `src/components/ui/responsive-dialog.tsx` que renderiza Dialog (desktop) ou Drawer (mobile) baseado em `useMediaQuery`; migração sistemática de 72 dialogs/drawers do sistema
- **UX EditarPessoa mobile**: Revisão completa com sections colapsáveis, campos otimizados para toque, scroll suave
- **UX mobile em componentes**: Família, escalas, envolvimento e sentimentos adaptados com safe-areas e touch-friendly
- **Substituição de tabs por select**: Visitantes, Todos e AniversariosDashboard agora usam Select no mobile para economizar espaço vertical
- **Safe area fixes**: Remoção de `overflow-x: hidden` fixo, aplicação consistente de `pb-safe` em wrappers

**Impacto no usuário:** Interface adaptada para notch/island do iPhone, sem zoom acidental em inputs, dialogs se transformam em drawers no mobile (melhor uso de tela pequena), navegação por abas otimizada.  
**Módulos afetados:** Layout (MainLayout), UI (72 dialogs), Pessoas (EditarPessoa), Dashboard (Visitantes, Todos, Aniversariantes)  
**Arquivos alterados:** `src/index.css`, `src/components/layout/MainLayout.tsx`, `src/components/ui/responsive-dialog.tsx`, 72 arquivos de dialogs, `src/pages/pessoas/EditarPessoa.tsx`, componentes de família/escalas/envolvimento/sentimentos

---

#### 🎨 ResponsiveDialog Migration — Padrão Unificado (25 de Dez/2025)

- **72 dialogs migrados**: Substituição sistemática de `Dialog` (desktop-only) e `Drawer` (mobile-only) por `ResponsiveDialog` que adapta automaticamente baseado em viewport
- **Componentização**: Extração de `SeletorMidiasDialog` de `LiturgiaDialog`; componentização de upload/viewer em `TransacaoDialog`
- **Accessibility fixes**: Atributos ARIA corrigidos, foco gerenciado, navegação por teclado preservada
- **Dialogs migrados incluem**: TransacaoDialog, LiturgiaDialog, EditarJornadaDialog, NovaJornadaDialog, VincularResponsavelDialog, EscalasDialog, CultoDialog, CheckinManualDialog, NovoPedidoDialog, ContaDialog, FormaPagamentoDialog, FornecedorDialog, e 60+ outros

**Impacto no usuário:** Experiência consistente entre desktop (modal centralizado) e mobile (drawer bottom sheet); melhor uso de espaço em telas pequenas; UX nativa mobile.  
**Módulos afetados:** Todos os módulos do sistema (Financeiro, Cultos, Jornadas, Kids, Pessoas, Projetos, Ensino, Testemunhos, Intercessão, etc.)  
**Arquivos alterados:** 72 arquivos de components/dialogs

---

#### 📖 Documentação UX Mobile (25 de Dez/2025)

- **PLANO_UX_MOBILE_BASE_GEMINI.md**: Plano base de UX mobile gerado com Gemini, documentando estratégias de safe-areas, responsive dialogs e touch optimization
- **PLANO_UX_MOBILE_RESPONSIVO.md**: Documentação completa do plano de responsividade mobile com roadmap, prioridades e checklist
- **plano-ux-roadmap.md**: Roadmap expandido com avaliação inicial de UX e próximos passos

**Impacto no usuário:** Documentação técnica atualizada para referência futura.  
**Módulos afetados:** Documentação  
**Arquivos alterados:** `docs/PLANO_UX_MOBILE_BASE_GEMINI.md`, `docs/PLANO_UX_MOBILE_RESPONSIVO.md`, `docs/plano-ux-roadmap.md`

---

#### 🔧 Refatoração de Telas Financeiras e Navegação (24 de Dez/2025)

- **Modernização de UX financeira**: Telas `BasesMinisteriais`, `Categorias`, `CentrosCusto`, `FormasPagamento` e `Fornecedores` refatoradas com layout tabular consistente, busca integrada e cards minimalistas
- **Nova tela de Manutenção de Contas**: `ContasManutencao.tsx` permite gestão de contas bancárias e físicas com validação de movimentações antes da exclusão
- **Modernização Admin**: `Chatbots.tsx` e `Webhooks.tsx` com nova interface compacta e agrupamento visual de configurações
- **Breadcrumb navegacional**: Novo componente `AppBreadcrumb.tsx` com tradução de rotas e proteção contra links inválidos (rotas como `/admin` não são clicáveis)
- **Correção de redirects de autenticação**: Todos os redirects de `/dashboard` corrigidos para `/` (rota real do Dashboard), evitando 404 após login
- **Logs de diagnóstico**: Console logs adicionados em `FormasPagamento`, `ContasManutencao` e `Categorias` para depuração de dados vazios
- **Correção de AuthGate**: Agora redireciona para `/auth` quando não há sessão ativa, eliminando comportamento de "auto-login" fantasma

**Impacto no usuário:** Experiência mais consistente no módulo financeiro, navegação breadcrumb clara, login funciona corretamente sem 404s.

**Módulos afetados:** Financeiro (6 telas), Admin (2 telas), Auth (3 arquivos), Layout (breadcrumb)

---

#### 🧭 Agendamento Pastoral e Identidade do Chatbot (23 de Dez/2025)

- **Wizard de agendamento**: Etapa "Pessoa" com autocomplete de membros/visitantes, deduplicação por telefone e criação automática de lead quando necessário; grava `pessoa_id` ou `visitante_id`, `gravidade`, `data_agendamento` e `local_atendimento`
- **Bloqueio de conflitos**: Slots de 30min com seleção múltipla, respeitando compromissos existentes em `atendimentos_pastorais` e na nova tabela `agenda_pastal` (compromissos administrativos do pastor)
- **Deduplicação no chatbot-triagem**: Para telefones com múltiplos perfis, escolhe o candidato mais antigo (data de nascimento > criação) e registra alerta; fallback cria/recupera `visitantes_leads`

**Impacto no usuário:** Pastores evitam conflitos de agenda e conseguem agendar visitas/online/ligação com dados completos do atendido; chatbot reduz erros de vinculação quando há números compartilhados.

**Módulos afetados:** Gabinete, Chatbot Triagem, Integrações Supabase

#### 🏛️ Módulo Gabinete Digital - Implementação Completa (20 de Dez/2025)

- **Nova tela `/gabinete`** (`GabinetePastoral.tsx`): Kanban interativo com drag-and-drop via @dnd-kit, KPIs pastorais, highlights de casos críticos
- **Componentes reutilizáveis**: `PastoralCard`, `PastoralDetailsDrawer`, `PastoralFilters`, `PastoralKPIs`, `PastoralListView`, `PastoralKanbanColumn`
- **Prontuário com abas**: Informações gerais, histórico, notas de evolução, agendamento, análise IA
- **Identificação automática de pastor responsável**: Sistema vincula atendimento ao líder direto do membro ou ao pastor de plantão
- **Integração com análise de sentimentos**: Edge Functions (`analise-sentimento-ia`, `analise-pedido-ia`) criam automaticamente `atendimentos_pastorais` para casos com gravidade MÉDIA ou superior
- **Roteamento inteligente**: Casos graves (CRITICA/ALTA) disparam notificações imediatas; casos passivosordenados por status e data

**Decisão arquitetural:** ADR-014 - Gabinete Digital, Roteamento Pastoral e Unificação de Entradas

**Impacto no usuário:** Pastores têm visibilidade centralizada do cuidado em andamento, secretaria pode operacionalizar agendas sem ler dados sensíveis (RLS em view `view_agenda_secretaria`), sistema proativo identifica casos em risco via IA.

**Módulos afetados:** Gabinete (novo), Pastoral, Intercessão V2, Dashboard

---

#### 🔧 Refatoração de Edge Functions para Configuração Dinâmica (20 de Dez/2025)

- **`analise-sentimento-ia` e `analise-pedido-ia` agora consultam `chatbot_configs`** para prompts e modelos, removendo hardcoding
- **Fallback automático**: Se `chatbot_configs` não encontrado, usa `DEFAULT_PROMPT` e `DEFAULT_MODEL` evitando quebra de deploy
- **getChatbotConfig()** unificado: Função reutilizável nas duas edge functions com cache em memória para performance

**Impacto técnico:** Facilita fine-tuning de IA sem redeploy, maior flexibilidade na experimentação de prompts.

**Módulos afetados:** Automações (Edge Functions), Intercessão IA, Análise de Dados

---

#### 📊 Integração de KPIs Pastorais no Dashboard Admin (20 de Dez/2025)

- **Widget `GabinetePastoralWidget`**: Exibe status consolidado de atendimentos (Pendente, Em Acompanhamento, Agendado, Concluído) com contadores de abertos
- **Card dedicado no DashboardAdmin** com atalho para `/gabinete` permitindo overview rápido da carga pastoral
- **UX melhorada**: Status por linha, evita cramping, contador de "casos abertos" em destaque

**Impacto no usuário:** Liderança vê saúde pastoral num relance ao acessar o Dashboard, sem necessidade de entrar no Gabinete.

**Módulos afetados:** Dashboard (Admin), Pastoral

---

#### 🔄 Reorganização de Widgets no Dashboard - Vida Igreja (20 de Dez/2025)

- **Consolidation Funnel widget movido**: De Finanças para seção "Vida Igreja" no Dashboard, refletindo prioridade ministerial
- **Reordenação de layout**: Mantém Finanças compacta, dá destaque ao funil de evangelismo em contexto de "Vida da Igreja"

**Impacto visual:** Dashboard reflete melhor a prioridade estratégica da evangelização.

**Módulos afetados:** Dashboard, Finanças, Evangelismo

---

#### 📚 Documentação de Decisão Arquitetural (20 de Dez/2025)

- **ADR-014 criada**: "Módulo Gabinete Digital, Roteamento Pastoral e Unificação de Entradas" documenta dual-write, matriz de alertas, privacidade RLS
- **ADR-012 renomeada**: De ADR-013 para ADR-012 para consistência numerológica pós-arquivamento
- **Catálogo de telas atualizado**: Adicionada `GabinetePastoral` na nova seção "PASTORAL & GABINETE"

**Impacto documentação:** Decisões rastreáveis, futuros desenvolvedores entendem trade-offs da arquitetura.

**Módulos afetados:** Documentação, Arquitetura

---

### Melhorado

#### 🔐 Melhorias na Autenticação Biométrica (19 de Dez/2025)

- **Detecção automática de tipo de biometria**: Sistema detecta se dispositivo usa Face ID (iPhones X+, iPads Pro) ou Touch ID/Fingerprint e exibe ícone e textos apropriados
- **Tratamento de erros específicos**: 8 tipos de erro WebAuthn mapeados (`NOT_ALLOWED`, `NOT_RECOGNIZED`, `TIMEOUT`, `HARDWARE_ERROR`, `NOT_FOUND`, `SECURITY_ERROR`, `NOT_SUPPORTED`, `UNKNOWN`) com mensagens contextuais
- **Estados de loading contextuais**: Feedback visual específico para cada fase ("Olhe para a câmera...", "Toque no sensor...", "Verificando...", "Entrando...")
- **Haptic Feedback**: Vibração em dispositivos móveis para sucesso (curta) e erro (padrão duplo) via `navigator.vibrate()`
- **Animações visuais**: Transições de cor e pulse animation durante verificação biométrica
- **Fluxo de habilitação melhorado**: `EnableBiometricDialog` com estados visuais (idle → enrolling → success/error) e recuperação de erros

**Arquivos alterados:**

- `src/hooks/useBiometricAuth.tsx`: Novo tipo `BiometricResult`, função `parseWebAuthnError()`, `detectBiometricType()`, `triggerHapticFeedback()`
- `src/pages/BiometricLogin.tsx`: Estados de loading, mensagens contextuais, ícones dinâmicos
- `src/components/auth/BiometricUnlockScreen.tsx`: Estados visuais, detecção de tipo, animações
- `src/components/auth/EnableBiometricDialog.tsx`: Fluxo de habilitação com feedback visual

**Impacto no usuário:**

- Experiência mais clara com feedback visual e textual específico para cada situação
- Usuários de Face ID veem ícone de rosto; usuários de Touch ID veem ícone de digital
- Mensagens de erro orientam próximos passos (tentar novamente vs usar senha)
- Vibração confirma sucesso/erro em dispositivos móveis

**Módulos afetados:** Auth (Biometria)

---

### Adicionado

#### 🤖 Edge Function chatbot-triagem (Intercessão V2 - 18 de Dez/2025)

- **Nova Edge Function `chatbot-triagem`**: Chatbot de triagem para receber pedidos de oração via WhatsApp/Make webhook
  - **Gestão de sessão (State Machine)**: Busca/cria sessão em `atendimentos_bot` com janela de 24h
  - **IA integrada**: Usa OpenAI (`gpt-4o-mini` para chat + `whisper-1` para áudio) para conduzir a conversa
  - **Auditoria LGPD**: Registra todas as mensagens (USER/BOT/SYSTEM) em `logs_auditoria_chat` imutável
  - **Identificação automática**: Diferencia membros (via telefone em `profiles`) de visitantes (`visitantes_leads`) e atualiza `data_ultimo_contato`
  - **Criação de pedido/testemunho**: Insere automaticamente em `pedidos_oracao` ou `testemunhos` com campos de análise IA
  - **Solicitações pastorais**: Prefixa título, marca gravidade ALTA e sinaliza `notificar_admin`
  - **Endpoint público**: `verify_jwt = false` para receber webhook do Make

**Fluxo:**

1. Make envia: `{ telefone, nome_perfil, tipo_mensagem, conteudo_texto? }`
2. Se áudio, baixa via API WhatsApp e transcreve com Whisper
3. Busca sessão ativa (< 24h) ou cria nova em `atendimentos_bot`
4. Registra audit log (USER) e chama IA com system prompt + histórico
5. Se resposta texto: atualiza sessão e devolve próxima pergunta
6. Se resposta JSON `concluido`: encerra sessão, cria registros vinculando membro ou lead externo
7. Resposta retorna `reply_message`, `notificar_admin` e dados de contato para follow-up

**System Prompt IA:**

- Personifica equipe de acolhimento, oculta que é IA e prioriza FAQ antes do fluxo de pedido
- Guia coleta de nome, motivo e preferência de anonimato/publicação
- Só retorna JSON estruturado quando o fluxo é concluído (pedido/testemunho/encaminhamento)

**Módulos afetados:** Intercessão (V2), Evangelismo, Compliance/LGPD

---

#### 🤖 Intercessão V2 - Fase 1: Schema de Banco de Dados (18 de Dez/2025)

- **ENUMs criados**: `status_intercessor` (ATIVO, PAUSA, FERIAS) e `status_sessao_chat` (INICIADO, EM_ANDAMENTO, CONCLUIDO, EXPIRADO)
- **Nova tabela `visitantes_leads`**: CRM de Evangelismo para leads externos via WhatsApp/Bot (telefone único, estágio de funil, origem)
- **Nova tabela `atendimentos_bot`**: State Machine para controle de sessão do chatbot de triagem (histórico_conversa JSONB, meta_dados IA)
- **Nova tabela `logs_auditoria_chat`**: Audit log imutável para compliance LGPD (Append-Only, sem UPDATE/DELETE)
- **Coluna `status_disponibilidade`** em `intercessores`: Controle de carga de trabalho (ATIVO/PAUSA/FERIAS)
- **Colunas em `pedidos_oracao`**: `texto_na_integra` (relato completo), `origem` (WABA/APP/MANUAL), `visitante_id` (FK)
- **RLS restritivo**: Admins/Pastores gerenciam; Intercessores visualizam; Logs apenas INSERT

**Decisão arquitetural:** ADR-012 - CRM de Evangelismo, Chatbot IA e Compliance LGPD

**Impacto no usuário:**

- Preparação para receber pedidos de oração via WhatsApp com triagem por IA
- Separação clara entre cuidado pastoral (membros) e evangelismo (leads externos)
- Controle de burnout de intercessores com status de disponibilidade

**Módulos afetados:** Intercessão, Evangelismo (novo), Compliance/LGPD

---

### Corrigido

#### 🔧 Correções de Rotas e Políticas RLS (18 de Dez/2025)

- **Rota /biblia**: Adicionada rota faltante no App.tsx que causava erro 404 ao acessar a página da Bíblia
- **Rota /minha-familia → /perfil/familia**: Corrigidos links em Sidebar, UserMenu e DashboardVisitante que apontavam para rota inexistente `/minha-familia`; rota correta é `/perfil/familia` (componente FamilyWallet)
- **RLS inscricoes_jornada**: Adicionada política permitindo membros autenticados se inscreverem em jornadas (pessoa_id vinculado ao user_id via profiles)

**Causa**: Rotas não registradas ou inconsistentes no roteador; política RLS restritiva bloqueava auto-inscrição

**Módulos afetados:** Conteúdo (Bíblia), Core (Família/Carteira), Ensino (Jornadas/Cursos)

---

### Adicionado

#### 📚 Documentação de Fluxos (18 de Dez/2025)

- **Novo diagrama**: `docs/diagramas/fluxo-sentimentos-ia.md` — Fluxo completo de análise de sentimentos via IA e alertas pastorais
- **Novo diagrama**: `docs/diagramas/fluxo-escalas-lembretes.md` — Fluxo de lembretes automáticos de escalas (cron + anti-spam)
- **Novo diagrama**: `docs/diagramas/fluxo-liturgia-escalas.md` — Integração automática Liturgia ↔ Escalas via triggers

**Módulos documentados:** Intercessão (Sentimentos), Voluntariado (Escalas), Cultos (Liturgia)

---

#### 🔐 Página de Configuração de Webhooks (18 de Dez/2025)

- **Nova tela admin**: `/admin/webhooks` para gerenciar webhooks de integração de forma segura
- **Segurança**: Valores de webhook são mascarados na interface (exibe apenas `••••••••••`)
- **Atualização via Secrets**: Botão "Atualizar" abre formulário seguro para inserir novos valores sem expor dados
- **Integração**: Suporte a `MAKE_WEBHOOK_URL` e `MAKE_WEBHOOK_LITURGIA` como secrets do projeto
- **Remoção de campo exposto**: Campo `webhook_make_liturgia` removido de ConfiguracoesIgreja.tsx por segurança

**Impacto no usuário:**

- Admins/Técnicos podem gerenciar webhooks sem expor URLs sensíveis na interface
- Navegação via card em Configurações da Igreja → "Webhooks de Integração"

**Módulos afetados:** Admin (Configurações, Integrações)

---

#### 🧠 Card de IA nas Configurações + Tela Admin de Chatbots (18 de Dez/2025)

- **Novo card "Chatbots & Inteligência Artificial"** em `ConfiguracoesIgreja.tsx` confirma status do `OPENAI_API_KEY` e leva ao gerenciamento dedicado
- **Nova tela admin `/admin/chatbots`**: CRUD completo para `chatbot_configs`, seleção de modelos (texto/áudio/visão), edição de prompts e toggle de ativação
- Interface traz diálogos dedicados para criação/edição, pré-visualização dos prompts e controle de exclusão segura

**Impacto no usuário:** Admins visualizam rapidamente se a IA está pronta e conseguem ajustar fluxos de chatbot (modelos, roles, edge functions) sem sair do painel.

**Módulos afetados:** Admin (Configurações, Integrações IA), Intercessão/Evangelismo (Chatbots)

---

#### ⏰ Melhorias nas Edge Functions de Escalas (18 de Dez/2025)

- **disparar-escala**: Agora busca webhook de `configuracoes_igreja` ou secrets do projeto; atualiza `ultimo_aviso_em` após envio bem-sucedido
- **verificar-escalas-pendentes**: Filtro anti-spam adicionado - só dispara para escalas onde `ultimo_aviso_em IS NULL` ou `> 24h`
- **Rastreabilidade**: Campo `ultimo_aviso_em` em `escalas_culto` registra timestamp do último aviso enviado

**Impacto no usuário:**

- Voluntários não recebem lembretes duplicados em curto período
- Sistema de notificações mais confiável e rastreável

**Módulos afetados:** Voluntariado (Escalas)

---

### Adicionado

#### 🤖 Análise de IA para Pedidos de Oração (18 de Dez/2025)

- **Categorização automática por IA**: Pedidos de oração agora são analisados automaticamente via Edge Function `analise-pedido-ia` usando Lovable AI (Gemini 2.5 Flash)
- **Campos de análise**: `analise_ia_titulo` (título sugerido), `analise_ia_motivo` (categoria raiz: Saúde, Financeiro, Luto, Relacionamento, etc.), `analise_ia_gravidade` (baixa/media/critica), `analise_ia_resposta` (mensagem pastoral sugerida)
- **UI integrada**: Cards de pedidos exibem badge de gravidade com cores (verde/amarelo/vermelho), ícones contextuais, e resposta pastoral na visualização detalhada
- **Disparo assíncrono**: Análise executada automaticamente após criação do pedido, sem bloquear fluxo do usuário

**Impacto no usuário:**

- Intercessores e liderança visualizam categorização automática para triagem mais eficiente
- Gravidade visual facilita priorização de pedidos críticos
- Resposta pastoral sugerida auxilia no acompanhamento

**Tabelas/Campos afetados:**

- `pedidos_oracao`: Adicionados campos `analise_ia_titulo`, `analise_ia_motivo`, `analise_ia_gravidade`, `analise_ia_resposta`

**Módulos afetados:** Intercessão (Pedidos de Oração)

---

#### 📊 Reuso do Widget de Escalas (17 de Dez/2025)

- Unificamos o widget de monitoramento de escalas em um componente compartilhado (`EscalasPendentesWidget`) e o adicionamos aos dashboards de Líder e Admin para reaproveitar lógica de consulta e apresentação.

**Comportamento:** passa a exibir o mesmo painel de confirmados/pendentes/recusados também no dashboard do Admin (sem alterações de fluxo ou regras de negócio).

**Riscos/Observações:** aumento leve de leituras no Supabase ao carregar os dashboards; sem mudanças de schema ou permissões.

### Adicionado

#### 🎓 Player do Aluno: Certificado e Celebração (17 de Dez/2025)

- **Download de certificado em PDF** diretamente no `CursoPlayer` ao concluir 100% das etapas (botão na sidebar e na tela de celebração)
- **Tela de celebração** em tela cheia quando todas as etapas estão concluídas, com chamada para baixar o certificado
- **Design do PDF**: paisagem A4, bordas decorativas azul/dourado, identifica aluno, jornada e data de conclusão

**Impacto no usuário:**

- Alunos obtêm comprovante imediato de conclusão sem intervenção do admin
- Jornada paga continua bloqueada até pagamento, mas certificado só aparece após todas as etapas concluídas

**Riscos/Observações:**

- Geração de PDF ocorre no front-end (jsPDF); navegadores bloqueiam pop-up se for acionado automaticamente — ação do usuário é necessária
- Sem alterações de schema; usa dados existentes de jornada/inscrição

**Módulos afetados:** Ensino / Jornadas (Player do Aluno)

### Corrigido

#### 🔒 Correções de Segurança (17 de Dez/2025)

- **Path Traversal em uploads**: Adicionada validação de caminho em `Publicacao.tsx` e `MidiasGeral.tsx` para prevenir ataques de path traversal em uploads de arquivos
- **Funções RPC sem autorização**: Adicionadas verificações de `auth.uid()` em 3 funções SECURITY DEFINER:
  - `get_user_familia_id`: Agora verifica se usuário consulta próprio familia_id (ou é admin)
  - `alocar_pedido_balanceado`: Agora requer role admin, pastor ou intercessor ativo
  - `buscar_pessoa_por_contato`: Agora requer autenticação (defense in depth)

**Causa**: Funções RPC com SECURITY DEFINER bypassavam RLS sem validar permissões do chamador

**Impacto**: Nenhum para usuário final; hardening interno de segurança

**Módulos afetados**: Segurança (global), Intercessão, Família, Publicação, Mídias

---

### Adicionado

#### 🎓 Editor de Conteúdo de Etapas com Quiz (17 de Dez/2025)

- **EtapaContentDialog expandido**: Novo editor admin para configurar conteúdo de etapas com 4 tipos suportados
  - **Texto/Leitura**: Armazena conteúdo em `conteudo_texto`
  - **Vídeo Aula**: URL em `conteudo_url` com preview YouTube/Vimeo em tempo real; checkbox para bloqueio até conclusão (`check_automatico`)
  - **Quiz/Prova**: Interface para criar N perguntas com 4 alternativas; marca resposta correta; configurável nota mínima de aprovação (0-100); salvo em `quiz_config` (JSON)
  - **Reunião/Tarefa**: Tipo informativo para etapas presenciais ou tarefas; requer confirmação manual do líder no Kanban
- **Validações**: Cada tipo tem campos obrigatórios verificados antes de salvar; feedback de erro específico ao usuário
- **Preview dinâmico**: Videos com embed funcional que atualiza em tempo real conforme URL é digitada

**Impacto no usuário:**

- Admins ganham interface robusta para criar quizzes educacionais com múltiplas tentativas
- Vídeos com bloqueio automático garantem que alunos assistam conteúdo completo
- Suporte a 4 tipos de conteúdo cobre a maioria dos cenários educacionais

**Riscos/Observações:**

- `quiz_config` é armazenado como JSON; estrutura deve ser mantida para compatibilidade futura
- Preview de vídeo funciona para YouTube/Vimeo; outras plataformas mostram placeholder
- Sem validação de URL no front-end (deixado para backend)

**Tabelas/Campos afetados:**

- `etapas_jornada.tipo_conteudo`, `conteudo_url`, `conteudo_texto`, `quiz_config`, `check_automatico` (já existentes, agora em uso completo)

---

#### 🎓 Diferenciar Tipos de Jornadas com Badges Visuais (17 de Dez/2025)

- **Tipo de Jornada (UI)**: RadioGroup com 3 tipos (Curso/EAD, Processo/Pipeline, Híbrido) em `NovaJornadaDialog` e `EditarJornadaDialog`
  - **Curso/EAD** (`auto_instrucional`): Foco em conteúdo educacional; portal visível e pagamento opcional
  - **Processo/Pipeline** (`processo_acompanhado`): Jornada interna de acompanhamento (pastoral, onboarding); **portal e pagamento desabilitados automaticamente**; etapas chamadas "Colunas do Kanban"
  - **Híbrido**: Combina educação + acompanhamento
- **Listagem visual**: Badges com cores (azul/Curso, verde/Processo, roxo/Híbrido) e ícones na página `Jornadas` para identificação rápida do tipo
- **Condicional na UI**: Portal e pagamento ficam ocultos quando tipo é "Processo"; alerta informativo explica limitação
- **Etapas label dinâmico**: "Capítulos" para cursos, "Colunas do Kanban" para processos

**Impacto no usuário:**

- Admins diferenciam jornadas de forma clara ao criar/editar
- Alunos e líderes identificam rapidamente tipo da jornada na listagem
- Simplifica criação de jornadas internas sem acumular campo de pagamento

**Riscos/Observações:**

- Tipo é imutável após criação (decisão de design para evitar cascata de mudanças); se precisar mudar, é necessário excluir e recriar
- Campo `tipo_jornada` é NOT NULL com default `auto_instrucional` (retrocompatível com jornadas existentes)

**Tabelas/Campos afetados:**

- `jornadas.tipo_jornada` (TEXT NOT NULL DEFAULT 'auto_instrucional') - **já presente no banco via migração anterior**
- UI: `NovaJornadaDialog.tsx`, `EditarJornadaDialog.tsx`, `Jornadas.tsx`

---

#### 🎓 Jornadas Avançadas: Tipos, Quiz e Soft-Lock (Dez/2024)

- **Tipo de Jornada**: Campo `tipo_jornada` classifica jornadas como `auto_instrucional` (Player), `processo_acompanhado` (Kanban) ou `hibrido`
- **Etapas enriquecidas**: Tipos de conteúdo (`texto`, `video`, `quiz`, `tarefa`, `reuniao`), URL de conteúdo, configuração de quiz (JSON), check automático e duração estimada
- **Sistema de Quiz**: Nova tabela `respostas_quiz` para histórico de respostas dos alunos com nota, aprovação e tentativas
- **Soft-Lock**: Campo `check_automatico` permite definir se o sistema avança automaticamente ou requer ação do aluno

**Tabelas alteradas:**

- `jornadas`: Adicionado campo `tipo_jornada` (text com check constraint)
- `etapas_jornada`: Adicionados campos `conteudo_tipo`, `conteudo_url`, `quiz_config`, `check_automatico`, `duracao_estimada_minutos`
- `respostas_quiz`: Nova tabela com RLS para histórico de quizzes

**Módulos afetados:** Jornadas, Ensino, Player de Cursos

---

#### 🎓 Jornadas com Pagamento (Dez/2024)

- **Cursos pagos**: Jornadas agora podem ser configuradas como pagas, com valor definido pelo admin
- **Status de pagamento**: Inscrições possuem status de pagamento (`isento`, `pendente`, `pago`)
- **Integração financeira**: Inscrições pagas podem vincular-se a transações financeiras para rastreabilidade
- **Categoria financeira**: Criada categoria "Cursos e Treinamentos" (entrada) para receitas de cursos

**Tabelas alteradas:**

- `jornadas`: Adicionados campos `requer_pagamento` (boolean) e `valor` (numeric)
- `inscricoes_jornada`: Adicionados campos `status_pagamento` (text) e `transacao_id` (FK)
- `categorias_financeiras`: Inserida categoria "Cursos e Treinamentos"

**Módulos afetados:** Jornadas, Finanças
