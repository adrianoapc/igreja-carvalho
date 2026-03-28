# Fluxo — Cadastro Público `Café V&P`

## Objetivo

Registrar dados iniciais de pessoas na recepção de novos membros (`Café V&P`) em fluxo mobile, com **idempotência** (sem duplicidade) por `telefone` ou `email` no escopo de `igreja_id` e `filial_id`.

## Diagrama (Mermaid)

```mermaid
flowchart TD
    A[Link Externo Café V&P<br/>/cadastro/cafe-vp?igreja_id&filial_id] --> B[Wizard Mobile Público]
    B --> C{Validação local<br/>nome + contato}
    C -- inválido --> B
    C -- válido --> D[Edge Function cadastro-publico<br/>action: cadastrar_cafe_vp]

    D --> E{Possui igreja_id?}
    E -- não --> X[HTTP 400<br/>Link inválido]
    E -- sim --> F[Normaliza telefone/email]

    F --> G{Busca profile por contato<br/>status membro/visitante/frequentador<br/>+ filtro tenant}
    G -- encontrado --> H[Atualiza profile existente<br/>sem criar novo registro]
    G -- não encontrado --> I[Cria novo profile<br/>status visitante<br/>entrou_por: cafe_vp]

    H --> J[Retorna success + isUpdate=true]
    I --> K[Retorna success + isUpdate=false]

    J --> L[UI exibe confirmação<br/>continuidade de trilha]
    K --> L
```

## Regras-chave

- **Escopo multi-tenant obrigatório:** nenhuma operação sem `igreja_id`.
- **Idempotência por contato:** evita duplicar cadastro quando pessoa já existe.
- **Compatibilidade com processo atual:** permite posterior promoção para membro e avanço em trilha.
