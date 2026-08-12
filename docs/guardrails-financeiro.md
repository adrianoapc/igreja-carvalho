# Guardrails do módulo financeiro

> Checklist obrigatório extraído de ~40 rodadas de review (Codex) sobre a PR
> #67 (Recebível Getnet + FK de forma de pagamento), documentadas em detalhe
> em `docs/arquitetura-financeiro.md` §9.22–§9.60. Cada item aqui tem pelo
> menos um bug real correspondente que já aconteceu neste código — não é
> teórico. **Este documento é vivo**: toda vez que uma rodada de review
> encontrar um padrão novo (não coberto por um item já existente), adicione
> um item novo aqui, com o link pra seção correspondente em
> `arquitetura-financeiro.md`.
>
> Resumo curto (carregado automaticamente em toda sessão) está no
> `CLAUDE.md` da raiz do repo. Este arquivo é o detalhamento — consulte
> antes de escrever qualquer RPC `fin_*`, trigger, ou tela que liste
> contas/formas de pagamento/categorias.

---

## 0. Regra de ouro — nenhuma escrita direta nas 7 tabelas core

**A regra mais fundamental de todas, de onde todas as outras derivam:**
nenhum canal (frontend, bot, edge function) faz `INSERT`/`UPDATE`/`DELETE`
direto em `transacoes_financeiras`, `transferencias_contas`,
`extratos_bancarios` ou qualquer tabela de conciliação
(`conciliacoes_lote`, `conciliacoes_lote_extratos`,
`conciliacoes_divisao`, `conciliacoes_divisao_transacoes`). Escrita só via
RPC `fin_*` `SECURITY DEFINER`.

Isso não é só convenção — é **enforçado no banco**: os roles
`authenticated`/`anon` tiveram `REVOKE INSERT, UPDATE, DELETE` nas 7
tabelas (migrations `20260713141000`/`20260713160000`, arquitetura em
§7.1/§7.2 de `arquitetura-financeiro.md`). Confirmado ainda ativo hoje —
nenhuma migration posterior re-concede esses privilégios. Tentar um
`.insert()`/`.update()`/`.delete()` direto numa dessas tabelas a partir do
frontend (role `authenticated`) falha com `insufficient_privilege`,
mesmo que passe no RLS. `service_role` (edges) não é afetado pelo
`REVOKE` — mas violar a regra por esse caminho também é débito
arquitetural, não uma saída válida.

**Antes de escrever `supabase.from(<uma dessas 7 tabelas>).insert/update/
delete(...)` em qualquer lugar novo do código — pare.** Existe uma RPC
`fin_*` que já cobre essa operação (ver lista em §7.2) ou precisa de uma
nova, seguindo o mesmo contrato (`SECURITY DEFINER`, `fin_resolver_
contexto`, `p_contexto` pra service role, retorno `jsonb {ok, id(s),
warnings[]}`, auditoria).

Referências: §7.1, §7.2, §9.7.

---

## A. Filial compartilhada (`filial_id IS NULL`)

**Regra:** `filial_id IS NULL` numa tabela com esse padrão de multi-filial
significa **"visível/aceito em qualquer filial"**, nunca "sem filial
nenhuma". Confirmado pela função `has_filial_access(_igreja_id, _filial_id)`
(migration `20260105153404`): `... OR _filial_id IS NULL` — retorna `true`
pra qualquer usuário do tenant quando o registro é global.

**Obrigatório:**

1. **Nunca filtre por filial com `.eq("filial_id", filialId)` sozinho**
   quando a tabela pode ter registros globais. Use:
   ```ts
   query.or(`filial_id.eq.${filialId},filial_id.is.null`)
   ```
   Isso vale pra `contas`, `formas_pagamento`, `categorias_financeiras`,
   `getnet_antecipacao_lotes` — qualquer tabela com coluna `filial_id`
   nullable e RLS baseada em `has_filial_access`. **`extratos_bancarios`
   é EXCEÇÃO**: a policy de SELECT (`"Ver extratos bancarios"`,
   20260117145651) não usa `has_filial_access` — só `role`+`igreja_id`
   (tenant). Não assuma que uma tabela usa `has_filial_access` na RLS só
   porque tem coluna `filial_id`; **confira a `CREATE POLICY` real**
   (item 2 abaixo já cobre isso, mas o erro de assumir por analogia foi
   cometido de novo em §9.78 especificamente com esta tabela).

2. **Antes de reaproveitar um filtro de filial por analogia, verifique a
   RLS ou a RPC real** — não assuma. `fin_conferencia_totais_getnet`
   (§9.39), por exemplo, não valida filial NENHUMA (só `igreja_id`); um
   filtro de filial no frontend pra essa tela é mais restritivo que o
   próprio backend permite.

3. **Separe "seletor de item novo" de "detecção de item histórico".** Um
   filtro `.eq("ativo", true)` faz sentido pra popular um `<Select>` de
   opções pra uma transação NOVA, mas quebra a detecção de itens
   HISTÓRICOS que já referenciam algo desde-então desativado (achado
   `useFormaPagamentoDinheiroId`, §9.46 — desativar uma forma "Dinheiro"
   fazia transações antigas pararem de ser reconhecidas como dinheiro).

4. **Estado local (`contaId`, `integracaoId`, `categoriaSelecionada` etc.)
   escopado por filial/igreja precisa ser resetado quando o contexto
   muda.** Um componente que fica montado entre trocas de filial/igreja
   (dashboards, cards, abas) precisa de:
   ```ts
   useEffect(() => {
     setContaId("");
   }, [igrejaId, filialId, isAllFiliais]);
   ```
   e incluir esse contexto na `queryKey` da query que usa esse id.
   Achados: `ConferenciaTotaisGetnetCard.tsx` (§9.56),
   `ImportarRecebivelGetnetTab.tsx` (§9.59, `integracaoId`).

