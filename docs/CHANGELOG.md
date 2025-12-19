# Changelog

Todas as mudanças notáveis do sistema são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Não Lançado]

### Melhorado

#### 🔐 Melhorias na Autenticação Biométrica (19 de Dez/2025)
- **Detecção automática de tipo de biometria**: Sistema detecta se dispositivo usa Face ID (iPhones X+, iPads Pro) ou Touch ID/Fingerprint e exibe ícone e textos apropriados
- **Tratamento de erros específicos**: 8 tipos de erro WebAuthn mapeados (`NOT_ALLOWED`, `NOT_RECOGNIZED`, `TIMEOUT`, `HARDWARE_ERROR`, `NOT_FOUND`, `SECURITY_ERROR`, `NOT_SUPPORTED`, `UNKNOWN`) com mensagens contextuais
- **Estados de loading contextuais**: Feedback visual específico para cada fase ("Olhe para a câmera...", "Toque no sensor...", "Verificando...", "Entrando...")
- **Haptic Feedback**: Vibração em dispositivos móveis para sucesso (curta) e erro (padrão duplo) via `navigator.vibrate()`
- **Animações visuais**: Transições de cor e pulse animation durante verificação biométrica
- **Fluxo de habilitação melhorado**: `EnableBiometricDialog` com estados visuais (idle → enrolling → success/error) e recuperação de erros

**Arquivos alterados:**
- `src/hooks/useBiometricAuth.tsx`: Novo tipo `BiometricResult`, função `parseWebAuthnError()`, `detectBiometricType()`, `triggerHapticFeedback()`
- `src/pages/BiometricLogin.tsx`: Estados de loading, mensagens contextuais, ícones dinâmicos
- `src/components/auth/BiometricUnlockScreen.tsx`: Estados visuais, detecção de tipo, animações
- `src/components/auth/EnableBiometricDialog.tsx`: Fluxo de habilitação com feedback visual

**Impacto no usuário:**
- Experiência mais clara com feedback visual e textual específico para cada situação
- Usuários de Face ID veem ícone de rosto; usuários de Touch ID veem ícone de digital
- Mensagens de erro orientam próximos passos (tentar novamente vs usar senha)
- Vibração confirma sucesso/erro em dispositivos móveis

**Módulos afetados:** Auth (Biometria)

---

### Adicionado

#### 🤖 Edge Function chatbot-triagem (Intercessão V2 - 18 de Dez/2025)
- **Nova Edge Function `chatbot-triagem`**: Chatbot de triagem para receber pedidos de oração via WhatsApp/Make webhook
  - **Gestão de sessão (State Machine)**: Busca/cria sessão em `atendimentos_bot` com janela de 24h
  - **IA integrada**: Usa OpenAI (`gpt-4o-mini` para chat + `whisper-1` para áudio) para conduzir a conversa
  - **Auditoria LGPD**: Registra todas as mensagens (USER/BOT/SYSTEM) em `logs_auditoria_chat` imutável
  - **Identificação automática**: Diferencia membros (via telefone em `profiles`) de visitantes (`visitantes_leads`) e atualiza `data_ultimo_contato`
  - **Criação de pedido/testemunho**: Insere automaticamente em `pedidos_oracao` ou `testemunhos` com campos de análise IA
  - **Solicitações pastorais**: Prefixa título, marca gravidade ALTA e sinaliza `notificar_admin`
  - **Endpoint público**: `verify_jwt = false` para receber webhook do Make

**Fluxo:**
1. Make envia: `{ telefone, nome_perfil, tipo_mensagem, conteudo_texto? }`
2. Se áudio, baixa via API WhatsApp e transcreve com Whisper
3. Busca sessão ativa (< 24h) ou cria nova em `atendimentos_bot`
4. Registra audit log (USER) e chama IA com system prompt + histórico
5. Se resposta texto: atualiza sessão e devolve próxima pergunta
6. Se resposta JSON `concluido`: encerra sessão, cria registros vinculando membro ou lead externo
7. Resposta retorna `reply_message`, `notificar_admin` e dados de contato para follow-up

