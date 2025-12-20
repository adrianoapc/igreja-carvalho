# Fluxo — Análise de Sentimentos via IA

Este diagrama representa o fluxo completo de **análise de sentimentos via Inteligência Artificial**, desde o registro do membro até o disparo de alertas pastorais.

## Fluxo Principal

```mermaid
flowchart TD
    Start([Membro Registra<br/>Sentimento]) --> SaveDB[Salva em<br/>sentimentos_membros]
    
    SaveDB --> HasMessage{Tem<br/>Mensagem?}
    
    HasMessage -->|Não| End1([Apenas Registro<br/>Sem Análise])
    HasMessage -->|Sim| CallEdge[Chama Edge Function<br/>analise-sentimento-ia]
    
    CallEdge --> FetchSentiment[Busca Sentimento<br/>+ Profile do Membro]
    
    FetchSentiment --> CallAI[Chama Lovable AI<br/>Gemini 2.5 Flash]
    
    CallAI --> AIProcess{AI Processa}
    
    AIProcess -->|Sucesso| ParseResult[Parseia JSON:<br/>titulo, motivo,<br/>gravidade, resposta]
    AIProcess -->|Erro| FallbackAnalysis[Análise Fallback<br/>Baseada no Sentimento]
    
    ParseResult --> UpdateDB[UPDATE sentimentos_membros<br/>analise_ia_*]
    FallbackAnalysis --> UpdateDB
    
    UpdateDB --> CheckCritical{Gravidade<br/>Crítica ou<br/>Média+?}
    
    CheckCritical -->|Gravidade < MEDIA| End2([Fim:<br/>Análise Salva<br/>em Sentimentos])
    
    CheckCritical -->|Gravidade >= MEDIA| CreateGabinete["Cria em<br/>atendimentos_pastorais<br/>origem='SENTIMENTOS'"]
    
    CreateGabinete --> FindLeader[Detecta Líder<br/>do Membro]
    
    FindLeader --> HasLeader{Líder<br/>Encontrado?}
    
    HasLeader -->|Sim| AssignLeader["Atribui a Líder<br/>do Membro"]
    HasLeader -->|Não| AssignPlantao["Atribui a Pastor<br/>de Plantão"]
    
    AssignLeader --> Notify["Notifica Pastor<br/>Responsável"]
    AssignPlantao --> Notify
    
    Notify --> CheckNotif{Gravidade<br/>CRÍTICA?}
    
    CheckNotif -->|Sim| NotifyImm["Notificação Imediata:<br/>WhatsApp + In-App"]
    CheckNotif -->|Não| NotifyPassive["Notificação Passiva:<br/>In-App no Gabinete"]
    
    NotifyImm --> End3([Fim: Atendimento<br/>no Gabinete])
    NotifyPassive --> End3
    
    style Start fill:#e1f5ff
    style End2 fill:#fff4e1
    style End3 fill:#e1ffe1
    style CreateGabinete fill:#fff3cd
    style CallAI fill:#f5e1ff
    style AssignLeader fill:#e6ffe6
    style AssignPlantao fill:#e6ffe6
    style NotifyImm fill:#ffe6e6
```

## Fluxo de Classificação da IA

```mermaid
flowchart LR
    Input[Sentimento +<br/>Mensagem] --> AI{Lovable AI<br/>Gemini 2.5 Flash}
    
    AI --> Titulo[Título<br/>3-5 palavras]
    AI --> Motivo[Motivo Raiz:<br/>Saúde, Família,<br/>Financeiro, Luto,<br/>Relacionamento, etc.]
    AI --> Gravidade[Gravidade:<br/>baixa, media, critica]
    AI --> Resposta[Mensagem<br/>Pastoral 3 frases]
    
    Titulo --> DB[(sentimentos_membros)]
    Motivo --> DB
    Gravidade --> DB
    Resposta --> DB
    
    style AI fill:#f5e1ff
    style DB fill:#e1f5ff
```

## Critérios de Gravidade Crítica

```mermaid
flowchart TD
    Check{Verifica<br/>Criticidade}
    
    Check --> Cond1{gravidade =<br/>'critica'?}
    Check --> Cond2{sentimento IN<br/>triste, com_medo,<br/>angustiado, sozinho?}
    
    Cond1 -->|Sim| Critical[⚠️ CRÍTICO]
    Cond2 -->|Sim| Critical
    Cond1 -->|Não| Cond2
    Cond2 -->|Não| Normal[Normal]
    
    style Critical fill:#ffe1e1
    style Normal fill:#e1ffe1
```

## Componentes

| Componente | Tipo | Path |
|------------|------|------|
| Edge Function | Backend | `supabase/functions/analise-sentimento-ia/index.ts` |
| Dialog Registro | Frontend | `src/components/sentimentos/RegistrarSentimentoDialog.tsx` |
| Lista Admin | Frontend | `src/pages/intercessao/Sentimentos.tsx` |
| Gabinete | Frontend | `src/pages/GabinetePastoral.tsx` |
| Tabela Sentimentos | Database | `sentimentos_membros` |
| Tabela Atendimentos | Database | `atendimentos_pastorais` |
| RPC Notificação | Database | `notify_admins()` |

## Campos de Análise IA

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `analise_ia_titulo` | TEXT | Título curto gerado pela IA |
| `analise_ia_motivo` | TEXT | Categoria raiz do problema |
| `analise_ia_gravidade` | TEXT | baixa, media, critica |
| `analise_ia_resposta` | TEXT | Mensagem pastoral empática |

## Referências

- [Fluxo do Gabinete Digital](fluxo-gabinete-pastoral.md)
- [Fluxo de Notificações](fluxo-notificacoes.md)
- [ADR-014: Gabinete Digital](../adr/ADR-014-gabinete-digital-e-roteamento-pastoral.md)
- [Manual do Usuário - Intercessão](../manual-usuario.md#5-intercessão-oração-e-testemunhos)
- [Funcionalidades - Sentimentos](../funcionalidades.md#55-sentimentos)