5. **Um registro GLOBAL (`filial_id IS NULL`) que pode ser VINCULADO depois
   a outro recurso filial-scoped** (ex.: `getnet_antecipacao_lotes` global
   vinculado a um `extratos_bancarios` de filial específica) tem uma
   "filial efetiva" que muda ao longo do tempo — `filial_id` própria
   continua NULL, mas o vínculo já não é mais "de qualquer filial". Todo
   filtro de LISTA (não só a RPC de escrita) precisa recalcular a filial
   efetiva a partir do recurso vinculado
   (`registro.filial_id ?? registro.vinculado?.filial_id ?? null`), não só
   olhar a própria `filial_id` — senão a lista mostra (e oferece ação
   sobre) um vínculo de outra filial pro usuário errado, e se a tabela
   vinculada for uma das exceções do item 1 (RLS sem `has_filial_access`),
   os DADOS do vínculo também vazam, não só a ação fica disponível.
   Achado: `useLotesAntecipacao.ts` (§9.78) — `LancarDesagioDialog.tsx`
   já usava a convenção certa (`filialEfetivaLote = lote.extratos_
   bancarios?.filial_id ?? null`) desde antes; a lista da tabela (que
   decide se as linhas de ação aparecem) não.

   **Correção importante em §9.79**: filtrar client-side (`.filter()` no
   React) NÃO fecha o vazamento de dado do item 1 — só evita que a UI
   RENDERIZE o que já chegou. Quando a tabela vinculada é uma exceção do
   item 1 (RLS sem `has_filial_access`), o embed do PostgREST já trouxe
   os campos reais no payload de rede ANTES do filtro rodar; abrir
   devtools/network tab mostra o dado de qualquer forma. Fix de verdade:
   parar de embutir a relação via PostgREST e resolver os campos
   sensíveis por uma RPC `SECURITY DEFINER` que filtra por
   `has_filial_access` ANTES de devolver qualquer linha (exemplo:
   `fin_listar_extratos_vinculados_lote`, §9.79) — o filtro client-side
   continua útil pra decidir se a LINHA aparece, mas nunca é, sozinho, a
   correção do vazamento.

