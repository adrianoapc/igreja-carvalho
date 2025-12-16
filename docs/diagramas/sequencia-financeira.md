# Diagrama de Sequencia - Processo Financeiro

```mermaid
sequenceDiagram
    autonumber

    participant Lider as Lider
    participant Sistema as Sistema
    participant Tesoureiro as Tesoureiro
    participant Banco as Banco

    Lider->>Sistema: Envia notas fiscais (upload)
    Sistema->>Sistema: Classifica e agrupa itens
    Sistema->>Tesoureiro: Solicita aprovacao
    Tesoureiro->>Sistema: Aprova pagamento
    Sistema->>Banco: Executa pagamento (PIX ou transferencia)
    Banco-->>Sistema: Retorna extrato
    Sistema->>Sistema: Concilia pagamento
    Sistema-->>Lider: Atualiza status pago