**System Prompt IA:**
- Personifica equipe de acolhimento, oculta que é IA e prioriza FAQ antes do fluxo de pedido
- Guia coleta de nome, motivo e preferência de anonimato/publicação
- Só retorna JSON estruturado quando o fluxo é concluído (pedido/testemunho/encaminhamento)

**Módulos afetados:** Intercessão (V2), Evangelismo, Compliance/LGPD

---

#### 🤖 Intercessão V2 - Fase 1: Schema de Banco de Dados (18 de Dez/2025)
- **ENUMs criados**: `status_intercessor` (ATIVO, PAUSA, FERIAS) e `status_sessao_chat` (INICIADO, EM_ANDAMENTO, CONCLUIDO, EXPIRADO)
- **Nova tabela `visitantes_leads`**: CRM de Evangelismo para leads externos via WhatsApp/Bot (telefone único, estágio de funil, origem)
- **Nova tabela `atendimentos_bot`**: State Machine para controle de sessão do chatbot de triagem (histórico_conversa JSONB, meta_dados IA)
- **Nova tabela `logs_auditoria_chat`**: Audit log imutável para compliance LGPD (Append-Only, sem UPDATE/DELETE)
- **Coluna `status_disponibilidade`** em `intercessores`: Controle de carga de trabalho (ATIVO/PAUSA/FERIAS)
- **Colunas em `pedidos_oracao`**: `texto_na_integra` (relato completo), `origem` (WABA/APP/MANUAL), `visitante_id` (FK)
- **RLS restritivo**: Admins/Pastores gerenciam; Intercessores visualizam; Logs apenas INSERT

**Decisão arquitetural:** ADR-012 - CRM de Evangelismo, Chatbot IA e Compliance LGPD

**Impacto no usuário:**
- Preparação para receber pedidos de oração via WhatsApp com triagem por IA
- Separação clara entre cuidado pastoral (membros) e evangelismo (leads externos)
- Controle de burnout de intercessores com status de disponibilidade

**Módulos afetados:** Intercessão, Evangelismo (novo), Compliance/LGPD

---

### Corrigido

#### 🔧 Correções de Rotas e Políticas RLS (18 de Dez/2025)
- **Rota /biblia**: Adicionada rota faltante no App.tsx que causava erro 404 ao acessar a página da Bíblia
- **Rota /minha-familia → /perfil/familia**: Corrigidos links em Sidebar, UserMenu e DashboardVisitante que apontavam para rota inexistente `/minha-familia`; rota correta é `/perfil/familia` (componente FamilyWallet)
- **RLS inscricoes_jornada**: Adicionada política permitindo membros autenticados se inscreverem em jornadas (pessoa_id vinculado ao user_id via profiles)

**Causa**: Rotas não registradas ou inconsistentes no roteador; política RLS restritiva bloqueava auto-inscrição

**Módulos afetados:** Conteúdo (Bíblia), Core (Família/Carteira), Ensino (Jornadas/Cursos)

---

### Adicionado

#### 📚 Documentação de Fluxos (18 de Dez/2025)
- **Novo diagrama**: `docs/diagramas/fluxo-sentimentos-ia.md` — Fluxo completo de análise de sentimentos via IA e alertas pastorais
- **Novo diagrama**: `docs/diagramas/fluxo-escalas-lembretes.md` — Fluxo de lembretes automáticos de escalas (cron + anti-spam)
- **Novo diagrama**: `docs/diagramas/fluxo-liturgia-escalas.md` — Integração automática Liturgia ↔ Escalas via triggers

**Módulos documentados:** Intercessão (Sentimentos), Voluntariado (Escalas), Cultos (Liturgia)

---

#### 🔐 Página de Configuração de Webhooks (18 de Dez/2025)
- **Nova tela admin**: `/admin/webhooks` para gerenciar webhooks de integração de forma segura
- **Segurança**: Valores de webhook são mascarados na interface (exibe apenas `••••••••••`)
- **Atualização via Secrets**: Botão "Atualizar" abre formulário seguro para inserir novos valores sem expor dados
- **Integração**: Suporte a `MAKE_WEBHOOK_URL` e `MAKE_WEBHOOK_LITURGIA` como secrets do projeto
- **Remoção de campo exposto**: Campo `webhook_make_liturgia` removido de ConfiguracoesIgreja.tsx por segurança

