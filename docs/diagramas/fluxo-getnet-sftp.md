# Fluxo Getnet SFTP — Importação de Extrato Eletrônico V10.1

> **Atualizado em 2026-06-19**: adicionado fluxo de `sync` automático (action: sync) disparado por cron e pelo botão "Sincronizar" na UI.
> **Atualizado em 2026-07 (F6/D5)**: o espelho em `extratos_bancarios` agora pode nascer do tipo 5 (`PG`, dinheiro real) em vez do tipo 1 (`LQ`), por integração, via `config.espelho_tipo5_desde` — ver seção "Espelho: tipo 1 (LQ) vs tipo 5 (PG)" abaixo.

## Objetivo

Documentar o ciclo completo de importação dos arquivos de extrato eletrônico Getnet via SFTP, desde a listagem dos arquivos disponíveis até a persistência dos registros no banco de dados, cobrindo os 7 tipos de registro do layout V10.1. Inclui sincronização automática via cron que detecta e importa arquivos pendentes.

## Contexto

A Getnet disponibiliza extratos eletrônicos posicionais (400 bytes por linha) via SFTP no padrão `getnetextr_YYYYMMDD_*`. O sistema conecta ao servidor SFTP da Getnet, lista os arquivos disponíveis, faz o download e processa cada linha com o parser V10.1, distribuindo os registros pelas tabelas correspondentes.

A action `sync` automatiza o processo: lista todos os arquivos do SFTP, compara com `getnet_arquivos` (que só recebe registros após importação bem-sucedida), e importa os arquivos pendentes em lotes de até 7 por execução.

## Fluxo de Importação Manual

```mermaid
graph TD
    Usuario[Tesoureiro / Admin]
    SFTP[Servidor SFTP Getnet]

    subgraph UI["Interface (src/pages/financas/Integracoes.tsx)"]
        ListBtn["Botão: Listar Arquivos SFTP"]
        ListDialog["GetnetListFilesDialog\nLista arquivos getnetextr_YYYYMMDD_*"]
        ImportDialog["GetnetImportDialog\nSeleciona data de referência"]
    end

    subgraph EdgeFn["Edge Function: getnet-sftp"]
        ActionList["action: list_files\nConecta SFTP e retorna lista"]
        ActionImport["action: import_extrato\nBaixa e parseia arquivo(s)"]
        Parser["getnetExtratoParser.ts\nLayout V10.1 — 400 bytes/linha"]
    end

    subgraph Tipos["Tipos de Registro"]
        T0["Tipo 0 — Header\n(metadados do arquivo)"]
        T1["Tipo 1 — Resumo Transacional\n(RV, valores bruto/líquido)"]
        T2["Tipo 2 — Analítico/CV\n(transações individuais)"]
        T3["Tipo 3 — Ajustes\n(chargebacks, contestações)"]
        T5["Tipo 5 — Resumo Financeiro\n(UR/chave_ur)"]
        T6["Tipo 6 — Detalhe Financeiro\n(composição do pagamento)"]
        T9["Tipo 9 — Trailer\n(validação de contagem)"]
    end

    subgraph DB["Banco de Dados (Supabase Postgres)"]
        TbArquivos[(getnet_arquivos\ncontrole por arquivo\n— gravado só após sucesso)]
        TbResumo[(getnet_resumo\nciclo PF→LQ por RV)]
        TbAnalitico[(getnet_analitico\ntransações/CVs)]
        TbAjustes[(getnet_ajustes\najustes e chargebacks)]
        TbFinResumo[(getnet_financeiro_resumo\nresumo financeiro tipo 5)]
        TbFinDetalhe[(getnet_financeiro_detalhe\ndetalhe financeiro tipo 6)]
    end

    Usuario -->|"Abre diálogo"| ListBtn
    ListBtn --> ListDialog
    ListDialog -->|"action: list_files"| ActionList
    ActionList -->|"SFTP ls"| SFTP
    SFTP -->|"Lista de arquivos"| ActionList
    ActionList --> ListDialog

    ListDialog -->|"Clica Importar"| ImportDialog
    ImportDialog -->|"action: import_extrato + data"| ActionImport
    ActionImport -->|"SFTP get"| SFTP
    SFTP -->|"Conteúdo do arquivo"| ActionImport
    ActionImport --> Parser

    Parser --> T0 & T1 & T2 & T3 & T5 & T6 & T9

    T0 --> TbArquivos
    T1 --> TbResumo
    T2 --> TbAnalitico
    T3 --> TbAjustes
    T5 --> TbFinResumo
    T6 --> TbFinDetalhe
    T9 -->|"Valida contagem\n(trailer check)"| TbArquivos
```

