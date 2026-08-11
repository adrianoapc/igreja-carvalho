-- ============================================================================
-- Ciclo 2 (C2-6) — Separação extrato/cartão: nova estrutura (aditivo)
--
-- Primeira etapa da separação estrutural do espelho sintético em
-- `extratos_bancarios` (causa raiz do mecanismo `possivel_duplicata_de`,
-- PR #55/migration 20260717150000). Constrói a estrutura nova que vai
-- substituir o espelho — SEM desligar nada em produção ainda (isso é a
-- C2-7). Puramente aditivo: nenhum consumidor existente muda de fonte.
--
-- `getnet_credito_disponivel` é uma VIEW (não tabela própria) sobre
-- `getnet_resumo`/`getnet_financeiro_resumo`, já existentes e já
-- alimentadas pelo pipeline de importação (`getnet-sftp/index.ts`) —
-- expor o dado direto evita uma segunda cópia gravada que pode divergir
-- do dado bruto (o mesmo problema estrutural que esta fase existe pra
-- resolver). Replica EXATAMENTE os dois critérios hoje usados pra montar
-- o espelho em `extratos_bancarios` (`buildResumoRow`/
-- `selecionarEspelhoTipo5`/`resolverUsoTipo5` em
-- `getnet-sftp/getnetExtratoParser.ts` e `index.ts` ~1255-1300):
--
--   • tipo 1 (LQ, `getnet_resumo`): indicador_tipo_pagamento = 'LQ'.
--     valor já vem com sinal aplicado (`valor_liquido`, gravado por
--     `buildResumoRow` como `sinal='-' ? -abs(valor) : valor` — reaplicar
--     o mesmo sinal aqui seria idempotente, então usa a coluna direto).
--   • tipo 5 (PG, `getnet_financeiro_resumo`): tipo_operacao = 'PG'
--     (Regra Geral #10 do manual — só PG é "valores livres creditado na
--     conta do estabelecimento"; os demais tipos são liquidação contábil
--     de dinheiro já adiantado, não crédito novo).
--
-- A escolha entre as duas fontes é POR ARQUIVO, travada em
-- `getnet_arquivos.espelho_origem` na 1a importação (F6, migration
-- 20260713140000) — a view faz o mesmo JOIN condicional, nunca as duas
-- fontes ao mesmo tempo pro mesmo arquivo. NULL (arquivo importado antes
-- da F6) conta como tipo 1, mesma regra do código.
--
-- `conta_id`/`filial_id` não existem em `getnet_financeiro_resumo` (só
-- `igreja_id`) — vêm de `integracoes_financeiras` (mesma fonte usada por
-- `ingerirExtratos` na importação: `config->sftp->>conta_id` e
-- `integracao.filial_id`), join único pras duas fontes.
--
-- Identidade da linha é `(origem_tabela, origem_id)` — o id nativo da
-- linha em `getnet_resumo`/`getnet_financeiro_resumo`. Não tenta
-- reconstruir o `external_id` usado no dedupe de `extratos_bancarios`: é
-- um artefato interno da ingestão (e o componente de valor do tipo5 vem
-- de um float JS formatado por `String()`, sem garantia de bater
-- byte-a-byte com `numeric::text` do Postgres pra valores como X,X0); a
-- view expõe o dado do domínio, não o identificador de dedupe.
--
-- `security_invoker = true` (convenção já estabelecida no repo, migrations
-- 20251203013244/20251204022222/20251208160649): sem isso, RLS das tabelas
-- base seria avaliada com o OWNER da view (role de migration, super-role),
-- não com quem consulta — vazamento cross-tenant. Com `security_invoker`,
-- a view herda exatamente a mesma RLS que já existe em
-- `getnet_resumo`/`getnet_financeiro_resumo`/`getnet_arquivos`/
-- `integracoes_financeiras` — nem mais nem menos restritiva.
--
-- Nota de segurança herdada (não nova, não escondida): a RLS de
-- `getnet_resumo`/`getnet_financeiro_resumo`/`getnet_arquivos` hoje só
-- filtra por `igreja_id` + papel, sem checar `filial_id` — mesmo gap já
-- documentado pra outras tabelas Getnet (auditoria dedicada fora desta
-- PR, ver `docs/guardrails-financeiro.md`). A view não piora nem
-- corrige esse gap, só herda o que as tabelas base já expõem hoje.
--
-- ATENÇÃO pra quem consumir esta view na C2-7: `filial_id` vem exposto
-- na coluna mas NÃO é filtrado por nenhuma RLS — qualquer RPC/tela nova
-- que ler `getnet_credito_disponivel` precisa aplicar `has_filial_access`
-- (ou, em query direta, o padrão `filial_id.eq.X,filial_id.is.null` do
-- guardrail A.1) explicitamente, do mesmo jeito que toda RPC `fin_*`
-- já faz — não confiar na RLS herdada pra isso, ela não cobre filial.
-- Nenhum consumidor lê esta view ainda (por isso não é RPC SECURITY
-- DEFINER com o checklist do guardrail B — puramente aditivo, sem
-- superfície nova de acesso além do que `getnet_resumo`/
-- `getnet_financeiro_resumo` já expõem hoje).
--
-- (achados do /code-review local desta fase, aplicados abaixo)
-- `JOIN` em `getnet_arquivos` virou `LEFT JOIN` + allow-list explícita
-- (`espelho_origem IS NULL OR = 'getnet_sftp_txt'`): um `INNER JOIN`
-- excluiria silenciosamente linhas de um arquivo cujo import falhou
-- ENTRE gravar getnet_resumo/getnet_financeiro_resumo e gravar
-- getnet_arquivos (index.ts só grava getnet_arquivos "only after all
-- upserts succeed", comentário do próprio pipeline) — nesse caso não
-- existe linha nenhuma em getnet_arquivos pro arquivo, não é um
-- espelho_origem NULL; a política de fallback documentada acima ("NULL
-- conta como tipo 1") tratava só o segundo caso, não o primeiro. Uma
-- deny-list (`IS DISTINCT FROM 'getnet_sftp_tipo5'`) também classificaria
-- errado qualquer 3º valor futuro de espelho_origem como tipo1; a
-- allow-list falha seguro (linha some da view, não é classificada errado).
-- `conta_id` ganhou guarda de formato antes do `::uuid`: um valor
-- malformado em `config->sftp->>conta_id` de QUALQUER integração Getnet
-- (LQ/PG) derrubava a view inteira pra todo mundo (erro de cast não é
-- por linha, é da query toda) — agora vira NULL em vez de estourar.
--
-- (achados do `@codex review` na PR, aplicados abaixo)
--
-- **P1 — conta_id precisa ser congelado no momento do import, não relido
-- da config atual.** A versão original desta view resolvia `conta_id`
-- via `integracoes_financeiras.config->sftp->>conta_id` em TEMPO DE
-- CONSULTA — se um operador editar a "Conta destino" da integração
-- depois (`IntegracoesCriarDialog.tsx` permite), TODO o histórico já
-- importado reatribuiria retroativamente pra conta nova. O espelho
-- legado em `extratos_bancarios` não tem esse problema porque
-- `ingerirExtratos` grava o `conta_id` resolvido NAQUELE MOMENTO,
-- congelado pra sempre. Fix: `getnet_resumo`/`getnet_financeiro_resumo`
-- ganham coluna própria `conta_id`, populada por `buildResumoRow`/
-- `finResRows` (`getnet-sftp/index.ts`) com o mesmo `contaId` já
-- resolvido pra `ingerirExtratos` — nunca mais relida da config depois
-- do import. Backfill das linhas históricas abaixo é best-effort (usa a
-- config ATUAL, única fonte disponível — não há como recuperar
-- retroativamente qual conta estava configurada em cada import
-- passado); documentado, não escondido, mesmo padrão de limitação de
-- backfill já usado na C2-3 (`valor_liquido_cobranca`).
--
-- **P1 — `ON DELETE CASCADE` de `integracao_id` é incompatível com esta
-- view virar fonte de verdade durável (BLOQUEIA a C2-7, não corrigido
-- nesta PR).** `getnet_resumo`/`getnet_financeiro_resumo`/
-- `getnet_arquivos` referenciam `integracoes_financeiras(id) ON DELETE
-- CASCADE` — excluir uma integração (`Integracoes.tsx` permite) apaga
-- TODO o histórico de crédito dessas 3 tabelas, e com ele todo o
-- histórico desta view. O espelho `extratos_bancarios` não tem FK pra
-- `integracoes_financeiras` e sobrevive a essa exclusão hoje. Mudar o
-- `ON DELETE` de FKs já existentes é o tipo de mudança que o guardrail J
-- (`docs/guardrails-financeiro.md`) pede tratamento dedicado (efeito
-- colateral fácil de não perceber) — decisão deliberada de NÃO misturar
-- esse redesenho de durabilidade nesta PR aditiva. Hoje, excluir uma
-- integração já tem exatamente este mesmo blast radius nas 3 tabelas
-- (comportamento pré-existente, não introduzido aqui); esta view só
-- herda essa fragilidade. **Pré-condição obrigatória antes da C2-7**
-- (cutover de consumidores): resolver isso — arquivar em vez de excluir,
-- ou remover o cascade — antes de qualquer tela/RPC depender desta view
-- como fonte durável.
-- ============================================================================

-- Cast seguro de uuid — evita repetir a guarda de formato em 3 lugares
-- (backfill de conta_id nas duas tabelas + fallback da view).
CREATE OR REPLACE FUNCTION public.getnet_safe_uuid(p_value text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN p_value::uuid
  END
$$;

COMMENT ON FUNCTION public.getnet_safe_uuid(text) IS
  'Cast text->uuid que devolve NULL em vez de estourar erro pra valor malformado (ex.: config JSONB editável por operador). Usado no backfill/fallback de conta_id de getnet_credito_disponivel (C2-6).';

-- security_invoker=true na view abaixo: quem consulta a view executa esta
-- função como o próprio papel (authenticated), não como o owner — precisa
-- de EXECUTE explícito, senão a view falha com "permission denied" pra
-- todo mundo que não seja o owner/superuser.
GRANT EXECUTE ON FUNCTION public.getnet_safe_uuid(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.getnet_safe_uuid(text) FROM anon;

-- `conta_id` congelado no momento do import (achado Codex P1 acima).
ALTER TABLE public.getnet_resumo
  ADD COLUMN IF NOT EXISTS conta_id uuid;
ALTER TABLE public.getnet_financeiro_resumo
  ADD COLUMN IF NOT EXISTS conta_id uuid;

COMMENT ON COLUMN public.getnet_resumo.conta_id IS
  'Conta destino resolvida no momento do import (config->sftp->>conta_id da integração NAQUELE momento) — nunca relida depois, pra editar a integração não reatribuir histórico já importado. Linhas anteriores a esta coluna foram backfilled com a config atual (melhor esforço, ver migration 20260812120000).';
COMMENT ON COLUMN public.getnet_financeiro_resumo.conta_id IS
  'Mesma semântica de getnet_resumo.conta_id — ver comentário lá.';

-- Backfill best-effort das linhas históricas (só existe a config ATUAL
-- pra usar; se a conta_id da integração já mudou desde algum import
-- antigo, essas linhas ficam com o valor errado — limitação inerente,
-- documentada, mesmo padrão da C2-3).
UPDATE public.getnet_resumo r
   SET conta_id = public.getnet_safe_uuid(i.config -> 'sftp' ->> 'conta_id')
  FROM public.integracoes_financeiras i
 WHERE i.id = r.integracao_id
   AND r.conta_id IS NULL;

UPDATE public.getnet_financeiro_resumo f
   SET conta_id = public.getnet_safe_uuid(i.config -> 'sftp' ->> 'conta_id')
  FROM public.integracoes_financeiras i
 WHERE i.id = f.integracao_id
   AND f.conta_id IS NULL;

CREATE OR REPLACE VIEW public.getnet_credito_disponivel
WITH (security_invoker = true) AS
WITH via_tipo1 AS (
  SELECT
    r.integracao_id,
    r.igreja_id,
    i.filial_id,
    COALESCE(r.conta_id, public.getnet_safe_uuid(i.config -> 'sftp' ->> 'conta_id')) AS conta_id,
    r.arquivo_nome,
    COALESCE(r.data_pagamento_rv, r.data_rv) AS data_transacao,
    r.valor_liquido AS valor,
    CASE WHEN r.sinal = '-' THEN 'debito' ELSE 'credito' END AS tipo,
    'Getnet RV ' || r.rv AS descricao,
    NULLIF(r.rv, '') AS numero_documento,
    'getnet_sftp_txt'::text AS origem,
    'getnet_resumo'::text AS origem_tabela,
    r.id AS origem_id
  FROM public.getnet_resumo r
  JOIN public.integracoes_financeiras i ON i.id = r.integracao_id
  LEFT JOIN public.getnet_arquivos fa
    ON fa.integracao_id = r.integracao_id AND fa.arquivo_nome = r.arquivo_nome
  WHERE r.indicador_tipo_pagamento = 'LQ'
    AND (fa.espelho_origem IS NULL OR fa.espelho_origem = 'getnet_sftp_txt')
),
via_tipo5 AS (
  SELECT
    f.integracao_id,
    f.igreja_id,
    i.filial_id,
    COALESCE(f.conta_id, public.getnet_safe_uuid(i.config -> 'sftp' ->> 'conta_id')) AS conta_id,
    f.arquivo_nome,
    COALESCE(f.data_credito_operacao, f.data_operacao) AS data_transacao,
    f.valor_liquido_operacao AS valor,
    'credito'::text AS tipo,
    -- Bugbot: COALESCE do SQL só pula NULL, não ''; sem NULLIF aqui uma
    -- chave_ur vazia (não nula) nunca cairia pro fallback numero_operacao/
    -- 'sem-chave', diferente do `||` do JS original (que trata '' como
    -- falsy). NULLIF alinha os dois.
    'Getnet PG ' || COALESCE(NULLIF(f.chave_ur, ''), NULLIF(f.numero_operacao, ''), 'sem-chave') AS descricao,
    NULLIF(f.numero_operacao, '') AS numero_documento,
    'getnet_sftp_tipo5'::text AS origem,
    'getnet_financeiro_resumo'::text AS origem_tabela,
    f.id AS origem_id
  FROM public.getnet_financeiro_resumo f
  JOIN public.integracoes_financeiras i ON i.id = f.integracao_id
  JOIN public.getnet_arquivos fa
    ON fa.integracao_id = f.integracao_id AND fa.arquivo_nome = f.arquivo_nome
  WHERE f.tipo_operacao = 'PG'
    AND COALESCE(f.data_credito_operacao, f.data_operacao) IS NOT NULL
    AND fa.espelho_origem = 'getnet_sftp_tipo5'
)
SELECT * FROM via_tipo1
UNION ALL
SELECT * FROM via_tipo5;

COMMENT ON VIEW public.getnet_credito_disponivel IS
  'Ciclo 2 C2-6: crédito Getnet disponível, direto de getnet_resumo (LQ)/getnet_financeiro_resumo (PG) — equivalente aditivo ao espelho hoje escrito em extratos_bancarios (origem getnet_sftp_txt/getnet_sftp_tipo5). Fonte por arquivo travada em getnet_arquivos.espelho_origem (allow-list explícita, LEFT JOIN — arquivo sem linha em getnet_arquivos cai no fallback tipo1, mesma regra do NULL). conta_id vem congelado no momento do import (coluna própria, não relida da config atual) — editar a integração depois não reatribui histórico. Puramente leitura; nenhum consumidor migrado ainda. BLOQUEIOS antes da C2-7 (cutover): (1) aplicar has_filial_access — filial_id aqui NÃO é filtrado por RLS; (2) resolver ON DELETE CASCADE de integracao_id nas tabelas base — excluir uma integração hoje apaga todo o histórico desta view, sem equivalente no espelho legado. security_invoker=true — herda RLS (só igreja_id) das tabelas base.';

GRANT SELECT ON public.getnet_credito_disponivel TO authenticated, service_role;
REVOKE ALL ON public.getnet_credito_disponivel FROM anon;

-- Índice de suporte ao novo padrão de JOIN desta view (achado de
-- eficiência do /code-review): getnet_resumo/getnet_financeiro_resumo só
-- tinham índices por (integracao_id, data_rv|data_operacao) e
-- (integracao_id, rv|chave_ur) — nenhum por arquivo_nome, a chave real
-- usada aqui pra alcançar getnet_arquivos.espelho_origem.
CREATE INDEX IF NOT EXISTS idx_getnet_resumo_int_arquivo
  ON public.getnet_resumo(integracao_id, arquivo_nome);
CREATE INDEX IF NOT EXISTS idx_getnet_fin_resumo_int_arquivo
  ON public.getnet_financeiro_resumo(integracao_id, arquivo_nome);