**Impacto no usuário:**
- Admins/Técnicos podem gerenciar webhooks sem expor URLs sensíveis na interface
- Navegação via card em Configurações da Igreja → "Webhooks de Integração"

**Módulos afetados:** Admin (Configurações, Integrações)

---

#### 🧠 Card de IA nas Configurações + Tela Admin de Chatbots (18 de Dez/2025)
- **Novo card "Chatbots & Inteligência Artificial"** em `ConfiguracoesIgreja.tsx` confirma status do `OPENAI_API_KEY` e leva ao gerenciamento dedicado
- **Nova tela admin `/admin/chatbots`**: CRUD completo para `chatbot_configs`, seleção de modelos (texto/áudio/visão), edição de prompts e toggle de ativação
- Interface traz diálogos dedicados para criação/edição, pré-visualização dos prompts e controle de exclusão segura

**Impacto no usuário:** Admins visualizam rapidamente se a IA está pronta e conseguem ajustar fluxos de chatbot (modelos, roles, edge functions) sem sair do painel.

**Módulos afetados:** Admin (Configurações, Integrações IA), Intercessão/Evangelismo (Chatbots)

---

#### ⏰ Melhorias nas Edge Functions de Escalas (18 de Dez/2025)
- **disparar-escala**: Agora busca webhook de `configuracoes_igreja` ou secrets do projeto; atualiza `ultimo_aviso_em` após envio bem-sucedido
- **verificar-escalas-pendentes**: Filtro anti-spam adicionado - só dispara para escalas onde `ultimo_aviso_em IS NULL` ou `> 24h`
- **Rastreabilidade**: Campo `ultimo_aviso_em` em `escalas_culto` registra timestamp do último aviso enviado

**Impacto no usuário:**
- Voluntários não recebem lembretes duplicados em curto período
- Sistema de notificações mais confiável e rastreável

**Módulos afetados:** Voluntariado (Escalas)

---

### Adicionado

#### 🤖 Análise de IA para Pedidos de Oração (18 de Dez/2025)
- **Categorização automática por IA**: Pedidos de oração agora são analisados automaticamente via Edge Function `analise-pedido-ia` usando Lovable AI (Gemini 2.5 Flash)
- **Campos de análise**: `analise_ia_titulo` (título sugerido), `analise_ia_motivo` (categoria raiz: Saúde, Financeiro, Luto, Relacionamento, etc.), `analise_ia_gravidade` (baixa/media/critica), `analise_ia_resposta` (mensagem pastoral sugerida)
- **UI integrada**: Cards de pedidos exibem badge de gravidade com cores (verde/amarelo/vermelho), ícones contextuais, e resposta pastoral na visualização detalhada
- **Disparo assíncrono**: Análise executada automaticamente após criação do pedido, sem bloquear fluxo do usuário

**Impacto no usuário:**
- Intercessores e liderança visualizam categorização automática para triagem mais eficiente
- Gravidade visual facilita priorização de pedidos críticos
- Resposta pastoral sugerida auxilia no acompanhamento

**Tabelas/Campos afetados:**
- `pedidos_oracao`: Adicionados campos `analise_ia_titulo`, `analise_ia_motivo`, `analise_ia_gravidade`, `analise_ia_resposta`

**Módulos afetados:** Intercessão (Pedidos de Oração)

---

### Refatorado

#### 📊 Reuso do Widget de Escalas (17 de Dez/2025)
- Unificamos o widget de monitoramento de escalas em um componente compartilhado (`EscalasPendentesWidget`) e o adicionamos aos dashboards de Líder e Admin para reaproveitar lógica de consulta e apresentação.

**Comportamento:** passa a exibir o mesmo painel de confirmados/pendentes/recusados também no dashboard do Admin (sem alterações de fluxo ou regras de negócio).

