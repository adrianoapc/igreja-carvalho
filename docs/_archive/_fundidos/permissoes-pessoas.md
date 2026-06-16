# Permissoes do Modulo Pessoas

Fluxo de aplicacao de controle de acesso no modulo Pessoas: uma request autenticada tem o perfil/role identificado, as politicas RLS sao aplicadas no Supabase/Postgres e o resultado retornado ja vem filtrado conforme permissoes.

```mermaid
flowchart TD
    A([Request autenticada]) --> B[Frontend envia consulta de Pessoas]
    B --> C[Supabase recebe JWT e contexto de perfil]
    C --> D[Identificar role/perfil do usuario]
    D --> E[Aplicar politicas RLS/permissionamento em tabelas de pessoas]
    E --> F[Resultado filtrado pelo RLS]
    F --> G[Frontend exibe apenas dados permitidos]
```
