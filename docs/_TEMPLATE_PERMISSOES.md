
```md
# Permissões — <MODULO>

Breve descrição das permissões e filtros aplicados.

```mermaid
flowchart TD
  R[Request autenticada] --> J[JWT / Sessão]
  J --> P[Política/RLS]
  P --> Q[(Query no banco)]
  Q --> S[Resposta filtrada]
