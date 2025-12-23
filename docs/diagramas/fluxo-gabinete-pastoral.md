# Fluxo — Gabinete Digital e Cuidado Pastoral

Diagrama visual (Mermaid) do fluxo completo do **Gabinete Digital**, desde a criação automática de atendimentos até o acompanhamento e conclusão.

## 1. Fluxo Principal: Criação e Roteamento de Atendimentos

```mermaid
flowchart TD
    Start{Origem do<br/>Atendimento?} 
    
    Start -->|Via Chatbot| ChatBot["Membro/Visitante<br/>envia WhatsApp<br/>pedindo ajuda pastoral"]
    Start -->|Via Sentimentos| Sentiment["Membro registra<br/>sentimento negativo<br/>3+ dias consecutivos"]
    Start -->|Via Pedido de Ajuda| DirectCall["Membro clica<br/>'Chamar Pastor'<br/>no app"]
    Start -->|Via Manual| Manual["Admin cria<br/>atendimento<br/>manualmente"]
    
    ChatBot --> TriggerBot["Edge Function<br/>chatbot-triagem"]
    Sentiment --> TriggerSent["Edge Function<br/>analise-sentimento-ia"]
    DirectCall --> TriggerDirect["Edge Function<br/>criar-atendimento"]
    Manual --> CreateManual["Insere em<br/>atendimentos_pastorais"]
    
    TriggerBot --> AnalyzeAI["IA Analisa:<br/>gravidade, motivo,<br/>resposta sugerida"]
    TriggerSent --> AnalyzeAI
    TriggerDirect --> GradeInput["Membro define<br/>gravidade/categoria"]
    
    AnalyzeAI --> CreateAttendance["Cria registro em<br/>atendimentos_pastorais"]
    GradeInput --> CreateAttendance
    CreateManual --> CreateAttendance
    
    CreateAttendance --> DetectLeader["Detecta Líder Direto<br/>do Membro"]
    
    DetectLeader --> HasLeader{Membro tem<br/>lider_id?}
    
    HasLeader -->|Sim| AssignLeader["Atribui a Líder Direto"]
    HasLeader -->|Não| AssignPlantao["Atribui a Pastor<br/>de Plantão"]
    
    AssignLeader --> SetStatus["Status: PENDENTE"]
    AssignPlantao --> SetStatus
    
    SetStatus --> Notify["Dispara Notificação"]
    
    Notify --> CheckGrav{Gravidade<br/>Crítica?}
    
    CheckGrav -->|Sim| NotifyImm["⚠️ Notificação Imediata<br/>WhatsApp + In-App<br/>ao Pastor Responsável"]
    CheckGrav -->|Não| NotifyPassive["📬 Notificação Passiva<br/>In-App apenas<br/>aparece no Gabinete"]
    
    NotifyImm --> End1([Pronto para<br/>Acompanhamento])
    NotifyPassive --> End1
    
    style ChatBot fill:#c3e6ff
    style Sentiment fill:#c3e6ff
    style DirectCall fill:#c3e6ff
    style Manual fill:#fff9e6
    style AnalyzeAI fill:#f5e1ff
    style AssignLeader fill:#e6ffe6
    style AssignPlantao fill:#e6ffe6
    style NotifyImm fill:#ffe6e6
    style End1 fill:#e6ffe6
```

## 2. Fluxo de Estado: Kanban do Gabinete

```mermaid
flowchart LR
    Pend["<b>PENDENTE</b><br/>Novo atendimento,<br/>aguardando ação<br/>do pastor"]
    
    Acomp["<b>EM ACOMPANHAMENTO</b><br/>Pastor iniciou<br/>contato/conversa<br/>com membro"]
    
    Agend["<b>AGENDADO</b><br/>Encontro pastoral<br/>marcado para<br/>data/hora específica"]
    
    Concl["<b>CONCLUÍDO</b><br/>Caso encerrado,<br/>membro acompanhado<br/>ou referenciado"]
    
    Pend -->|Pastor clica<br/>'Iniciar'| Acomp
    Acomp -->|Pastor clica<br/>'Agendar'| Agend
    Agend -->|Após encontro| Acomp
    Acomp -->|Pastor clica<br/>'Encerrar'| Concl
    
    style Pend fill:#fff3cd
    style Acomp fill:#d1ecf1
    style Agend fill:#ffe6e6
    style Concl fill:#d4edda
```

