# Fluxo de Cursos Pagos (Ensino)

```mermaid
flowchart TD
    A[Aluno visualiza jornada] --> B{Jornada requer pagamento?}
    B -- Não --> C[Inserir inscrição<br/>status_pagamento: isento]
    C --> D[Acesso liberado ao CursoPlayer]

    B -- Sim --> E[Resolver configuração financeira<br/>(categoria/base/conta)]
    E --> F{Conta encontrada?}
    F -- Não --> G[Exibir aviso e manter pendente<br/>(transação não criada)]
    G --> H[Inserir inscrição<br/>status_pagamento: pendente]
    H --> I[Acesso bloqueado no CursoPlayer]

    F -- Sim --> J[Criar transação financeira de entrada<br/>status: pendente, valor: jornada.valor]
    J --> K[Inserir inscrição<br/>status_pagamento: pendente<br/>transacao_id: vinculado]
    K --> I

    I --> L{Transação marcada como paga?}
    L -- Sim --> M[Atualizar inscrição<br/>status_pagamento: pago]
    M --> D
    L -- Não --> I

    style D fill:#b7e1cd,stroke:#2e7d32,stroke-width:2px
    style I fill:#ffebee,stroke:#c62828,stroke-width:2px
```

Notas:
- Criação de transação: tipo `entrada`, `status: pendente`, `valor` da jornada, datas conforme competência (detalhes podem variar — a confirmar).
- Baixa de pagamento ocorre no módulo financeiro; ao mudar para `pago`, o aluno ganha acesso.
- Integração de meios de pagamento (PIX/cartão) não está evidenciada no código atual (a confirmar).
