# Fluxo do Módulo Jornadas e Ensino

```mermaid
flowchart TD
    subgraph Admin
        AJ[Abrir Jornadas]
        CJ[Criar/Editar Jornada]
        TJ{Tipo Jornada?}
        AE[Criar/Editar Etapas]
        CE{Tipo Etapa?}
        EC[Editor de Conteúdo]
        CQ[Configurar Quiz]
        CV[Adicionar Vídeo/URL]
        CT[Adicionar Texto]
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
    CE -->|quiz| EC --> CQ --> MI
    CE -->|video| EC --> CV --> MI
    CE -->|texto| EC --> CT --> MI
    CE -->|tarefa/reuniao| EC --> MI
    
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
    
    CA -->|Sim| AV --> FC{100% das etapas?}
    FC -->|Sim| BC[Baixar certificado PDF]
    FC -->|Não| PL
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
- **Editor de Conteúdo** (EtapaContentDialog):
  - **Texto**: Conteúdo armazenado em `conteudo_texto`; suporta formatação simples
  - **Vídeo**: URL em `conteudo_url` com preview YouTube/Vimeo; checkbox `check_automatico` bloqueia avanço até conclusão
  - **Quiz**: Interface para N perguntas com 4 alternativas; marca resposta correta; configura nota mínima (0-100); salvo em `quiz_config` (JSON)
  - **Tarefa/Reunião**: Tipos informativos para presencial ou tarefas; requer confirmação manual do líder
- **Quiz**: Requer nota mínima para aprovação; múltiplas tentativas permitidas
- **Check Automático**: Se `true`, sistema avança sozinho após conclusão; se `false`, aluno deve marcar como concluído (soft-lock)
- Criação de transação financeira ocorre apenas quando o curso é pago
- Player só libera acesso quando `status_pagamento` for `pago` ou `isento`

---

## Detalhe: Cursos Pagos — Fluxo de Pagamento (fundido de fluxo-cursos-pagos.md)

> Complementa o nó `TF [Cria transação financeira pendente]` do diagrama principal.
> Original em `docs/_archive/_fundidos/fluxo-cursos-pagos.md`.

```mermaid
flowchart TD
    A[Aluno visualiza jornada] --> B{Jornada requer pagamento?}
    B -- Não --> C[Inscrição com status_pagamento: isento]
    C --> D[Acesso liberado ao CursoPlayer]

    B -- Sim --> E[Resolver configuração financeira<br/>categoria/base/conta]
    E --> F{Conta encontrada?}
    F -- Não --> G[Aviso ao aluno — manter pendente<br/>transação NÃO criada]
    G --> H[Inscrição com status_pagamento: pendente]
    H --> I[Acesso bloqueado no CursoPlayer]

    F -- Sim --> J[Criar transação financeira<br/>tipo: entrada, status: pendente]
    J --> K[Inscrição com transacao_id vinculado]
    K --> I

    I --> L{Transação marcada como paga?}
    L -- Sim --> M[status_pagamento → pago]
    M --> D
    L -- Não --> I

    style D fill:#b7e1cd,stroke:#2e7d32,stroke-width:2px
    style I fill:#ffebee,stroke:#c62828,stroke-width:2px
```

**Notas de drift:**
- Integração PIX/cartão direta **não evidenciada** no código (a confirmar)
- Baixa manual ocorre no módulo Financeiro; status `pago` no módulo Ensino liberará acesso automaticamente
