# Fluxo Getnet SFTP — Importação de Extrato Eletrônico V10.1

## Objetivo

Documentar o ciclo completo de importação dos arquivos de extrato eletrônico Getnet via SFTP, desde a listagem dos arquivos disponíveis até a persistência dos registros no banco de dados, cobrindo os 7 tipos de registro do layout V10.1.

## Contexto

A Getnet disponibiliza extratos eletrônicos posicionais (400 bytes por linha) via SFTP no padrão `getnetextr_YYYYMMDD_*`. O sistema conecta ao servidor SFTP da Getnet, lista os arquivos disponíveis, faz o download e processa cada linha com o parser V10.1, distribuindo os registros pelas tabelas correspondentes.

## Fluxo de Importação

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
        ActionImport["action: import\nBaixa e parseia arquivo(s)"]
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
        TbArquivos[(getnet_arquivos\ncontrole por arquivo)]
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
    ImportDialog -->|"action: import + data"| ActionImport
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

## Ciclo de Vida PF → LQ

O mesmo RV pode aparecer duas vezes no tipo 1, diferenciado pelo campo `indicador_tipo_pagamento`:

- **PF** (Previsto de Pagamento): agendamento do crédito
- **LQ** (Liquidação): confirmação do pagamento efetivo

O constraint `UNIQUE(integracao_id, rv, data_rv, indicador_tipo_pagamento)` garante que cada linha seja única e permite reimportações idempotentes.

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