## Fluxo de Sincronização Automática (action: sync)

O sync detecta e importa arquivos pendentes com segurança de reprocessamento: `getnet_arquivos` só é gravado **após** todas as tabelas de dados serem inseridas com sucesso. Se a importação falhar no meio, o arquivo não constará em `getnet_arquivos` e será retentado na próxima execução do cron.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Cron / Botão "Sincronizar"
    participant Fn as getnet-sftp (action=sync)
    participant SFTP as SFTP Getnet
    participant DB as Supabase DB

    Cron->>Fn: action=sync, integracao_id
    Fn->>SFTP: Conecta e lista diretório (regex getnetextr_YYYYMMDD_*)
    SFTP-->>Fn: Lista de arquivos correspondentes
    Fn->>DB: SELECT arquivo_nome FROM getnet_arquivos WHERE integracao_id=?
    DB-->>Fn: Conjunto de arquivos já importados com sucesso
    Fn->>Fn: Diff: SFTP − DB = arquivos pendentes (sorted oldest-first)
    Fn->>Fn: Seleciona até batch_size=7 arquivos

    loop Para cada arquivo pendente
        Fn->>Fn: Chama runExtratoEletronicoV10(arquivo_nome)
        Note over Fn: Upserta getnet_resumo, getnet_analitico,<br/>getnet_ajustes, getnet_fin_resumo,<br/>getnet_fin_detalhe, extratos_bancarios<br/>(espelho: tipo 1/LQ ou tipo 5/PG, conforme corte)
        alt Todos os upserts OK
            Fn->>DB: Upsert getnet_arquivos (marca como importado)
        else Qualquer upsert falhou
            Note over DB: getnet_arquivos NÃO é gravado → arquivo será retentado
        end
    end

    Fn-->>Cron: { total_sftp, already_imported, new_found, processed, errors }
```

## Ciclo de Vida PF → LQ

O mesmo RV pode aparecer duas vezes no tipo 1, diferenciado pelo campo `indicador_tipo_pagamento`:

- **PF** (Previsto de Pagamento): agendamento do crédito
- **LQ** (Liquidação): confirmação do pagamento efetivo

O constraint `UNIQUE(integracao_id, rv, data_rv, indicador_tipo_pagamento)` garante que cada linha seja única e permite reimportações idempotentes.

## Espelho: tipo 1 (LQ) vs tipo 5 (PG) — F6/D5

O espelho em `extratos_bancarios` (usado pela conciliação) pode nascer de
duas fontes distintas, escolhida por integração:

```mermaid
flowchart LR
    Config{"config.espelho_tipo5_desde\nsetado E data_referencia\n>= corte?"}
    T1[Tipo 1: RV com\nindicador_tipo_pagamento='LQ']
    T5[Tipo 5: PG\ntipo_operacao='PG']
    Extrato[(extratos_bancarios\norigem='getnet_sftp_txt'\nou 'getnet_sftp_tipo5')]

    Config -->|não| T1
    Config -->|sim| T5
    T1 --> Extrato
    T5 --> Extrato
