
```md
# Sequência — <MODULO>

Breve descrição do que esta sequência representa.

```mermaid
sequenceDiagram
  participant U as Usuário
  participant FE as Frontend
  participant SB as Supabase
  participant DB as Postgres

  U->>FE: Ação
  FE->>SB: Requisição
  SB->>DB: Query/Mutation
  DB-->>SB: Resultado
  SB-->>FE: Resposta
  FE-->>U: Atualiza UI
