# ADR 014: Módulo Gabinete Digital, Roteamento Pastoral e Unificação de Entradas

## Status
Aceite

## Contexto
O sistema anterior tratava as interações dos membros de forma fragmentada, gerando riscos de perda de informação e falta de acompanhamento adequado:

1.  **Fragmentação:** O Chatbot (WhatsApp) focava apenas em respostas simples ou pedidos de oração que iam para uma lista genérica.
2.  **Métricas vs Ação:** A Análise de Sentimentos gerava gráficos, mas não gatilhos de intervenção pastoral.
3.  **Falta de Distinção:** Não havia separação clara entre um "Pedido de Oração" (Intercessão) e um "Pedido de Ajuda/Aconselhamento" (Pastoral/Gabinete).
4.  **Dependência de Integração:** As notificações dependiam excessivamente do Make, resultando em erros de *timeout* e falhas silenciosas onde o pastor nunca recebia o alerta.
5.  **Buraco Negro:** Mensagens enviadas no WhatsApp muitas vezes não geravam um "ticket" de acompanhamento, perdendo-se no fluxo de conversas.

Era necessária uma estrutura que centralizasse o "Cuidado Pastoral" (conceito de Prontuário/Gabinete), garantisse que casos graves fossem encaminhados imediatamente para o líder correto e mantivesse o histórico de forma segura e privada.

## Decisão
Implementámos o conceito de **Gabinete Digital** através de uma nova arquitetura de dados e lógica de roteamento nas Edge Functions.

### 1. Nova Estrutura de Dados (`atendimentos_pastorais` e `agenda_pastoral`)
Criámos uma tabela centralizada para gerir "Tickets de Cuidado" e uma tabela de agenda administrativa dos pastores.
* **Objetivo:** Separar o fluxo de trabalho pastoral (que exige ação/agendamento) do fluxo de intercessão (que exige oração).
* **Campos Chave de `atendimentos_pastorais`:**
    * `origem`: CHATBOT, SENTIMENTOS, APP_ORACAO, AGENDA, MANUAL.
    * `gravidade`: BAIXA, MEDIA, ALTA, CRITICA (Definido por IA ou manual).
    * `status`: PENDENTE, EM_ACOMPANHAMENTO, AGENDADO, CONCLUIDO.
    * `pastor_responsavel_id`: O dono do caso (Líder ou Plantão).
    * `pessoa_id` ou `visitante_id`: Vinculação do atendido.
    * `conteudo_original`: O relato completo (Protegido por RLS).
    * `data_agendamento` e `local_atendimento`: Data/local do encontro (ex: Gabinete, Online, Visita, Ligação).
    * `historico_evolucao`: JSONB para notas de progresso e análise técnica da IA.
* **Nova tabela `agenda_pastoral`:** Compromissos administrativos (reuniões, cultos, bloqueios); usada para evitar conflitos ao agendar atendimentos.

### 2. Estratégia de "Dual-Write" (Escrita Dupla)
Para manter a compatibilidade com o sistema legado e garantir segurança na transição:
* **Tabela Legada (`pedidos_oracao`):** Continua a receber todos os pedidos para alimentar a lista pública de intercessão e estatísticas gerais.
* **Tabela Nova (`atendimentos_pastorais`):** Recebe apenas casos que demandam ação (solicitações pastorais diretas ou casos com gravidade >= MÉDIA detectada pela IA).

### 3. Roteamento Inteligente de Liderança e Deduplicação de Identidade
As Edge Functions (`chatbot-triagem`, `analise-sentimento-ia` e `analise-pedido-ia`) agora executam a lógica de atribuição de responsabilidade antes de gravar na base de dados:
* **Regra 1 (Membro com Líder):** Se o utilizador tem `lider_id` no seu perfil, o atendimento é atribuído automaticamente a esse líder.
* **Regra 2 (Visitante/Sem Líder):** O atendimento é atribuído ao "Pastor de Plantão" (ID configurável via constantes ou base de dados).
* **Deduplicação de Identidade (Chatbot):** Quando o telefone corresponde a múltiplos `profiles` (ex: pai/filho com mesmo número), ordena por `data_nascimento` mais antiga (assume adulto) e depois por `created_at` mais antiga; seleciona o primeiro e registra alerta no console. Se nenhum perfil existir, cria/recupera `visitantes_leads`.

