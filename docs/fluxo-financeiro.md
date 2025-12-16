# Fluxo Financeiro - Reembolso -> Caixa -> DRE

```mermaid
graph TD
    Lider[Lider / Membro]
    Tesoureiro[Tesoureiro]
    Banco[Banco / Extrato]

    subgraph S1["1 Solicitacao (Fato Gerador)"]
        NF1["Nota Fiscal A 200 - Manutencao"]
        NF2["Nota Fiscal B 300 - Eventos"]
        ItensDB[(itens_reembolso)]

        Lider -->|"Upload IA"| NF1
        Lider -->|"Upload IA"| NF2
        NF1 --> ItensDB
        NF2 --> ItensDB
        ItensDB -->|"Soma itens"| Solic["Solicitacao 123 Total 500"]
    end

    subgraph S2["2 Aprovacao e Pagamento (Fluxo de Caixa)"]
        Solic --> Tesoureiro
        Tesoureiro -->|"Aprova"| Decisao{Forma pagamento}

        Decisao -->|"A vista"| T1["Saida unica 500 para Joao"]
        Decisao -->|"Parcelado 2x"| T2["Parcela 1 250 para Joao"]
        T2 --> T3["Parcela 2 250 para Joao"]

        T1 -.->|"Grava"| FinDB[(transacoes_financeiras)]
        T3 -.->|"Grava"| FinDB
    end

    subgraph S3["3 Conciliacao Bancaria"]
        Banco -->|"Extrato PIX 250"| Conc{Bate}
        FinDB -->|"Previsto 250"| Conc
        Conc -->|"Sim"| Pago["Status Pago"]
    end

    subgraph S4["4 Inteligencia (DRE / Relatorios)"]
        View[(view_contabil_unificada)]
        FinDB -->|"Valor pago"| View
        ItensDB -->|"Categoria real"| View
        View --> DRE["DRE Manutencao e Eventos"]
    end
