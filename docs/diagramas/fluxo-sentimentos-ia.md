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
    
    UpdateDB --> CheckCritical{Gravidade<br/>Crítica?}
    
    CheckCritical -->|Não| End2([Fim:<br/>Análise Salva])
    
    CheckCritical -->|Sim| FindLeader[Buscar Líder<br/>do Time do Membro]
    
    FindLeader --> HasLeader{Líder<br/>Encontrado?}
    
    HasLeader -->|Sim| UseLeaderPhone[Usa Telefone<br/>do Líder]
    HasLeader -->|Não| UsePlantao[Usa Telefone<br/>Plantão Pastoral]
    
    UseLeaderPhone --> NotifyAdmins[notify_admins RPC<br/>Notificação In-App]
    UsePlantao --> NotifyAdmins
    
    NotifyAdmins --> CheckWebhook{Webhook<br/>Make Config?}
    
    CheckWebhook -->|Não| End3([Fim: Só In-App])
    CheckWebhook -->|Sim| SendPrimary[Envia WhatsApp<br/>p/ Líder ou Plantão]
    
    SendPrimary --> CheckCopy{Plantão<br/>≠ Primary?}
    
    CheckCopy -->|Sim| SendCopy[Envia Cópia<br/>p/ Plantão Pastoral]
    CheckCopy -->|Não| End4([Fim: Alertas Enviados])
    
    SendCopy --> End4
    
    style Start fill:#e1f5ff
    style End1 fill:#fff4e1
    style End2 fill:#e1ffe1
    style End3 fill:#e1ffe1
    style End4 fill:#e1ffe1
    style CallAI fill:#f5e1ff
    style CheckCritical fill:#ffe1e1
    style SendPrimary fill:#fff9e1
    style SendCopy fill:#fff9e1
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
| Tabela | Database | `sentimentos_membros` |
| RPC | Database | `notify_admins()` |

## Campos de Análise IA

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `analise_ia_titulo` | TEXT | Título curto gerado pela IA |
| `analise_ia_motivo` | TEXT | Categoria raiz do problema |
| `analise_ia_gravidade` | TEXT | baixa, media, critica |
| `analise_ia_resposta` | TEXT | Mensagem pastoral empática |

## Payload do Webhook Make

```json
{
  "membro_nome": "Nome do Membro",
  "membro_telefone": "(11) 99999-9999",
  "sentimento": "Angustiado",
  "gravidade": "critica",
  "ai_resumo": "Título - Motivo",
  "ai_mensagem_membro": "Mensagem pastoral...",
  "pastor_telefone": "(11) 88888-8888",
  "link_admin": "https://app/intercessao/sentimentos"
}
```

## Referências

- [Fluxo de Notificações](fluxo-notificacoes.md)
- [Manual do Usuário - Intercessão](../manual-usuario.md#7-intercessão)
- [Funcionalidades - Sentimentos](../funcionalidades.md#sentimentos)
