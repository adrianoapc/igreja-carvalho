# Fluxo do Modulo Pessoas

Objetivo: visualizar o caminho principal na tela Pessoas conforme o uso atual — acessar, listar, buscar/filtrar, cadastrar, editar e salvar, como descrito na avaliação de UX da tela.

```mermaid
flowchart TD
    A([Inicio]) --> B[Acessar tela Pessoas]
    B --> C[Listar pessoas]
    C --> D{Buscar ou filtrar?}
    D -->|Sim| E[Aplicar filtros e atualizar lista]
    D -->|Nao| F[Escolher proxima acao]
    E --> F
    F --> G{Criar ou editar?}
    G -->|Criar| H[Criar pessoa]
    G -->|Editar| I[Editar pessoa]
    H --> J[Salvar cadastro]
    I --> J
    J --> K[Recarregar/atualizar listagem]
    K --> M([Fim])
```
