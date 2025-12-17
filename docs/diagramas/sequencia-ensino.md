# Sequência — Jornadas e Ensino

```mermaid
sequenceDiagram
    participant Admin
    participant Aluno
    participant Supabase
    participant Financeiro

    Admin->>Supabase: Criar/editar jornada
    Admin->>Supabase: Criar etapas (video/texto/presencial)
    Admin->>Supabase: Matricular aluno (manual)
    Admin->>Supabase: Agendar aula (sala, professor, modalidade)

    Aluno->>Supabase: Listar cursos disponíveis
    Aluno->>Supabase: Inscrever-se em jornada
    alt Curso pago
        Supabase-->>Financeiro: Criar transação entrada (pendente)
        Supabase-->>Aluno: Inscrição com status_pagamento=pendente
    else Curso gratuito
        Supabase-->>Aluno: Inscrição com status_pagamento=isento
    end

    Aluno->>Supabase: Abrir player do curso
    Supabase-->>Aluno: Bloqueia se status_pagamento=pendente
    Supabase-->>Aluno: Libera etapas se pago/isento

    Admin->>Supabase: Registrar presença (check-in manual)
    note over Admin,Supabase: Kids: pode imprimir etiqueta de segurança

    Financeiro->>Supabase: Baixar transação (status=pago)
    Supabase-->>Aluno: Atualiza status_pagamento=pago (libera player) (a confirmar automação)

    Aluno->>Supabase: Marcar etapa concluída
    Supabase-->>Aluno: Atualiza progresso
```

Notas:
- A liberação automática do player após a baixa financeira depende da atualização do `status_pagamento` na inscrição (automação a confirmar).
- O fluxo não inclui integrações de pagamento no app do aluno; a baixa ocorre no módulo financeiro.
