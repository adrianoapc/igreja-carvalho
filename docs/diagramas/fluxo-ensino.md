# Fluxo do Módulo Jornadas e Ensino

```mermaid
flowchart TD
    subgraph Admin
        AJ[Abrir Jornadas]
        CJ[Criar/Editar Jornada]
        AE[Criar/Editar Etapas]
        MI[Matricular aluno]
        AA[Agendar Aula]
        RS[Registrar presença (manual)]
    end

    subgraph Aluno
        VA[Ver cursos disponíveis]
        IN[Inscrever-se]
        PL[Acessar Player]
        MA[Marcar etapa concluída]
    end

    AJ --> CJ --> AE
    CJ --> MI
    AE --> MI
    MI --> VA
    VA --> IN

    IN -->|Curso pago| TF[Cria transação financeira pendente]
    IN -->|Curso grátis| INS[Inscrição ativa]

    TF --> INS

    AA --> RS
    RS --> PL

    INS -->|status_pagamento = pago ou isento| PL
    INS -->|status_pagamento = pendente| BLK[Player bloqueado]
    BLK -->|pagamento confirmado| PL

    PL --> MA --> PL

    %% Notas
    classDef blocked fill:#ffebee,stroke:#c62828,stroke-width:2px;
    class BLK blocked;
```

Notas:
- Criação de transação financeira ocorre apenas quando o curso é pago; status permanece pendente até baixa no módulo financeiro.
- Player só libera acesso quando `status_pagamento` for `pago` ou `isento`.
- Impressão de etiquetas aplica-se ao check-in de crianças (Kids) dentro do fluxo de presença.
