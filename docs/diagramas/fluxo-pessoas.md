# Fluxo do Modulo Pessoas

Objetivo: visualizar o caminho principal na tela Pessoas conforme o uso atual — acessar, listar, buscar/filtrar, cadastrar, editar e salvar, como descrito na avaliação de UX da tela. **Todas as operações são automaticamente filtradas por `igreja_id`** do usuário logado.

```mermaid
flowchart TD
    A([Inicio]) --> B[Acessar tela Pessoas]
    B --> C[Obter igreja_id do usuário<br/>useIgrejaId()]
    C --> D[Listar pessoas<br/>WHERE igreja_id = ?]
    D --> E{Buscar ou filtrar?}
    E -->|Sim| F[Aplicar filtros adicionais<br/>+ igreja_id]
    E -->|Nao| G[Escolher proxima acao]
    F --> G
    G --> H{Criar ou editar?}
    H -->|Criar| I[Criar pessoa<br/>igreja_id automático]
    H -->|Editar| J[Editar pessoa<br/>validar igreja_id]
    I --> K[Salvar cadastro<br/>INSERT profiles]
    J --> K
    K --> L[Recarregar/atualizar listagem<br/>scoped por igreja]
    L --> M([Fim])
```