### 4. Gestão de Configuração de IA (Base de Dados)
Removemos os prompts *hardcoded* (fixos no código).
* Todas as IAs buscam os seus prompts (System Role) e modelos (`gpt-4o-mini`) na tabela `chatbot_configs`.
* Isto permite *fine-tuning* dos prompts de "Psicólogo Pastoral" ou ajustes de tom sem necessidade de novo deploy.

### 5. Matriz de Alertas Híbrida
* **Alertas Imediatos (Chatbot):** O Bot retorna a flag `notificar_admin: true` para o Make disparar WhatsApp apenas em solicitações explícitas de atendimento.
* **Alertas Passivos (Sentimentos/App):** *Database Webhooks* (Triggers) monitorizam a tabela `atendimentos_pastorais`. Se for inserido um registo com `gravidade >= ALTA`, dispara a notificação assíncrona para o Pastor Responsável.

### 6. Privacidade e Segurança (RLS)
* Criada a view `view_agenda_secretaria` que expõe apenas metadados (data, status, pastor) para a secretaria agendar, ocultando o campo `conteudo_original` para proteger o segredo de confissão/aconselhamento.

## Consequências

### Positivas
* **Fim do "Buraco Negro":** Pedidos de ajuda não se perdem mais; tornam-se pendências auditáveis no sistema.
* **Privacidade:** A secretaria pode operacionalizar a agenda sem ler desabafos sensíveis.
* **Descentralização:** O sistema distribui a carga de cuidado para os líderes diretos, em vez de sobrecarregar o pastor sénior ou de plantão.
* **Proatividade:** A IA de sentimentos gera atendimentos automáticos para casos de risco, permitindo intervenção antes do pedido de socorro explícito.
* **Resiliência:** O armazenamento no banco é desacoplado do envio de notificação. Se o Make falhar, o pedido continua gravado como `PENDENTE`.

### Negativas / Riscos
* **Complexidade de Dados:** A lógica de roteamento exige que o cadastro de membros (`lider_id`) esteja sempre atualizado para ser eficaz.
* **Dependência de IDs:** É crítico garantir que o ID do "Pastor de Plantão" esteja sempre válido nas configurações das Edge Functions.

### 7. Wizard de Agendamento Guiado (23/Dez/2025)
Implementado wizard multi-step em `AgendamentoDialog.tsx` para criar atendimentos com agendamento:
* **Etapa Pessoa:** Autocomplete de membros/visitantes por nome, deduplicação por telefone; se não encontrado, cria visitante automaticamente.
* **Etapa Pastor:** Seleção com validação de disponibilidade configurada em `profiles.disponibilidade_agenda`.
* **Etapa Data:** Calendário com bloqueio de dias não atendidos pelo pastor.
* **Etapa Horário:** Slots de 30min com seleção múltipla; bloqueia conflitos considerando `atendimentos_pastorais` e `agenda_pastoral`.
* **Etapa Modalidade:** Escolhe entre Gabinete, Visita, Ligação, Online; grava `local_atendimento` completo.
* **Gravação:** INSERT em `atendimentos_pastorais` com `pessoa_id` ou `visitante_id`, `data_agendamento`, `gravidade`, `local_atendimento` e `observacoes_internas` (duração total).

## Próximos Passos (Evolução)
* ✅ ~~Criar Interface UI no Lovable para o "Painel Pastoral" (Kanban de atendimentos).~~ (Implementado)
* ✅ ~~Wizard de Agendamento com bloqueio de conflitos.~~ (Implementado)
* Implementar botão de "Chamada Pastoral" no App.
* Criar alertas de anomalia para tendências coletivas de sentimentos (ex: "A igreja está 30% mais ansiosa esta semana").
* Tratar erros `perfilError` em `chatbot-triagem` e melhorar lógica de tie-breaker quando `data_nascimento`/`created_at` faltam.
