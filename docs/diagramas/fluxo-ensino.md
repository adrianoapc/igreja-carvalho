# Fluxo do Módulo Jornadas e Ensino

```mermaid
flowchart TD
    subgraph Admin
        AJ[Abrir Jornadas]
        CJ[Criar/Editar Jornada]
        TJ{Tipo Jornada?}
        AE[Criar/Editar Etapas]
        CE{Tipo Etapa?}
        CQ[Configurar Quiz]
        MI[Matricular aluno]
        AA[Agendar Aula]
        RS[Registrar presença manual]
    end

    subgraph Aluno
        VA[Ver cursos disponíveis]
        IN[Inscrever-se]
        PL[Acessar Player]
        ET{Tipo Etapa?}
        VV[Assistir Vídeo]
        LT[Ler Texto]
        RQ[Responder Quiz]
        RT[Realizar Tarefa]
        PR[Participar Reunião]
        CA{Check Automático?}
        MA[Marcar etapa concluída]
        AV[Avança automaticamente]
    end

    AJ --> CJ --> TJ
    TJ -->|auto_instrucional| AE
    TJ -->|processo_acompanhado| MI
    TJ -->|hibrido| AE
    
    AE --> CE
    CE -->|quiz| CQ --> MI
    CE -->|texto/video/tarefa/reuniao| MI
    
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

    PL --> ET
    ET -->|video| VV --> CA
    ET -->|texto| LT --> CA
    ET -->|quiz| RQ --> NM{Nota >= mínima?}
    ET -->|tarefa| RT --> CA
    ET -->|reuniao| PR --> CA
    
    NM -->|Sim| CA
    NM -->|Não| RQ
    
    CA -->|Sim| AV --> PL
    CA -->|Não| MA --> PL

    %% Estilos
    classDef blocked fill:#ffebee,stroke:#c62828,stroke-width:2px;
    classDef quiz fill:#e3f2fd,stroke:#1565c0,stroke-width:2px;
    class BLK blocked;
    class RQ,CQ,NM quiz;
```

Notas:
- **Tipo de Jornada**: `auto_instrucional` exibe Player, `processo_acompanhado` exibe Kanban, `hibrido` combina ambos
- **Tipos de Etapa**: texto, video, quiz, tarefa, reuniao
- **Quiz**: Requer nota mínima para aprovação; múltiplas tentativas permitidas
- **Check Automático**: Se `true`, sistema avança sozinho; se `false`, aluno deve marcar como concluído (soft-lock)
- Criação de transação financeira ocorre apenas quando o curso é pago
- Player só libera acesso quando `status_pagamento` for `pago` ou `isento`
