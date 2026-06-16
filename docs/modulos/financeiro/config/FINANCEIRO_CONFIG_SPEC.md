# Financeiro Config — Especificação

Este documento define os requisitos de configuração para o módulo Financeiro (Relatório de Ofertas) e Conferência Cega, e flags de formas de pagamento.

## Tabela `financeiro_config`
Configuração por igreja/filial, obtida no início da sessão do wizard.

- `igreja_id` / `filial_id`: escopo multi-tenant.
- `periodos`: array de strings com períodos válidos (ex.: ["manhã","tarde","noite"]).
- `tipos_permitidos_fisico`: array de `categoria_id`/`tipo_transacao_id` para lançamentos físicos (Oferta, Dízimo, Missões etc.).
- `tipos_permitidos_digital`: array de `categoria_id`/`tipo_transacao_id` para lançamentos digitais.
- `formas_fisicas_ids`: array de `forma_pagamento_id` válidas para físico (dinheiro, moedas, cheque).
- `formas_digitais_ids`: array de `forma_pagamento_id` válidas para digital (Pix, cartão, transferência, gateway).
- `valor_zero_policy`: enum —
  - `require_global_confirmation`: exige confirmação única quando `total_fisico=0`.
  - `require_per_line`: exige confirmação por linha com `valor=0`.
- `tolerancia_conferencia`: número (monetário) para divergência aceitável na conferência cega.
- `compare_level`: enum do nível de comparação (total, por tipo etc.).
- `mapeamentos_contas`: lista de objetos `{ forma_pagamento_id, conta_financeira_id_default }` (mapeamento padrão por canal).
- `providers_digitais`: config de integrações (PIX/gateway), chaves/segredos armazenados via mecanismo seguro.

## Tabela `formas_pagamento` (flags)
- `id`: identificador da forma.
- `nome`: rótulo exibido.
- `is_digital`: booleano — true para digitais (Pix, cartão); false para físicas (dinheiro, cheque).
- `default_conta_financeira_id`: conta padrão associada à forma; pode ser sobrescrita conforme permissão.

## Regras do Wizard
- **Step 1 (Abertura):** períodos carregados de `financeiro_config.periodos`; fallback se vazio; validação de pertencimento.
- **Step 2 (Cofre/Físico):**
  - Tipos carregados de `tipos_permitidos_fisico` (mapeados para categorias/centros de custo).
  - Formas filtradas por `formas_fisicas_ids` (ou `is_digital=false`).
  - Navegação: bloquear prosseguir se `total_fisico<=0` salvo quando `valor_zero_policy=require_global_confirmation` e usuário marcar confirmação global; ou `require_per_line` e cada linha com zero tiver confirmação individual.
- **Step 3 (Digital):**
  - Tipos de `tipos_permitidos_digital`.
  - Formas filtradas por `formas_digitais_ids` (ou `is_digital=true`).
  - Campo `conta_financeira_id` obrigatório, pré-preenchido por `mapeamentos_contas`.
  - Itens sincronizados são read-only; estados de reconciliação: `pendente`/`conciliado`.
- **Step 4 (Fechamento):** respeita tolerância e nível de comparação; link para visão de pendências da sessão.

## Estados de Reconciliação (Digital)
- `pendente`: lançado sem pareamento com item do provider.
- `conciliado`: pareado e validado; bloqueia edição de campos críticos.
- Ações: parear, aprovar, recontar (conferência cega), com trilha de auditoria.

## Observações
- Todas as validações respeitam escopo `igreja_id`/`filial_id` e RLS.
- Fallbacks devem alertar ausência de configuração e permitir operação mínima.