6. **Um seletor/dropdown que alimenta um campo validado por `fin_validar_
   fk_filial` precisa saber a filial EFETIVA do registro sendo criado —
   inclusive quando essa filial efetiva é `null` (modo "Todas as
   filiais")**. `!isAllFiliais && filialId` como ÚNICA condição de filtro
   deixa `isAllFiliais` sem filtro NENHUM — mostra opções de qualquer
   filial, não só globais —, mas se o registro sendo criado nesse modo
   sempre grava `filial_id: null` (nenhum seletor de filial por-registro
   no formulário), só as opções GLOBAIS deveriam aparecer, senão
   `fin_validar_fk_filial` rejeita a escolha no submit. Três ramos, não
   dois: `isAllFiliais` → só globais (`.is("filial_id", null)`); filial
   específica → própria ou global (`.or(...)`); nenhum dos dois (contexto
   single-filial) → sem filtro. Achado: `useDadosApoio.ts` (§9.79) — os 6
   selects filial-scoped do formulário de lançamento (categoria/
   subcategoria/centro_custo/base_ministerial/fornecedor/forma_
   pagamento) tinham o mesmo bug de uma vez, por reusarem a MESMA
   condição errada copiada 6 vezes. Antes de dar como resolvido, confira
   se o registro sendo criado por esse formulário realmente força
   `filial_id: null` em "Todas as filiais" (grep o payload de criação,
   não assuma) — se houver um seletor de filial por-registro, o raciocínio
   não se aplica.

Referências: §9.35, §9.36, §9.38, §9.39, §9.46, §9.56, §9.59, §9.78, §9.79.

---

## B. RPC `SECURITY DEFINER` — checklist de tenant/filial

(Ver também memória de sessão `feedback-fin-rpc-security-checklist.md` —
mesma origem, consolidado aqui pro contexto ficar num lugar só.)

**Obrigatório ao escrever ou editar qualquer RPC `fin_*` `SECURITY
DEFINER`:**

1. Resolver `igreja_id` via `fin_resolver_contexto` — nunca aceitar cru do
   client.
2. **Checar `has_filial_access` explicitamente** contra a filial
   EFETIVA do recurso, não a filial "óbvia" de uma única entidade. Quando
   há mais de uma entidade envolvida (lote + extrato + conta, por
   exemplo), a filial efetiva é geralmente
   `COALESCE(entidade_mais_especifica.filial_id, entidade_fallback.filial_id)`.
   Achado real: `fin_lancar_desagio_antecipacao` checava
   `has_filial_access` contra `extrato.filial_id`, mas quando o extrato é
   global isso libera geral, pulando o check contra a CONTA escolhida —
   corrigido pra `COALESCE(v_extrato.filial_id, v_conta_filial)` (§9.37).
3. Validar toda FK recebida com `fin_validar_fk_tenant` antes de usar.
4. Ao passar `p_contexto` pra uma RPC aninhada, **repassar o `v_ctx` já
   resolvido**, nunca `NULL` — resolver de novo pode falhar pra
   service_role (§9.30).
5. `fin_validar_fk_tenant` só garante TENANT (`igreja_id`) — NUNCA filial,
   mesmo pra tabelas que têm `filial_id` (é um validador genérico,
   também usado em tabelas sem filial). Use `fin_validar_fk_filial(tabela,
   id, filial_efetiva)` (§9.64) — companion pronto, cobre os 6 campos
   filial-scoped de `transacoes_financeiras` (`categoria_id`,
   `subcategoria_id`, `centro_custo_id`, `base_ministerial_id`,
   `fornecedor_id`, `forma_pagamento_id`). Em RPC de PATCH parcial (como
   `fin_atualizar_lancamento`), valide o PAR EFETIVO campo/filial (valor
   do patch se presente, senão o já gravado) sempre que QUALQUER um dos
   dois estiver no patch — não só quando os dois mudam juntos (achado
   real: mudar só `filial_id` sem tocar no campo, que é exatamente o que
   `TransacaoDialog.tsx` faz quando o usuário não troca a forma de
   pagamento, §9.64).
   **Lição maior (por que isso levou 4 rodadas de review pra fechar,
   §9.61→§9.64): o padrão "campo filial-scoped sem check de filial" é uma
   CLASSE, não um bug pontual — generalize pros campos IRMÃOS na primeira
   vez que achar um, em vez de corrigir só o campo que o review citou.**
   Antes de declarar um fix desse tipo "completo", pergunte: essa mesma
   tabela/RPC tem outro campo com o mesmo formato (FK pra catálogo com
   `filial_id`)? Se sim, corrija todos juntos.
   **Generalizar por CAMPO não basta — generalize por PONTO DE ESCRITA
   também.** `fin_criar_transferencia` resolve `forma_pagamento_id`
   ("Transferência Bancária") por rótulo com um `INSERT` direto, sem
   passar pelo resolvedor de `fin_criar_lancamento` já corrigido — ficou
   de fora da varredura de §9.65 porque o grep focou no padrão de lock
   daquela rodada, não simultaneamente no padrão de resolução por rótulo
   de rodadas anteriores (§9.66). Ao fechar uma classe, `grep` por TODOS
   os `INSERT INTO transacoes_financeiras` e `SELECT ... FROM formas_
   pagamento`/`categorias_financeiras`/etc. no schema, não só pelas RPCs
   "oficiais" que já foram tocadas antes.
6. **Antes de QUALQUER `CREATE OR REPLACE FUNCTION public.fin_*`, ache a
   versão mais recente de verdade primeiro** —
   `grep -rl "CREATE OR REPLACE FUNCTION public.<nome>" supabase/
   migrations/*.sql | sort`, pegue o ÚLTIMO da lista, leia o arquivo
   INTEIRO, e edite a partir dele. Nunca reaproveite uma cópia mental de
   uma leitura anterior na mesma sessão (mesmo que pareça recente) — uma
   migration intermediária pode ter corrigido algo que sua cópia mental
   não tem, e seu `CREATE OR REPLACE` apaga a correção sem ninguém notar
   até a próxima rodada de review. Achado real (2 vezes nesta mesma PR,
   a segunda sou eu mesmo cometendo o erro que a primeira documentava):
   `20260730100000` corrige exatamente esse padrão em
   `fin_atualizar_lancamento` (um `CREATE OR REPLACE` baseado numa cópia
   antiga tinha apagado `forma_pagamento_id` e o sinal de taxa); na
   rodada seguinte de fixes desta mesma sessão (§9.62→§9.63), o mesmo
   erro se repetiu — um `CREATE OR REPLACE` na MESMA função, baseado
   numa cópia anterior na conversa, apagou o guard D10
   (`FIN_COMPETENCIA_GRUPO`) que uma migration intermediária já tinha
   adicionado.
6b. **Hotfix de corpo de RPC já deployada: NÃO edite a migration
   histórica no git — escreva `CREATE OR REPLACE` numa migration NOVA
   (forward).** `supabase db push` só aplica arquivos que ainda não
   estão em `supabase_migrations.schema_migrations`. Alterar
   `20260805110000_...sql` depois que produção já rodou esse timestamp
   deixa o git "certo" e o banco com o corpo velho. Achado real: hotfix
   do drift `getnet_recebivel_lancamentos.parcelas` (§9.95) — a 1ª
   versão corrigia `fin_vincular_venda_getnet_oferta` /
   `fin_listar_ledger_conciliacao_cartao` nos arquivos já aplicados e
   só mandava `ALTER COLUMN` na migration nova; o deploy de produção
   teria formalizado o tipo e **mantido as RPCs quebradas** (`22P02`).
7. **RPC que materializa VÁRIAS linhas relacionadas num `FOR ... LOOP`
   (parcelas, ocorrências): todo campo que devia ser IGUAL entre elas
   precisa ser calculado UMA VEZ, fora do loop** — nunca dentro, mesmo
   que o fallback pareça inofensivo. Achado real: `fin_criar_lancamento`
   calculava `data_competencia` como `COALESCE(explícito, v_venc)`
   DENTRO do loop de parcelas — `v_venc` avança por iteração, então cada
   parcela nascia com uma competência própria, violando o invariante "1
   competência por grupo" que o guard D10 (`fin_atualizar_lancamento`)
   só protege depois de criado, não no nascimento (§9.67).
8. **`SECURITY DEFINER` + filial-scoped SEM `has_filial_access` não tem
   exceção pra "é só leitura"/"é só diagnóstico"/"ninguém vai chamar
   isso do app normal".** Uma RPC read-only ainda bypassa RLS — se ela
   lista linhas de uma tabela com `filial_id` (contas, transações,
   catálogos), ainda vaza dado de outra filial pra quem chamar
   diretamente (devtools, script, integração futura). Achado real,
   MESMA SESSÃO que escreveu a regra 5 acima: `fin_diagnosticar_drift_
   saldo`, função NOVA (não `CREATE OR REPLACE` de algo pré-existente,
   escrita do zero DEPOIS de já ter documentado a classe inteira em
   §9.68) filtrava só por `igreja_id`, sem `has_filial_access` nenhum —
   um tesoureiro restrito a uma filial via essa RPC "só de diagnóstico"
   enxergava nome/saldo/diferença de TODAS as contas do tenant (§9.73).
   Toda RPC nova que consulta uma tabela filial-scoped, sem exceção,
   passa pelo checklist desta seção ANTES de ser considerada pronta —
   não só as que gravam.
9. **Se esta rodada já está reescrevendo uma RPC `fin_*` por QUALQUER
   motivo (lock, campo, bug), feche o `has_filial_access` dela agora,
   não depois** — mesmo que o achado do review não tenha pedido
   explicitamente. Deixar uma RPC "pra fechar depois" quando ela já
   está sendo tocada na MESMA sessão, pelo MESMO assunto (filial), foi
   exatamente o que gerou 2 rodadas seguidas de achado sobre `fin_
   atualizar_lancamento`/`fin_criar_transferencia`/`fin_alterar_
   competencia_grupo` (§9.74) depois de já saber, desde §9.68, que a
   classe inteira precisava do check — e ainda `fin_excluir_lancamento`,
   reescrita 6× com comentário explícito "fora de escopo" na própria
   migration (§9.82). A lista de RPCs pendentes (memória de sessão) só
   deve conter funções que esta PR NUNCA tocou — qualquer função que
   apareça num `CREATE OR REPLACE` desta sessão e ainda esteja na lista
   é uma bandeira vermelha.

10. **`conta_id`/`p_conta_id` (a conta bancária/caixa que o dinheiro
    entra ou sai) segue uma regra DIFERENTE das 6 FKs de catálogo do
    item 5 — não é `fin_validar_fk_filial` (que checa "recurso é global
    ou bate com a filial EFETIVA da transação"), é `has_filial_access`
    direto na filial da conta.** `contas` não está na lista de tabelas
    de `fin_validar_fk_filial` (de propósito — nada no sistema exige que
    `conta.filial_id` bata com `transacao.filial_id`, só que o CHAMADOR
    tenha acesso a ela). `fin_criar_lancamento`/`fin_atualizar_lancamento`
    validavam `conta_id`/`p_conta_id` só com `fin_validar_fk_tenant`
    (tenant) — nunca `has_filial_access` — até um tesoureiro restrito a
    uma filial conseguir criar/mover uma transação pra uma conta de
    OUTRA filial, movendo saldo alheio sem nunca ter acesso checado
    (§9.80). Mesmo padrão já usado em `fin_criar_transferencia`
    (conta_origem/conta_destino, §9.74) e `fin_lancar_desagio_
    antecipacao` (§9.65) — replique sempre que uma RPC nova/editada
    grava `conta_id`: `SELECT filial_id INTO v_conta_filial FROM contas
    WHERE id = ...; IF NOT has_filial_access(v_igreja, v_conta_filial)
    THEN RAISE...`. Em RPC de PATCH parcial, só dispara quando `conta_id`
    está de fato no patch (editar outro campo com a conta antiga não
    precisa re-checar uma conta que não mudou).

11. **Payload JSON com arrays "irmãos" (ex.: `transacao_ids` +
    `divisoes[].transacao_id`): o array que passa por lock/tenant/
    `has_filial_access` NÃO é automaticamente o único que a função
    escreve.** Qualquer campo paralelo que alimente um `INSERT` precisa
    ser validado contra o conjunto já checado (igualdade de conjuntos,
    ou ⊆ estrito + lock dos extras). Achado real: `fin_confirmar_
    conciliacao` travava/checava `transacao_ids`, mas o ramo 1:N
    inseria `conciliacoes_divisao_transacoes` a partir de `p_vinculo->
    'divisoes'` — um VICTIM só em `divisoes` entrava no vínculo sem
    nunca ser travado nem checado (§9.86). Grep por todo
    `jsonb_array_elements(p_*)` / `p_vinculo ->` na função antes de
    declarar "qualquer item do array" coberto.

12. **`filial_id` em tabelas de AUDITORIA/RELATÓRIO ≠ `filial_id` em
    tabelas de CONTROLE DE ACESSO.** Junções (`conciliacoes_lote`,
    `conciliacoes_divisao`) devem gravar a filial EFETIVA do recurso
    (`v_filial_efetiva`). Audit/ML (`reconciliacao_audit_logs`,
    `conciliacao_ml_feedback`) devem gravar a filial do CONTEXTO do
    ator (`v_ctx`) — é o que o relatório filtra ("o que eu fiz nesta
    filial"). Generalizar `v_filial_efetiva` pra audit fazia sumir do
    Relatório de Cobertura (filtro Filial X) um evento de conciliação
    de recurso compartilhado feito DENTRO de X (§9.86).

13. **Filial mista em conciliação multi-item**: rejeitar ≥2 filiais
    concretas distintas SÓ quando NÃO há âncora compartilhada
    (`filial_id IS NULL` em pelo menos um item). O motor F4 já propõe
    splits de extrato compartilhado entre transações de filiais
    diferentes (`e.filial_id = t.filial_id OR e.filial_id IS NULL OR
    t.filial_id IS NULL`) — rejeitar esse caso quebra sugestão +
    lote/divisão legítimos. Mix de filiais concretas SEM recurso
    compartilhado continua `FIN_VALIDACAO` (§9.86).

14. **Toda RPC que lista/filtra `transacoes_financeiras` por
    `conciliacao_status` precisa de um allow-list explícito do que É
    aceito, nunca um deny-list de um valor específico** — o enum tem 4
    valores reais (`nao_conciliado` | `conciliado_manual` |
    `conciliado_extrato` | `conciliado_bot`, confirmado no schema real via
    `\d+ transacoes_financeiras`, não só por leitura de migration
    histórica), e ~15 RPCs `fin_*` já tratam `conciliado_bot` como
    sinônimo de `conciliado_extrato` ("fechado por outro canal, não pode
    reeditar"). Um filtro `<> 'conciliado_extrato'` deixa `conciliado_bot`
    vazar pelo mesmo buraco que motivou o fix. Achado real:
    `fin_listar_ledger_conciliacao_cartao` não filtrava
    `conciliacao_status` na CTE `raizes` — lançamento fechado via extrato
    bancário (canal fora da cadeia Getnet Hop1/Hop2, nunca ganha
    `getnet_recebivel_lancamentos`) aparecia como `sem_hop2` com botões
    "Buscar manualmente"/"Confirmar sugestão" que SEMPRE rejeitam com
    `FIN_JA_LANCADO` — fix é `IN ('nao_conciliado', 'conciliado_manual')`
    (§9.96).

15. **`has_filial_access`/qualquer helper booleano usado em `IF NOT
    fn(...) THEN RAISE EXCEPTION` precisa NUNCA retornar SQL `NULL`,
    só `true`/`false`.** Em PL/pgSQL, `IF <condição NULL> THEN` é tratado
    como `false` (mesma regra do `WHERE`) — então `NOT NULL` também é
    `NULL`, o `IF NOT fn(...) THEN` nunca entra, e o `RAISE EXCEPTION`
    de bloqueio simplesmente não dispara: um `NULL` inesperado libera
    acesso, não nega. Qualquer `OR` dentro da função que combine uma
    comparação `x = y` (retorna `NULL`, não `false`, quando um lado é
    `NULL`) com outros termos precisa terminar em `COALESCE(<expressão
    toda>, false)`. Achado real: reescrever o shortcut de "sem filial
    primária no JWT = acesso total" de `has_filial_access` (removendo o
    `OR get_jwt_filial_id() IS NULL` incondicional que mascarava o
    problema) expôs que `_filial_id = get_jwt_filial_id()` sozinho no
    `OR` faz a função retornar `NULL` (não `false`) exatamente no caso
    que o fix deveria bloquear — um bypass NOVO, pior que o original,
    só pego porque o harness comparava o VALOR (`t`/`f`/vazio), não só
    "não deu erro" (regra F.1) (§9.109).
16. **Lookups irmãos na mesma tabela de autorização precisam do mesmo
    predicado de tenant.** Se um `EXISTS` (allow) e um `NOT EXISTS`
    (atalho legado / "sem restrição configurada") leem
    `user_filial_access` (ou equivalente), os dois filtram por
    `igreja_id` — não só por `user_id`/`filial_id`. `UNIQUE(user_id,
    filial_id)` não substitui: impede duplicata do par, mas a coluna
    `igreja_id` é denormalizada e pode divergir da filial (não há CHECK
    cruzando as duas FKs; o upsert da UI grava o tenant do admin).
    Achado real: o `NOT EXISTS` do shortcut legado de `has_filial_access`
    ganhou `igreja_id = _igreja_id`, mas o `EXISTS` que autoriza
    (`can_view=true`) ficou só com `filial_id` — um grant de outro
    tenant autorizava a filial pedida. Codex apontou na 1ª review desta
    PR; o follow-up anunciado nunca chegou na branch (§9.109, achado 3).

Referências: §9.30, §9.37, §9.61, §9.62, §9.63, §9.64, §9.65, §9.67,
§9.73, §9.74, §9.80, §9.81, §9.82, §9.86, §9.96, §9.109, checklist completo na memória de sessão.

---

## C. Trigger de saldo — nunca incremental, sempre column-list completo

### C.1 — Recalcule do zero, nunca some/subtraia incrementalmente

Depois de **3 bugs seguidos da mesma causa raiz** (DELETE via RPC, DELETE
via edge function, UPDATE de status — §9.47/§9.48/§9.49), a lição virou
regra: **qualquer trigger que mantém um saldo/agregado derivado de outra
tabela deve recalcular do zero (`SUM` sobre a fonte de verdade) em vez de
somar/subtrair incrementalmente.**

Motivo: matemática incremental assume que o movimento anterior foi
aplicado corretamente quando a linha mudou de estado a última vez — essa
suposição quebra silenciosamente sempre que:
- o trigger mudou de comportamento depois que a linha foi criada
  ("linha legada"),
- existe mais de um caminho de escrita pra mesma tabela (RPC + edge
  function direto na tabela),
- alguém corrige o dado manualmente.

Recalcular do zero elimina a classe inteira, permanentemente, custando
uma `SUM` a mais por evento — aceitável na escala de uma igreja.

### C.2 — Todo trigger `UPDATE OF <colunas>` precisa listar TODAS as
colunas que a função realmente usa, não só as do achado original

Aconteceu **3 vezes na mesma PR**: um guard checava um subconjunto de
colunas (ex.: `status`) e um caminho de escrita que muda OUTRO campo sem
tocar `status` no mesmo `UPDATE` (reclassificação em massa, principalmente)
bypassava o guard inteiro.

- `atualizar_saldo_conta`: só `UPDATE OF status` — reclass mudando só
  `conta_id` nunca recalculava nenhuma das duas contas (§9.53/§9.54).
- `proteger_desagio_vinculado`: listava valor/conta/tipo/datas mas
  esqueceu `filial_id` — editar filial numa transação de deságio
  vinculada convertia a despesa em global em silêncio (§9.60).

**Antes de declarar `BEFORE/AFTER UPDATE OF a, b, c`, liste TODO campo que
o corpo da função compara `OLD` vs `NEW`** — não só os campos do bug que
motivou o trigger. Pra tabelas financeiras (`transacoes_financeiras`), a
lista mínima de campos sensíveis é: `status`, `valor`, `valor_liquido`,
`conta_id`, `tipo`, `filial_id`, `data_vencimento`, `data_competencia`,
`data_pagamento`.

**Exceção/armadilha:** transition tables (`REFERENCING OLD TABLE/NEW
TABLE`, usadas pra bater trigger `FOR EACH ROW`→`FOR EACH STATEMENT` em
lote) **não podem ser combinadas com `UPDATE OF <coluna>`** — Postgres
rejeita com "transition tables cannot be specified for triggers with
column lists". Nesse caso, dispare em `UPDATE` sem lista de colunas e
filtre dentro do corpo da função (§9.54).

### C.3 — Toda ação que insere/atualiza/deleta uma linha paga em
`transacoes_financeiras` precisa passar pelo trigger de saldo

Ao adicionar um NOVO caminho de escrita nessa tabela (edge function, bulk
job, migration de reconciliação), confirme que ele dispara o trigger
normalmente — **não adicione uma chamada explícita de recálculo
"pra garantir"** a menos que o caminho literalmente não passe por um
`INSERT`/`UPDATE`/`DELETE` normal na tabela (ex.: uma migration de dados
que roda antes do trigger final existir — aí sim, recalcule inline dentro
da própria migration, sem depender de qual versão do trigger está ativa
naquele ponto da sequência, §9.54).

Referências: §9.47, §9.48, §9.49, §9.50, §9.53, §9.54, §9.60.

---

## D. Concorrência e locks

### D.1 — Ordem determinística sempre que travar mais de uma linha

Qualquer código que trava (`FOR UPDATE`/`FOR NO KEY UPDATE`) mais de uma
linha da mesma tabela dentro de uma transação — direta ou indiretamente
via um loop que chama uma função que trava — **precisa travar numa ordem
determinística e idêntica em toda chamada** (`ORDER BY id`, tipicamente).
Sem isso, duas transações concorrentes que precisam das MESMAS duas linhas
em ordem invertida se travam uma na outra — deadlock genuíno, não
teórico.

Aconteceu 2 vezes: `fin_criar_transferencia` (duas contas, direções
opostas, §9.53) e `atualizar_saldo_conta_lote` (`SELECT DISTINCT` sem
`ORDER BY`, §9.56).

### D.2 — Use o lock mais fraco que resolve o problema

`FOR UPDATE` conflita com QUALQUER outro lock, inclusive `KEY SHARE` —
que é exatamente o lock que Postgres adquire automaticamente em toda
linha referenciada por uma FK, durante o `INSERT` da linha filha, até
commitar. Travar uma conta com `FOR UPDATE` enquanto outra transação
insere um filho referenciando essa mesma conta (`KEY SHARE`) cria deadlock
que não existiria com um lock mais fraco.

**Use `FOR NO KEY UPDATE`** quando o UPDATE não mexe na chave/coluna
única da linha (caso comum: atualizar `saldo_atual`) — é compatível com
`KEY SHARE` de outra sessão, then não briga com o `INSERT` filho (§9.55).

### D.3 — Trave primeiro, leia depois — nunca combine as duas na mesma
statement

`UPDATE tabela SET col = (SELECT SUM(...) FROM outra_tabela) WHERE
id = X` — a subquery do `SET` usa o snapshot de QUANDO O UPDATE COMEÇOU,
mesmo que o `UPDATE` espere (lock wait) outra transação concorrente
terminar primeiro. Esperar a trava não dá um snapshot novo pra subquery.

**Padrão correto:** `SELECT ... FOR UPDATE/NO KEY UPDATE` numa statement
separada primeiro (bloqueia e espera aqui), DEPOIS um `SELECT` novo (pega
snapshot fresco, já vendo o que a outra transação commitou), DEPOIS o
`UPDATE` com o valor já calculado (§9.51).

### D.4 — Testar concorrência exige concorrência de verdade

Um teste sequencial (`BEGIN; ...; COMMIT;` numa sessão, depois na outra)
NÃO reproduz corrida — precisa de 2 sessões `psql` rodando
simultaneamente, uma delas segurando o lock com `pg_sleep()` proposital
pra garantir a janela de interleaving. Ver seção F (testing) pro padrão
completo.

Referências: §9.51, §9.53, §9.54, §9.55, §9.56.

### D.5 — Nunca trave uma linha individual isolada antes de travar o grupo inteiro

Quando uma operação vai travar um GRUPO de linhas relacionadas (`id = raiz
OR pai_id = raiz`), **não trave nenhuma linha individual antes** — nem
"só pra ler", numa statement separada. Duas sessões editando membros
DIFERENTES do mesmo grupo concorrentemente: cada uma trava sua própria
linha primeiro (statements separadas), depois tenta travar o grupo
inteiro (que inclui a linha que a OUTRA já travou) — espera circular,
deadlock certo. Resolva qual é o grupo com um `SELECT` SEM lock, trave o
grupo inteiro numa ÚNICA statement (ordem determinística, D.1), releia os
dados depois do lock. Achado real: `fin_alterar_competencia_grupo`
travava `p_lancamento_id` sozinho, depois o grupo — corrigido, deadlock
reproduzido com 2 sessões reais antes e depois do fix (§9.72).

Referências: §9.72.

### D.6 — "Resolve sem lock, trave depois" (D.5) precisa RE-CONFIRMAR o que foi resolvido, depois do lock

D.5 resolve a corrida de "quem trava o quê primeiro" — mas abre uma
JANELA nova: entre o `SELECT` sem lock que resolve o identificador do
grupo (`v_pai`) e o momento em que o lock é efetivamente adquirido,
OUTRA transação concorrente pode ter mudado a estrutura do grupo (ex.:
excluído a raiz e reparenteado as irmãs). O `v_pai` resolvido fica
apontando pra algo que não existe mais — o lock adquirido com esse valor
trava 0 linhas (o predicado não bate com nada), e toda query seguinte
que usa esse `v_pai` (inclusive o `UPDATE` final) também não bate com
nada. A RPC retorna sucesso sem ter feito nada — falha SILENCIOSA, sem
erro nenhum. **Depois de adquirir o lock, re-resolva o identificador da
MESMA forma; se mudou, refaça o ciclo (resolve → trava → confere) até
estabilizar** — só nesse ponto está garantido que ninguém mais está
alterando a estrutura. Achado real: `fin_alterar_competencia_grupo` E
`fin_excluir_lancamento`, as duas com o mesmo padrão (§9.75) — reproduzido
de verdade com 2 sessões `psql` (uma instrumentada com `pg_sleep` pra
segurar a transação já mutada, mas não commitada, forçando a janela).

Referências: §9.75.

---

## E. Migrations — defesas precisam vir ANTES do que protegem

Uma limpeza/reconciliação "rede de segurança" só protege alguma coisa se
rodar **antes**, na ordem de execução das migrations, do que ela protege.

- Limpeza de `filial_id` órfão ficou numa migration DEPOIS do
  `ADD CONSTRAINT` que ela deveria proteger — se a constraint falhasse, a
  sequência pararia ali, e a limpeza nunca seria alcançada. Movida pra
  antes, na mesma migration da constraint (§9.51).
- `CREATE UNIQUE INDEX` sem reconciliar duplicatas existentes primeiro
  abortaria a migration exatamente nas instalações que mais precisam do
  fix (§9.53).

**Não avalie "risco hoje" como justificativa pra pular a reconciliação.**
Esse raciocínio ("a tabela nasce nesta mesma sequência de migrations, sem
janela de risco") foi usado e re-contestado repetidas vezes nesta PR —
às vezes a premissa realmente não vale mais (deploy incremental, dado que
já existia). **Escreva a migration robusta independente da suposição.**

**Corrigir um backfill/UPDATE de dado com uma migration NOVA e POSTERIOR
só funciona se a informação que ela precisa ainda existir quando ela
rodar.** Migrations rodam em ordem de timestamp — se a migration ORIGINAL
(mais antiga) sobrescreve/apaga um dado, uma migration "corretiva"
POSTERIOR não tem como recuperar o valor original: ele já foi perdido
antes dela sequer começar a rodar. Se a migration original ainda não foi
deployada em NENHUM ambiente real, **corrija na migration original
diretamente** — não empilhe uma correção que roda tarde demais pra
funcionar. Achado real: o backfill de `forma_pagamento_id` (§9.61)
sobrescrevia id válido; a primeira tentativa de correção saiu como
migration separada e posterior (§9.71) — só que como a original roda
PRIMEIRO, a correção operava sobre dado que ela mesma já tinha destruído,
e não conseguia recuperar nada (achado do /code-review, §9.73). Fix
definitivo: editar a migration original, remover a "correção" inútil.

**Uma ferramenta de diagnóstico "rode antes do deploy" que é CRIADA
dentro da mesma leva de migrations que ela deveria auditar não funciona
como gate — o Supabase CLI aplica todas as migrations pendentes numa
tacada só, sem pausa pra decisão humana entre elas.** Se a migration que
poderia apagar um dado importante roda ANTES da migration que cria a
RPC de diagnóstico desse mesmo dado, "rode a RPC antes do deploy" é
logicamente impossível — ela não existe até o próprio deploy já ter
rodado a parte destrutiva. Não dá pra corrigir isso com mais uma
migration (mover a criação da RPC pra mais cedo na sequência resolve a
ORDEM, mas nada impede o `db push` de continuar direto sem esperar
revisão humana). **O diagnóstico de pré-deploy precisa ser uma query
STANDALONE, fora de `supabase/migrations/`, documentada no runbook pra
rodar manualmente antes de sequer iniciar `db push`** — nunca uma RPC
que a própria leva de migrations cria. Achado real: `fin_diagnosticar_
drift_saldo` (§9.72) só é criada na migration `330000`, mas o trigger
que ela deveria proteger contra já está ativo desde `210000`, e o
backfill de `220000` (11 migrations antes) já dispara o recálculo que
apaga o drift (§9.77).

Referências: §9.35, §9.39, §9.51, §9.53, §9.73, §9.77.

---

## F. Testing — regras já em vigor, reforçadas

1. **Todo fix de SQL/trigger/RPC precisa de harness Docker antes de
   commitar.** Nunca só `deno check`/sintaxe. Reproduza o bug primeiro
   (aplique a versão COM o bug, confirme que reproduz), depois aplique o
   fix e confirme a correção — não só "não dá erro", confirme o VALOR
   final esperado.
2. **Concorrência exige 2 sessões `psql` reais**, uma em background
   (`&`) segurando lock com `pg_sleep`, outra em foreground iniciada
   ~1s depois. Meça o resultado final, não só "não deu erro" (deadlock
   às vezes aborta silenciosamente o lado errado).
3. Se não for possível forçar deterministicamente um cenário de corrida
   (ex.: ordem de `SELECT DISTINCT` que o Postgres decide sozinho), seja
   honesto sobre isso e valide o que É possível confirmar com certeza
   (a propriedade determinística do fix, testada isoladamente) em vez de
   fingir uma reprodução que não aconteceu (§9.56).
4. Regressões de harnesses anteriores (schema faltando coluna, trigger
   irmão não aplicado) não são o achado — mas TAMBÉM não devem ser
   descartadas sem investigar; confirme que é mesmo gap do harness antes
   de seguir.

---

## G. Frontend — React Query e estado derivado

1. **`useEffect` que reconcilia estado local contra dados de uma query**
   (remove seleções que não são mais opção válida, por exemplo) reage a
   QUALQUER mudança do array/objeto de dados — inclusive a transição
   vazia/`undefined` que aparece quando a `queryKey` muda e não há cache
   pra ela ainda. Use `placeholderData: keepPreviousData` na query de
   origem pra evitar reagir a esse estado transitório (§9.59 — regressão
   do próprio fix de §9.58).
2. **Botão que dispara uma ação dependente de múltiplas queries** precisa
   checar `isLoading` E `isError` de TODAS elas no `disabled` — um
   `totalRegistros`/contagem derivada dos dados fica "positivo" mesmo com
   uma query ainda carregando (usa o valor da OUTRA, já carregada) ou com
   erro (substituída por `[]`) (§9.57, §9.58).
3. **Patch "só campos que mudaram" precisa distinguir "nunca tocado" de
   "valor explícito"** — comparação por truthiness trata `""` (nunca
   tocado) e um valor sentinela de "limpar" (ex.: opção "Não
   especificado") como iguais quando os dois colapsam pro mesmo valor
   derivado (`null`). Rastreie o estado BRUTO do campo (o que o usuário
   realmente selecionou), não só o valor normalizado (§9.40).
4. **Compensação/revert de uma ação em duas RPCs não-atômicas precisa
   tratar `null` como valor válido conhecido**, não como "desconhecido" —
   `if (valorAnterior)` trata `null` igual a "nunca capturei esse dado";
   use `=== null` explicitamente quando `null` é um estado legítimo que
   você TEM mas não consegue restaurar por outra razão (RPC exige
   não-nulo, por exemplo) — dê uma mensagem honesta sobre ESSE motivo
   específico, não a mensagem genérica de "desconhecido" (§9.57).
5. **Totais/Confirmar que só somam linhas filtradas NÃO podem confiar
   só no array de IDs selecionados.** Trocar período/filtro (ou um
   period-picker compartilhado entre painéis) esconde linhas sem limpar
   a seleção — o balanço vira 0×0, `hasSelecao` fica true e Confirmar
   habilita sobre IDs ocultos. Em 1:1 `fin_confirmar_conciliacao` só
   linka (não valida valor): o gate da UI é o único freio. Ao mudar o
   filtro que redefine o universo visível, zere a seleção; exija
   seleção visível nos dois lados pra habilitar Confirmar; e no
   `mutate`/toast use só os IDs (e a contagem) efetivamente enviados
   (§9.98 — Modo Inteligente C2-0).

6. **Toda listagem/stats client-side de `extratos_bancarios` precisa
   excluir o espelho sintético Getnet** (`origem IN ('getnet_sftp',
   'getnet_sftp_txt', 'getnet_sftp_tipo5')`) — use
   `FILTRO_EXCLUI_ESPELHO_GETNET`/`ORIGENS_ESPELHO_GETNET`
   (`src/features/financeiro/core/api/extratos.api.ts`), nunca reescreva
   a lista de origens à mão. Padrão achado e corrigido em 2 rodadas
   diferentes, 5 call sites no total (§9.106 e §9.108 —
   `HistoricoExtratos.tsx`/`useConciliacaoInteligente.ts`/
   `useConciliacaoLote.ts` na 1ª rodada; `useDashboardConciliacaoData.ts`/
   `useConciliacaoManualData.ts` na 2ª) porque cada query nova de
   `extratos_bancarios` precisa lembrar
   de aplicar o filtro por conta própria — não existe checagem de tipo
   nem lint que force isso. Ao escrever QUALQUER query nova (client-side
   ou RPC) que leia `extratos_bancarios` sem passar por uma RPC que já
   filtre (`fin_listar_extratos_sem_candidato`, `fin_gerar_candidatos_
   conciliacao`), aplicar o filtro é obrigatório, não opcional.

Referências: §9.40, §9.41, §9.56, §9.57, §9.58, §9.59, §9.98, §9.106, §9.108.

---

## H. Import de arquivo externo (CSV/planilha)

1. Valide a CONTAGEM de colunas de cada linha de dados contra o cabeçalho
   esperado ANTES de fazer parse célula-a-célula — uma linha
   truncada/deslocada não deve virar campos `null` silenciosos (§9.49).
2. Para CADA campo tipado (numérico, data), valide o CONTEÚDO da célula
   quando não-vazia — `parseFloat`/regex de data que aceitam sufixo lixo
   ou formato errado e caem pra `null` tornam uma célula malformada
   indistinguível de uma célula legitimamente vazia. Valide o resultado
   já normalizado contra um padrão estrito (`/^-?\d+(\.\d+)?$/` pra
   número já sem separador de milhar, por exemplo) em vez de tentar casar
   o formato bruto (mais robusto a variação de formatação) (§9.57, §9.58).
3. Linha rejeitada por conteúdo inválido é uma categoria DIFERENTE de
   "subtotal ignorado" (que é esperado/normal) — conte e sinalize
   separado, com alerta visível, não só um toast que passa despercebido.
4. **Limpar o estado React de um `<input type="file">` não limpa o
   `value` do DOM node** — navegadores só disparam `change` quando o
   `value` do input MUDA; reselecionar o MESMO arquivo depois de "Limpar
   prévia" (ou depois de um import bem-sucedido que reseta o formulário)
   não dispara `change` nenhum, deixando o usuário travado (sem preview,
   sem erro, só o botão de importar desabilitado) a não ser que escolha
   um arquivo DIFERENTE ou recarregue a página. Sempre que a função de
   "limpar preview" zera estado de arquivo, também zera o input via
   `ref`: `if (fileInputRef.current) fileInputRef.current.value = "";`.
   Não precisa disso se o `<input>` está dentro de um ramo condicional
   que DESMONTA (condicional de render, ou dialog que desmonta ao
   fechar) — nesse caso o DOM node é recriado do zero e `value` já nasce
   vazio; só é necessário quando o MESMO `<input>` persiste montado e só
   o estado React ao redor muda. Achado real: 3 abas de import de
   extrato/recebível (`ImportarRecebivelGetnetTab.tsx`,
   `ImportarTab.tsx`, `ImportarExtratosTab.tsx`) tinham o mesmo bug — a
   1ª foi o achado direto do review, as outras 2 vieram da varredura por
   padrão irmão (§9.80).

Referências: §9.49, §9.57, §9.58, §9.80.

---

## I. Processo de execução — fases, PR e CI

Reconciliado a partir de um plano anterior ("Ação imediata — destravar PR #67
(docs_guard)") escrito no meio do ciclo de review desta mesma PR. Um dos itens
originais (nº 2 abaixo) ficou desatualizado pelo próprio trabalho desta PR —
mantido aqui já corrigido, com a explicação do porquê, em vez de silenciosamente
apagado.

1. **Checklist de filial em toda RPC nova.** Todo harness de RPC `fin_*` nova
   precisa cobrir o cenário "todas as filiais" (`filial_id IS NULL`, não só
   cross-tenant) — ver seção B e `[[feedback-fin-rpc-security-checklist]]`.
2. **(CORRIGIDO — a versão original deste item está desatualizada)** O plano
   original dizia: *"RPC que grava `status='pago'` direto precisa tratar saldo
   explicitamente — o trigger `atualizar_saldo_conta` só dispara em `AFTER
   UPDATE OF status`."* Isso descrevia a arquitetura ANTES desta PR. Depois de
   §9.29/§9.50/§9.54 (ver seção C), o trigger de saldo:
   - dispara em INSERT, UPDATE (sem `OF status` — qualquer coluna relevante) e
     DELETE, a nível de statement, com transition tables;
   - sempre recalcula do zero (`_fin_recalcular_saldo_conta_raw`), nunca soma
     incrementalmente.
   Ou seja: **nenhuma RPC precisa mais "tratar saldo explicitamente"** — gravar
   `status='pago'` por INSERT direto (como o Getnet Fase A faz) já é coberto
   pelo trigger atual. Se uma RPC nova sentir necessidade de mexer em
   `saldo_atual` manualmente, isso é sinal de bug (duplicação), não de
   requisito — ver C.1/C.3.
3. **Grep de call-sites antes de tocar campo compartilhado.** Antes de mudar o
   comportamento de um campo que outra RPC/tela já escreve, grep todos os
   call-sites e testar o formato legado no harness (exemplo real: `reclass-
   transacoes/index.ts` montava UPDATE parcial sem `status` no SET e bypassava
   um guard que só disparava em `UPDATE OF status` — ver
   `20260731200000_fin_saldo_lock_e_impede_desagio_orfao.sql`).
4. **1 fase = 1 PR, harness completo antes de abrir.** Esta própria PR #67
   (Fase A+B do Getnet) é o contra-exemplo do que acontece quando isso não é
   seguido — cresceu para ~60 rodadas de review por acumular fixes de review
   em vez de nascer com o harness completo. Não crescer a PR com trabalho não
   relacionado no meio do review.
5. Rodar `/code-review` local antes do primeiro `@codex review`.
6. **Batelar fixes antes de re-disparar `@codex review`** — cada disparo
   rescaneia a PR inteira; disparar a cada fix isolado multiplica o custo de
   review sem necessidade (ver `[[feedback-batch-prs-review-cost]]`).
7. **CI `docs_guard` reconhece `docs/arquitetura-financeiro.md` e
   `docs/guardrails-financeiro.md`.** O regex da Regra 3 (documentação
   textual) em `.github/workflows/docs-guard.yml` não incluía essas duas docs
   originalmente — qualquer PR que tocasse `src/.../financas/` ou
   `supabase/migrations/` e só atualizasse essas docs (sem também tocar
   `manual-usuario.md`/`funcionalidades.md`/`produto/`/`01-Arquitetura/`/
   `adr/`) falhava o check por um motivo puramente mecânico, não de conteúdo.
   Corrigido nesta mesma leva de commits — futuras fases não devem cair na
   mesma armadilha, mas se o nome de algum desses arquivos mudar, o regex
   precisa ser atualizado junto.

---

## J. `ON DELETE SET NULL` — cuidado ao adicionar numa FK existente

Adicionar `ON DELETE SET NULL` a uma FK que já era usada em JOINs ou como
elo de agrupamento tem efeitos colaterais fáceis de não perceber — os dois
achados abaixo apareceram na MESMA rodada de review, ambos efeito colateral
de um `ON DELETE SET NULL` legítimo adicionado na rodada anterior (§9.62).

1. **FK usada num INNER JOIN pra classificar/agregar linhas**: quando o FK
   vira `NULL` (registro referenciado excluído), o INNER JOIN descarta a
   linha inteira da agregação — silenciosamente, sem erro. Se existe um
   campo texto legado paralelo (nome/rótulo gravado no momento da
   transação), troque pra `LEFT JOIN` e classifique por
   `COALESCE(fk.campo, tabela.campo_legado)` (§9.62,
   `fin_conferencia_totais_getnet`).
2. **FK usada como elo de agrupamento** (ex.: `lancamento_pai_id`
   apontando pro id da própria primeira parcela, sem uma coluna de grupo
   estável e separada): excluir a linha-raiz orfaneia TODAS as linhas do
   grupo de uma vez. Antes de excluir uma raiz, reparenteie as
   sobreviventes pra uma nova raiz explicitamente — nunca deixe o `SET
   NULL` "resolver sozinho" (§9.62, `fin_excluir_lancamento`).
3. **Armadilha de `NOT IN`/`<>` com coluna nullable num `WHERE` de
   exclusão/inclusão**: `coluna NOT IN (...)` é `NULL` — não `TRUE` — pra
   qualquer linha com `coluna IS NULL`, e `WHERE` descarta linhas cujo
   predicado é `NULL`. Um bug assim pode ficar invisível por MESES (era o
   caso de `conciliacao_status NOT IN (...)` em `fin_excluir_lancamento`,
   presente desde a criação da função) porque o caminho "tudo NULL" é o
   comum, não o raro. Ao escrever ou revisar `NOT IN`/`<>` sobre coluna
   nullable, teste explicitamente o cenário `NULL` no harness — não só o
   cenário com valor preenchido. Prefira `col IS NULL OR col NOT IN
   (...)` quando `NULL` deve contar como "não está na lista" (§9.62).

Referências: §9.62.

---

## Como usar este documento

- **Antes de escrever uma query nova que filtra por `filial_id`**: seção A.
- **Antes de escrever/editar uma RPC `fin_*` `SECURITY DEFINER`**: seção B.
- **Antes de criar ou editar QUALQUER trigger em `transacoes_financeiras`
  ou tabela relacionada**: seção C, inteira.
- **Antes de adicionar um `SELECT ... FOR UPDATE` (ou qualquer lock
  explícito) num fluxo que pode rodar concorrente com outro**: seção D.
- **Antes de escrever uma migration com `ADD CONSTRAINT`/`CREATE UNIQUE
  INDEX`**: seção E.
- **Antes de commitar qualquer fix de SQL**: seção F (harness).
- **Antes de escrever um `useEffect` que reage a dado de query, ou um
  botão que depende de múltiplas queries**: seção G.
- **Antes de mexer no parser de importação Getnet (ou escrever um parser
  de CSV novo)**: seção H.
- **Antes de planejar uma fase nova (o que vira uma PR, quando abrir,
  quando rodar `@codex review`)**: seção I.
- **Antes de adicionar `ON DELETE SET NULL` numa FK existente (ou revisar
  uma migration que faz isso)**: seção J.

Encontrou um padrão novo numa rodada de review que não está aqui? Adicione
uma seção (ou um item numa seção existente) citando o `§9.NN`
correspondente em `arquitetura-financeiro.md`, e atualize o resumo no
`CLAUDE.md` se o padrão for grande o suficiente pra merecer uma linha lá.