**Riscos/Observações:** aumento leve de leituras no Supabase ao carregar os dashboards; sem mudanças de schema ou permissões.

### Adicionado

#### 🎓 Player do Aluno: Certificado e Celebração (17 de Dez/2025)
- **Download de certificado em PDF** diretamente no `CursoPlayer` ao concluir 100% das etapas (botão na sidebar e na tela de celebração)
- **Tela de celebração** em tela cheia quando todas as etapas estão concluídas, com chamada para baixar o certificado
- **Design do PDF**: paisagem A4, bordas decorativas azul/dourado, identifica aluno, jornada e data de conclusão

**Impacto no usuário:**
- Alunos obtêm comprovante imediato de conclusão sem intervenção do admin
- Jornada paga continua bloqueada até pagamento, mas certificado só aparece após todas as etapas concluídas

**Riscos/Observações:**
- Geração de PDF ocorre no front-end (jsPDF); navegadores bloqueiam pop-up se for acionado automaticamente — ação do usuário é necessária
- Sem alterações de schema; usa dados existentes de jornada/inscrição

**Módulos afetados:** Ensino / Jornadas (Player do Aluno)

### Corrigido

#### 🔒 Correções de Segurança (17 de Dez/2025)
- **Path Traversal em uploads**: Adicionada validação de caminho em `Publicacao.tsx` e `MidiasGeral.tsx` para prevenir ataques de path traversal em uploads de arquivos
- **Funções RPC sem autorização**: Adicionadas verificações de `auth.uid()` em 3 funções SECURITY DEFINER:
  - `get_user_familia_id`: Agora verifica se usuário consulta próprio familia_id (ou é admin)
  - `alocar_pedido_balanceado`: Agora requer role admin, pastor ou intercessor ativo
  - `buscar_pessoa_por_contato`: Agora requer autenticação (defense in depth)

**Causa**: Funções RPC com SECURITY DEFINER bypassavam RLS sem validar permissões do chamador

**Impacto**: Nenhum para usuário final; hardening interno de segurança

**Módulos afetados**: Segurança (global), Intercessão, Família, Publicação, Mídias

---

### Adicionado

#### 🎓 Editor de Conteúdo de Etapas com Quiz (17 de Dez/2025)
- **EtapaContentDialog expandido**: Novo editor admin para configurar conteúdo de etapas com 4 tipos suportados
  - **Texto/Leitura**: Armazena conteúdo em `conteudo_texto`
  - **Vídeo Aula**: URL em `conteudo_url` com preview YouTube/Vimeo em tempo real; checkbox para bloqueio até conclusão (`check_automatico`)
  - **Quiz/Prova**: Interface para criar N perguntas com 4 alternativas; marca resposta correta; configurável nota mínima de aprovação (0-100); salvo em `quiz_config` (JSON)
  - **Reunião/Tarefa**: Tipo informativo para etapas presenciais ou tarefas; requer confirmação manual do líder no Kanban
- **Validações**: Cada tipo tem campos obrigatórios verificados antes de salvar; feedback de erro específico ao usuário
- **Preview dinâmico**: Videos com embed funcional que atualiza em tempo real conforme URL é digitada

**Impacto no usuário:**
- Admins ganham interface robusta para criar quizzes educacionais com múltiplas tentativas
- Vídeos com bloqueio automático garantem que alunos assistam conteúdo completo
- Suporte a 4 tipos de conteúdo cobre a maioria dos cenários educacionais

**Riscos/Observações:**
- `quiz_config` é armazenado como JSON; estrutura deve ser mantida para compatibilidade futura
- Preview de vídeo funciona para YouTube/Vimeo; outras plataformas mostram placeholder
- Sem validação de URL no front-end (deixado para backend)

**Tabelas/Campos afetados:**
- `etapas_jornada.tipo_conteudo`, `conteudo_url`, `conteudo_texto`, `quiz_config`, `check_automatico` (já existentes, agora em uso completo)

---

