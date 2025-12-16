# DRE - Inteligencia Contabil

```mermaid
graph TD
    Itens[(itens_reembolso categoria fornecedor)]
    Transacoes[(transacoes_financeiras valor_pago)]
    View[(view_contabil_unificada)]
    DRE[DRE por categoria]

    Itens -->|"Competencia natureza"| View
    Transacoes -->|"Caixa valor"| View
    View --> DRE
