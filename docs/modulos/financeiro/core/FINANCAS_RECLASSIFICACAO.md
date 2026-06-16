# Reclassificacao Financeira em Lote

## Objetivo
Criar tela/fluxo para reclassificar lancamentos financeiros em massa (entradas/saidas) alterando chaves de classificacao sem modificar valores/datas de vencimento/pagamento.

## Escopo e Campos Alteraveis
- Categoria
- Subcategoria
- Centro de custo
- Fornecedor
- Conta (troca permitida)
- Status
- Data de competencia
- Nao alterar valor nem datas de vencimento/pagamento.

## Permissoes e Regras
- Apenas perfil financeiro admin/gestor; respeitar RLS por `igreja_id/filial_id`.
- Conta deve estar ativa e pertencer ao contexto (igreja/filial conforme RLS).
- Bloquear itens conciliados; permitir pagos nao conciliados; pendentes sempre.
- Validar compatibilidade de categoria/subcategoria com tipo (entrada/saida).
- Logar usuario executor e timestamp em job.

## Limites e Performance
- Limite duro: 5k registros por job.
- Updates em lote no backend (RPC ou update com filtro) em chunks; evitar loop no front.
- Paginar/virtualizar lista no front; selecao "todos do filtro" ou linhas marcadas.

## Logs e Undo
- Tabelas:
  - `reclass_jobs`: id, igreja_id, filial_id, user_id, filtros_aplicados (json), campos_alterados (json), total_linhas, status (processing/completed/failed), created_at, completed_at.
  - `reclass_job_items`: id, job_id, transacao_id, antes (json), depois (json), status (updated/skipped/error), error_reason, created_at.
- Edge function `undo-reclass`: reverte campos alterados usando `antes` quando o job estiver dentro do prazo (sugestao: 24h). Se `updated_at` da transacao mudou apos o job, pular e registrar em `error_reason`.

## UX/Fluxo Front
1) Filtros: data venc/pag/competencia, conta, categoria/subcat, centro, fornecedor, status, texto na descricao.
2) Lista: paginada/virtualizada com contagem total; opcao "selecionar todos do filtro" ou checkboxes.
3) Painel "Novo destino": selecionar novos valores para categoria, subcategoria, centro de custo, fornecedor, conta, status, data de competencia. Campos vazios nao alteram.
4) Resumo de impacto: contagem por categoria/conta antes/depois (preview) com estimativa de itens afetados.
5) Confirmacao: modal com numero de itens e campos que serao alterados; botao executar.
6) Resultado: mostra job_id, contagens aplicadas, itens pulados/erros (download CSV opcional) e botao "Desfazer" se job concluido.

## Fluxo Backend
- Endpoint/RPC recebe: filtros, lista opcional de ids selecionados, novos valores, contexto (igreja/filial/user), limite de 5k.
- Resolve ids pelo filtro (respeitando RLS), aplica validacoes (categoria tipo, conta ativa, nao conciliado, etc.).
- Atualiza em lote, grava `reclass_jobs` e `reclass_job_items` com antes/depois.
- Retorna resumo e `job_id`.
- Undo chama edge `undo-reclass` para reverter.

## Observacoes
- Mensagens claras quando itens forem ignorados (conciliados, sem permissao, categoria tipo incorreta).
- Caso filtro retorne mais de 5k, exigir refinamento antes de habilitar a execucao.
- Se quiser deixar conta opcional por perfil, parametrizar permissao de troca de conta.
