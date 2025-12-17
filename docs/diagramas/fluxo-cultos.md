# Fluxo do Módulo Cultos e Liturgia

```mermaid
flowchart TD
    subgraph Admin
        GC[Agenda/Geral]
        NC[Novo Culto/Evento]
        MC[Mesa de Controle]
        AL[Liturgia: Adicionar Itens]
        AR[Recursos: Vincular Mídias]
        AT[Templates: Aplicar/Salvar]
        GT[Times/Posições]
        GE[Escalas: Alocar Voluntários]
        GM[Gerenciar Mídias]
    end

    subgraph Projeção
        TL[TELÃO Comunicados /telao]
        TLL[TELÃO Liturgia /telao-liturgia/:id]
    end

    GC --> NC --> MC
    MC --> AL --> AR
    MC --> AT
    GC --> GT --> GE
    GC --> GM

    AR -->|Recursos prontos| TLL
    GM -->|Comunicados ativos| TL

    %% Telão Comunicados
    TL -->|Fonte: comunicados.ativo & exibir_telao\nordem_telao, janelas inicio/fim| TL

    %% Telão Liturgia
    TLL -->|Fonte: cultos → liturgia_culto → liturgia_recursos → midias| TLL
    TLL -->|Realtime: atualiza playlist ao editar liturgia/recursos| TLL

    classDef proj fill:#0f172a,stroke:#334155,stroke-width:1px,color:#f8fafc;
    class TL,TLL proj;
```

Notas (evidência no repositório):
- Páginas: `src/pages/Cultos.tsx`, `src/pages/cultos/Geral.tsx`, `src/pages/cultos/Eventos.tsx`, `src/pages/Telao.tsx`, `src/pages/TelaoLiturgia.tsx`
- Componentes (liturgia/escala/templates/mídia): `src/components/cultos/*`
- Tabelas lidas no código:
  - Dashboard: `cultos`, `times_culto`, `escalas_culto`, `midias`
  - Projeção Liturgia: `liturgia_culto`, `liturgia_recursos` (join com `midias`)
  - Projeção Comunicados: `comunicados` (filtros: `ativo`, `exibir_telao`, `data_inicio`, `data_fim`, `ordem_telao`)

Pontos a confirmar:
- (a confirmar) Campos completos de "Mesa de Controle" e rotas internas específicas além de `Geral`, `Eventos`, `Times`, `Templates` — baseados nos arquivos presentes.