```

Regra geral #10 do manual técnico da Getnet (V10.1/V6.2024): só
`tipo_operacao='PG'` no registro tipo 5 é dinheiro NOVO creditado na conta —
os demais tipos (CS/CF/AC/CL/GL/GF/AL) são liquidação contábil de valores já
adiantados em contrato numa data anterior. Por isso o tipo 5/PG é a fonte
mais precisa: o tipo 1/LQ mistura esse dinheiro real com os ajustes
contratuais (`AJUSTE 18`, `AJUSTE 20` etc. nos registros 1/3).

Sem `config.espelho_tipo5_desde` setado na integração, o comportamento é o
legado (tipo 1). Função pura `selecionarEspelhoTipo5` em
`getnetExtratoParser.ts` filtra as linhas PG e constrói o `external_id` de
dedupe a partir de `linhaNum` (não de `numero_operacao`, que o manual
confirma vir vazio para PG, nem de `chave_ur`, que pode não ser 1:1 por
linha).

## Diagrama de Sequência — Importação de Arquivo

```mermaid
sequenceDiagram
    autonumber
    participant Tesoureiro
    participant UI as Integracoes.tsx
    participant Fn as getnet-sftp (Edge Fn)
    participant SFTP as SFTP Getnet
    participant DB as Supabase DB

    Tesoureiro->>UI: Clica em "Listar Arquivos SFTP"
    UI->>Fn: action=list_files, integracao_id
    Fn->>SFTP: Conecta e lista diretório
    SFTP-->>Fn: Lista de arquivos getnetextr_*
    Fn-->>UI: [{ name, size, modified }]
    UI->>Tesoureiro: Exibe GetnetListFilesDialog

    Tesoureiro->>UI: Seleciona arquivo e clica Importar
    UI->>Tesoureiro: Abre GetnetImportDialog (confirma data)
    Tesoureiro->>UI: Confirma data de referência
    UI->>Fn: action=import, data_referencia, arquivo_nome
    Fn->>SFTP: Download do arquivo
    SFTP-->>Fn: Conteúdo posicional (400 bytes/linha)
    Fn->>Fn: Parser V10.1 processa cada linha
    Fn->>DB: Upsert em getnet_arquivos (header/trailer)
    Fn->>DB: Upsert em getnet_resumo (tipo 1)
    Fn->>DB: Upsert em getnet_analitico (tipo 2)
    Fn->>DB: Upsert em getnet_ajustes (tipo 3)
    Fn->>DB: Upsert em getnet_financeiro_resumo (tipo 5)
    Fn->>DB: Upsert em getnet_financeiro_detalhe (tipo 6)
    Fn-->>UI: { success, total_recebido, total_inserido, total_ignorado }
    UI->>Tesoureiro: Exibe resultado da importação
```

## Tabelas Envolvidas

| Tabela | Tipo de Registro | Descrição |
|---|---|---|
| `getnet_arquivos` | 0 e 9 | Controle por arquivo (header + validação de trailer) |
| `getnet_resumo` | 1 | Resumo transacional por RV; ciclo PF→LQ como linhas distintas |
| `getnet_analitico` | 2 | Transações individuais (CVs) vinculadas ao RV |
| `getnet_ajustes` | 3 | Ajustes, chargebacks e contestações |
| `getnet_financeiro_resumo` | 5 | Resumo financeiro com chave UR para junção 1↔5↔6 |
| `getnet_financeiro_detalhe` | 6 | Detalhe financeiro da composição de cada pagamento |

## Referências

- **Funcionalidades detalhadas**: [funcionalidades.md — Seção Getnet SFTP](../funcionalidades.md#getnet-sftp)
- **Migration**: `supabase/migrations/20260617000001_getnet_schema_expand.sql`
- **Edge Function**: `supabase/functions/getnet-sftp/`
- **Parser**: `supabase/functions/getnet-sftp/getnetExtratoParser.ts`
- **UI**: `src/components/financas/GetnetListFilesDialog.tsx`, `src/components/financas/GetnetImportDialog.tsx`
- **Fluxo Financeiro**: [fluxo-financeiro.md](fluxo-financeiro.md)