## 3. Fluxo: Prontuário (Detalhe do Atendimento)

```mermaid
flowchart TD
    OpenCard["Pastor clica<br/>no card do<br/>atendimento"]
    
    OpenCard --> DrawerOpen["Drawer abre<br/>com abas"]
    
    DrawerOpen --> Aba1["<b>Aba: Geral</b><br/>Nome, status, gravidade<br/>data criação, líder direto"]
    DrawerOpen --> Aba2["<b>Aba: Histórico</b><br/>Se origem=CHATBOT:<br/>Exibe conversa WhatsApp"]
    DrawerOpen --> Aba3["<b>Aba: Notas</b><br/>Array de evolução<br/>timestamp, autor, msg"]
    DrawerOpen --> Aba4["<b>Aba: Agendamento</b><br/>Data/hora + modalidade<br/>grava data_agendamento<br/>e local_atendimento"]
    DrawerOpen --> Aba5["<b>Aba: Análise IA</b><br/>Resumo da IA:<br/>gravidade, motivo,<br/>resposta sugerida"]
    
    Aba1 --> Action1["Pastor pode editar<br/>status aqui"]
    Aba3 --> Action2["Pastor adiciona nota<br/>de progresso"]
    Aba4 --> Action3["Pastor marca<br/>data/hora do<br/>encontro"]
    Aba5 --> Action4["Pastor copia<br/>resposta sugerida"]
    
    Action1 --> Save["Salva atendimento"]
    Action2 --> Save
    Action3 --> Save
    Action4 --> Save
    
    Save --> Close["Drawer fecha"]
    
    style DrawerOpen fill:#e2e3e5
    style Aba1 fill:#e1f5ff
    style Aba2 fill:#e1f5ff
    style Aba3 fill:#e1f5ff
    style Aba4 fill:#fff9e1
    style Aba5 fill:#f5e1ff
    style Save fill:#d4edda
```

## 4. Fluxo: Integração com Outras Automações

```mermaid
graph TB
    subgraph "Origem: Sentimentos"
        SentInsert["INSERT em<br/>sentimentos_membros"]
        SentTrigger["Trigger:<br/>analise-sentimento-ia"]
        SentInsert --> SentTrigger
    end
    
    subgraph "Origem: Pedidos de Oração"
        PedInsert["INSERT em<br/>pedidos_oracao"]
        PedTrigger["Trigger:<br/>analise-pedido-ia"]
        PedInsert --> PedTrigger
    end
    
    subgraph "Gabinete Digital"
        Attend["atendimentos_pastorais<br/>criado com status=PENDENTE<br/>gravidade, origem, etc"]
    end
    
    subgraph "Notificações"
        NotifTrigger["Trigger:<br/>INSERT em atendimentos_pastorais<br/>se gravidade >= ALTA"]
        DispatchAlert["disparar-alerta<br/>resolve destinatário<br/>envia WhatsApp/In-App"]
    end
    
    SentTrigger -->|Se gravidade >= MEDIA| Attend
    PedTrigger -->|Se gravidade >= MEDIA| Attend
    
    Attend --> NotifTrigger
    NotifTrigger --> DispatchAlert
    
    style Attend fill:#fff3cd
    style DispatchAlert fill:#ffe6e6
```

## 5. Fluxo: RLS e Permissões