#### 🎓 Diferenciar Tipos de Jornadas com Badges Visuais (17 de Dez/2025)
- **Tipo de Jornada (UI)**: RadioGroup com 3 tipos (Curso/EAD, Processo/Pipeline, Híbrido) em `NovaJornadaDialog` e `EditarJornadaDialog`
  - **Curso/EAD** (`auto_instrucional`): Foco em conteúdo educacional; portal visível e pagamento opcional
  - **Processo/Pipeline** (`processo_acompanhado`): Jornada interna de acompanhamento (pastoral, onboarding); **portal e pagamento desabilitados automaticamente**; etapas chamadas "Colunas do Kanban"
  - **Híbrido**: Combina educação + acompanhamento
- **Listagem visual**: Badges com cores (azul/Curso, verde/Processo, roxo/Híbrido) e ícones na página `Jornadas` para identificação rápida do tipo
- **Condicional na UI**: Portal e pagamento ficam ocultos quando tipo é "Processo"; alerta informativo explica limitação
- **Etapas label dinâmico**: "Capítulos" para cursos, "Colunas do Kanban" para processos

**Impacto no usuário:**
- Admins diferenciam jornadas de forma clara ao criar/editar
- Alunos e líderes identificam rapidamente tipo da jornada na listagem
- Simplifica criação de jornadas internas sem acumular campo de pagamento

**Riscos/Observações:**
- Tipo é imutável após criação (decisão de design para evitar cascata de mudanças); se precisar mudar, é necessário excluir e recriar
- Campo `tipo_jornada` é NOT NULL com default `auto_instrucional` (retrocompatível com jornadas existentes)

**Tabelas/Campos afetados:**
- `jornadas.tipo_jornada` (TEXT NOT NULL DEFAULT 'auto_instrucional') - **já presente no banco via migração anterior**
- UI: `NovaJornadaDialog.tsx`, `EditarJornadaDialog.tsx`, `Jornadas.tsx`

---

#### 🎓 Jornadas Avançadas: Tipos, Quiz e Soft-Lock (Dez/2024)
- **Tipo de Jornada**: Campo `tipo_jornada` classifica jornadas como `auto_instrucional` (Player), `processo_acompanhado` (Kanban) ou `hibrido`
- **Etapas enriquecidas**: Tipos de conteúdo (`texto`, `video`, `quiz`, `tarefa`, `reuniao`), URL de conteúdo, configuração de quiz (JSON), check automático e duração estimada
- **Sistema de Quiz**: Nova tabela `respostas_quiz` para histórico de respostas dos alunos com nota, aprovação e tentativas
- **Soft-Lock**: Campo `check_automatico` permite definir se o sistema avança automaticamente ou requer ação do aluno

**Tabelas alteradas:**
- `jornadas`: Adicionado campo `tipo_jornada` (text com check constraint)
- `etapas_jornada`: Adicionados campos `conteudo_tipo`, `conteudo_url`, `quiz_config`, `check_automatico`, `duracao_estimada_minutos`
- `respostas_quiz`: Nova tabela com RLS para histórico de quizzes

**Módulos afetados:** Jornadas, Ensino, Player de Cursos

---

#### 🎓 Jornadas com Pagamento (Dez/2024)
- **Cursos pagos**: Jornadas agora podem ser configuradas como pagas, com valor definido pelo admin
- **Status de pagamento**: Inscrições possuem status de pagamento (`isento`, `pendente`, `pago`)
- **Integração financeira**: Inscrições pagas podem vincular-se a transações financeiras para rastreabilidade
- **Categoria financeira**: Criada categoria "Cursos e Treinamentos" (entrada) para receitas de cursos

**Tabelas alteradas:**
- `jornadas`: Adicionados campos `requer_pagamento` (boolean) e `valor` (numeric)
- `inscricoes_jornada`: Adicionados campos `status_pagamento` (text) e `transacao_id` (FK)
- `categorias_financeiras`: Inserida categoria "Cursos e Treinamentos"

**Módulos afetados:** Jornadas, Finanças

---

## Histórico

> Releases anteriores não foram documentadas neste formato.