```mermaid
flowchart TD
    User{Tipo de<br/>Usuário?}
    
    User -->|Pastor/Líder| PastorRLS["RLS: Vê apenas<br/>seus próprios<br/>atendimentos<br/>(pastor_responsavel_id<br/>=auth.uid())"]
    
    User -->|Secretaria| SecRLS["RLS via view<br/>view_agenda_secretaria<br/>Vê: id, nome, status<br/>data_agendado,<br/>gravidade<br/>NÃO vê:<br/>conteudo_original"]
    
    User -->|Admin| AdminRLS["Acesso CRUD<br/>completo em<br/>atendimentos_pastorais"]
    
    User -->|Membro| MemberRLS["Pode ver<br/>status de seu próprio<br/>atendimento<br/>(via view específica<br/>a confirmar)"]
    
    PastorRLS --> PastorUX["UI no /gabinete<br/>Kanban pessoal<br/>com seus<br/>atendimentos"]
    
    SecRLS --> SecUX["UI view_agenda_secretaria<br/>Agendar encontros<br/>sem ler dados sensíveis"]
    
    AdminRLS --> AdminUX["UI Dashboard<br/>KPI de saúde<br/>pastoral geral"]
    
    style PastorRLS fill:#e1f5ff
    style SecRLS fill:#fff9e1
    style AdminRLS fill:#e6ffe6
    style PastorUX fill:#d1ecf1
    style SecUX fill:#ffe6e6
    style AdminUX fill:#d4edda
```

## 6. Critérios de Gravidade Automática (IA)

```mermaid
flowchart LR
    Input["Contexto<br/>(sentimento, pedido,<br/>ou texto)"]
    
    Input --> AI["IA Lovable Gemini<br/>Analisa"]
    
    AI --> Baixa["<b>BAIXA</b><br/>Dúvida simples,<br/>curiosidade,<br/>gratidão"]
    
    AI --> Media["<b>MÉDIA</b><br/>Necessidade de<br/>orientação,<br/>dificuldade<br/>pontual"]
    
    AI --> Alta["<b>ALTA</b><br/>Crise emocional,<br/>luto, separação,<br/>decisão importante"]
    
    AI --> Critica["<b>CRÍTICA</b><br/>Risco de vida,<br/>suicídio, abuso,<br/>situação urgente"]
    
    Baixa --> NoGab["Sem atendimento<br/>pastoral<br/>(fica em sentimentos<br/>ou pedidos)"]
    
    Media --> CreateGab["Cria em<br/>atendimentos_pastorais<br/>com gravidade=MEDIA"]
    
    Alta --> CreateGab
    Critica --> CreateGab
    
    CreateGab --> Notify["Notificação<br/>imediata"]
    
    style Critica fill:#ffe6e6
    style Alta fill:#fff3cd
    style Media fill:#d1ecf1
    style Baixa fill:#d4edda
```

---

## Notas de Implementação

- **Dual-Write**: `analise-sentimento-ia` e `analise-pedido-ia` continuam escrevendo em `sentimentos_membros` e `pedidos_oracao` (compatibilidade legado) **E** criam `atendimentos_pastorais` para casos >= MÉDIA
- **Agendamento guiado**: Wizard exige nome/telefone e sugere membro/visitante existentes; grava `pessoa_id` ou `visitante_id`, `data_agendamento`, `local_atendimento` e `gravidade` manual; evita conflitos considerando `atendimentos_pastorais` e `agenda_pastoral`
- **Resolução de identidade no chatbot**: Se o telefone tem múltiplos `profiles`, ordena por data de nascimento mais antiga e criação mais antiga antes de vincular; caso não exista, cria `visitantes_leads`
- **Configuração Dinâmica**: Prompts e modelos buscados em `chatbot_configs`, não hardcoded nas edge functions
- **RLS Privacidade**: View `view_agenda_secretaria` permite secretaria agendar sem ler `conteudo_original`
- **Notificações Híbridas**: Imediatas para CRITICA, passivas para MEDIA/ALTA (só in-app, sem WhatsApp automático)
- **Referências**:
  - ADR-014: [`docs/adr/ADR-014-gabinete-digital-e-roteamento-pastoral.md`](../adr/ADR-014-gabinete-digital-e-roteamento-pastoral.md)
  - Funcionalidades: [`docs/funcionalidades.md#4-gabinete-digital-e-cuidado-pastoral`](../funcionalidades.md#4-gabinete-digital-e-cuidado-pastoral)
