# Documentação de Funcionalidades - Sistema de Gestão de Igreja

## Visão Geral

Sistema completo de gestão eclesiástica desenvolvido para igrejas, oferecendo controle de membros, finanças, cultos, ensino, comunicação e muito mais. A partir de janeiro de 2026, o sistema implementou **arquitetura multi-tenant** com isolamento completo por igreja e suporte a filiais.

---

## 0. Multi-tenancy e Super Admin

### 0.1 Arquitetura Multi-tenant

- **Isolamento por igreja**: Todas as entidades principais têm coluna `igreja_id` para garantir separação de dados entre igrejas
- **Filiais**: Sistema hierárquico com `filiais` vinculadas a uma `igreja_id` pai, permitindo gestão de múltiplas congregações
- **RLS Policies**: Políticas de Row Level Security aplicadas em ~30 tabelas para garantir acesso seguro por contexto de igreja
- **Hooks de contexto**: `useIgrejaId` e `useFilialId` fornecem contexto automático para todas as queries

### 0.2 Super Admin Portal

O Super Admin Portal é um subsistema separado para gestão SaaS de múltiplas igrejas.

#### Layout e Navegação

- **Layout Dedicado**: `SuperAdminLayout` com header próprio e navegação horizontal
- **Navegação**: Dashboard | Igrejas | Métricas | Billing | Configurações
- **Rota Base**: `/superadmin/*` (acesso restrito a role `super_admin` via `user_roles`)
- **Proteção**: `SuperAdminGate` verifica role antes de renderizar

#### Tela de Seleção de Contexto

- **Rota**: `/context-select` (apenas para super admins após login)
- **Opções**:
  - **Painel SaaS** → navega para `/superadmin`
  - **Aplicativo Igreja** → navega para `/`
- **Preferência**: Checkbox "Lembrar minha escolha" salva em `localStorage`
- **Fluxo**: Login → verifica `super_admin` → verifica `preferred_context` → redireciona ou exibe seleção

#### Gestão de Igrejas

- **Rota**: `/superadmin/igrejas`
- **Funcionalidades**:
  - Listar todas as igrejas cadastradas no sistema
  - Buscar por nome
  - Alterar status (ativo/inativo/suspenso)
  - Expandir row para ver/gerenciar filiais
- **Componente Reutilizável**: `FilialManager` para CRUD de filiais (usado também em Configurações)

#### Métricas por Tenant

- **Rota**: `/superadmin/metricas`
- **Funcionalidades**:
  - Selecionar igreja via dropdown
  - Visualizar KPIs: membros, eventos, check-ins, movimentação financeira
  - Botão para recalcular métricas via RPC

#### Troca de Contexto

- **Do Portal SaaS**: Botão "Ir para App Igreja" no header
- **Do App Normal**: Ícone Shield no header (visível apenas para super admins via `SuperAdminIndicator`)

#### Componentes

| Componente            | Descrição                                        |
| --------------------- | ------------------------------------------------ |
| `SuperAdminLayout`    | Layout com header e navegação do portal SaaS     |
| `SuperAdminGate`      | Gate de proteção que verifica role `super_admin` |
| `ContextSelect`       | Tela de seleção de contexto pós-login            |
| `SuperAdminIndicator` | Ícone Shield no MainLayout para acesso rápido    |
| `FilialManager`       | CRUD reutilizável de filiais                     |
| `IgrejaRowExpandable` | Row expansível com detalhes da igreja            |

#### Hooks e Utilitários

- `useSuperAdmin` - queries de igrejas, filiais, métricas, onboarding
- `checkIsSuperAdmin(userId)` - verifica role super_admin
- `getPreferredContext()` / `clearPreferredContext()` - gerencia preferência de contexto

#### Diagramas

- [Fluxo Super Admin](diagramas/fluxo-superadmin.md)
- [Sequência Super Admin](diagramas/sequencia-superadmin.md)

### 0.3 Onboarding Público de Igrejas

- **Rota**: `/cadastro/nova-igreja` (público, sem autenticação)
- **Formulário**: Nome, CNPJ, email, telefone, responsável, cidade, estado, observações
- **Fluxo**: Submissão cria registro em `onboarding_requests` com status `pendente` → Super Admin aprova → Igreja + Admin criados
- **Status**: `pendente`, `aprovado`, `rejeitado`

### 0.4 Tabelas e Schema

- **`igrejas`**: Cadastro central com nome, CNPJ, responsável, contatos, status
- **`filiais`**: Vinculadas via `igreja_id`, com nome, endereço, pastor responsável
- **`onboarding_requests`**: Solicitações de cadastro com aprovação/rejeição
- **Colunas `igreja_id`**: Adicionadas a `profiles`, `eventos`, `financeiro_transacoes`, `pedidos_oracao`, `jornadas`, `webhooks` e outras ~25 tabelas

---

## 1. Gestão de Pessoas

### 1.1 Cadastro Unificado

- **Visitantes**: Registro de pessoas que visitam a igreja pela primeira vez
- **Frequentadores**: Pessoas que frequentam regularmente mas não são membros
- **Membros**: Membros oficiais da igreja com acesso completo ao sistema

### 1.2 Progressão de Status

- Sistema de progressão: Visitante → Frequentador → Membro
- Histórico de mudanças registrado automaticamente no campo de observações
- Data de cadastro como membro registrada automaticamente

### 1.3 Perfil Completo

- **Dados Pessoais**: Nome, data de nascimento, estado civil, necessidades especiais
- **Contatos**: Email, telefone, endereço, CEP
- **Dados Eclesiásticos**: Funções na igreja, status, data de batismo, data de casamento
- **Informações Adicionais**: Escolaridade, profissão, motivo de entrada, observações

### 1.4 Relacionamentos Familiares

- Cadastro de familiares vinculados
- Tipos de parentesco (cônjuge, filho, pai, mãe, etc.)
- Gestão de família unificada via `familia_id`

### 1.5 Funções na Igreja

- Cadastro de funções (Pastor, Diácono, Presbítero, etc.)
- Atribuição de múltiplas funções por membro
- Histórico de funções com data de início e fim

### 1.6 Aniversariantes

- Dashboard de aniversários (nascimento, casamento, batismo)
- Filtros por tipo e período
- Calendário visual
- Seções "Esta Semana" e "Este Mês" são colapsáveis individualmente (botão com ícone de chevron), permitindo recolher listas grandes sem perder os contadores (`Badge`)

### 1.7 Módulo Pessoas / Membros

- **Objetivo**: Centralizar o cadastro unificado de visitantes, frequentadores e membros, permitindo listar, buscar/filtrar e manter dados completos de perfil e status.
- **Funcionalidades principais**: listar (ordenado por nome via `profiles`), buscar/filtrar por nome/telefone/email/status, criar pessoa via wizard multi-etapas, editar pessoa (dados pessoais, contatos, eclesiásticos, adicionais, status), exportar listagens e navegar para detalhes.
- **Campos/atributos (profiles)**: `id`, `nome`, `email`, `telefone`, `avatar_url`, `status` (`visitante` | `frequentador` | `membro`), `data_primeira_visita`, `numero_visitas`, `user_id`, `sexo`, `data_nascimento`, `estado_civil`, `data_casamento`, `rg`, `cpf`, `alergias`, `necessidades_especiais`, `cep`, `cidade`, `bairro`, `estado`, `endereco`, `entrou_por`, `data_entrada`, `status_igreja`, `data_conversao`, `batizado`, `data_batismo`, `e_lider`, `e_pastor`, `escolaridade`, `profissao`, `nacionalidade`, `naturalidade`, `entrevistado_por`, `cadastrado_por`, `tipo_sanguineo`, `observacoes`.
- **Regras de negócio**: status permitido limitado a `visitante`/`frequentador`/`membro`; filtros locais por nome/telefone/email/status na listagem; criação/edição persiste em `profiles` via Supabase; verificação automática de duplicata por telefone/email (o sistema bloqueia o cadastro se já existir).
- **Links**: [Manual do Usuário — Pessoas](manual-usuario.md#3-gestão-de-pessoas) · [Fluxo Pessoas (Mermaid)](diagramas/fluxo-pessoas.md) · [Sequência Pessoas (Mermaid)](diagramas/sequencia-pessoas.md) · [Permissões Pessoas](diagramas/permissoes-pessoas.md)
- **Referências complementares**: [BIDIRECTIONAL_RELATIONSHIPS.md](BIDIRECTIONAL_RELATIONSHIPS.md) (exibição bidirecional de familiares), [AUTHORIZED_GUARDIANS.md](AUTHORIZED_GUARDIANS.md) (responsáveis autorizados para crianças/Kids) e [KIDS_INCLUSION.md](KIDS_INCLUSION.md) (campo de necessidades especiais na jornada Kids ligado aos perfis).

#### PessoaWizard — Cadastro Interno (/pessoas/cadastrar)

Substituiu o modal monolítico `CadastrarPessoaDialog` por uma **página wizard multi-etapas** (`/pessoas/cadastrar`), protegida por `AuthGate`.

- **Rota**: `/pessoas/cadastrar` (requer autenticação)
- **Componente principal**: `src/components/pessoas/PessoaWizard.tsx`
- **Fluxo por tipo**:
  - **Visitante / Frequentador**: 4 etapas — Selecionar tipo → Dados básicos → Complementar → Checkboxes
  - **Membro**: 5 etapas — Selecionar tipo → Dados básicos → Dados do membro → Complementar → Checkboxes
- **Etapas detalhadas**:
  - `StepTipo`: seleção do tipo (Visitante / Frequentador / Membro) via cards
  - `StepDadosBasicos`: nome (obrigatório), telefone (máscara), email (validado por formato `usuario@dominio`), sexo
  - `StepDadosMembro` (apenas Membro): CPF (máscara), RG, estado civil, profissão, endereço completo com autocomplete por CEP
  - `StepComplementar`: data de aniversário (dia/mês/ano), como conheceu, observações
  - `StepCheckboxes`: aceitou Jesus, batizado, deseja contato, recebeu brinde (visitante)
- **Ações ao concluir**: verifica duplicata telefone/email, faz `INSERT profiles` (define `data_conversao` automaticamente quando `aceitou_jesus=true`, alimentando o painel "Aceitaram Jesus"), cria `visitante_contatos` agendado para +3 dias se `deseja_contato=true`, redireciona para `/pessoas`
- **Cadastro público** (`/cadastro/visitante`, `/cadastro/cafe-vp`, recepção): a edge function `cadastro-publico` aplica a mesma regra — define `data_conversao` quando `aceitou_jesus=true` (se ainda não houver data registrada) e, quando `deseja_contato=true`, agenda um `visitante_contatos` para +3 dias. Como o cadastro é público/anônimo, `membro_responsavel_id` fica `null` (sem responsável definido); a atribuição a um líder/departamento responsável é uma rotina de roteamento futura, ainda não implementada. A coluna `membro_responsavel_id` é opcional (`NULL` permitido) desde a migração `20260610160000`.
- **Barra de progresso**: componente `Progress` do Shadcn atualizado por etapa

#### Módulo Pessoas / Membros — visão funcional

- **Funcionalidades disponíveis**: dashboard com estatísticas por status; busca rápida por nome/email/telefone; listagem com ordenação por nome e avatars (quando cadastrados); criação via wizard (rota dedicada); edição de perfis completos; evolução de status visitante → frequentador → membro; visualização de vínculos familiares bidirecionais; atribuição de funções ministeriais; exportação da listagem; painel de alterações pendentes; lista das últimas conversões (aceitaram Jesus).
- **Ações permitidas**: criar pessoa (nome obrigatório, contato recomendado), editar dados pessoais/contatos/status/funções, navegar para detalhes, aplicar busca/filtros, carregar mais itens via scroll, acionar atalhos rápidos para segmentos e contatos agendados, revisar alterações pendentes e acessar lista de conversões recentes.
- **Regras funcionais**: status restrito a `visitante`/`frequentador`/`membro`; verificação manual de duplicidade (nome/telefone/email) antes de salvar; campos mínimos exigem nome; contatos incompletos reduzem eficácia de busca e follow-up; ao editar contatos, os dados são sanitizados antes de persistir e novos contatos podem gerar enfileiramento em `chatbot_queue`; vínculos familiares exibem ambos os lados com inversão de papel; avatars não são obrigatórios e podem exibir fallback.
- **Links relacionados**: [Manual do Usuário — Pessoas](manual-usuario.md#3-gestão-de-pessoas) · [Produto — Pessoas/Membros](produto/README_PRODUTO.MD#pessoas--membros-visão-de-produto)

#### Check-in com OTP via WhatsApp

O check-in de eventos usa verificação de identidade por código OTP enviado via WhatsApp (WhatsApp Cloud API / Meta).

- **Rota**: `/checkin/:tipo/:id` (público, sem autenticação)
- **Componente**: `src/pages/Checkin.tsx`
- **Fluxo**:
  1. Participante escaneia QR Code do evento e digita seu telefone
  2. Edge function `send-otp` envia código de 6 dígitos via WhatsApp (hash SHA-256 armazenado, rate-limited)
  3. Participante digita o código recebido; edge function `verify-otp` valida (máx. 5 tentativas)
  4. Edge function `checkin-evento` registra a presença vinculando o `profile_id`
  5. Tela de sucesso exibe nome mascarado (ex: "Adriano O.") para privacidade
  6. Se telefone não encontrado: redireciona para `/cadastro/visitante?telefone=...`
- **Reenvio**: botão disponível após contador regressivo de 60 segundos
- **Segurança**: nome completo nunca exibido na tela de check-in público

#### Cadastro Público de Visitante (/cadastro/visitante)

Formulário público (sem autenticação) convertido para wizard de 3 etapas, acessível via QR Code ou link direto.

- **Rota**: `/cadastro/visitante` (público)
- **Etapa 1**: Nome completo (obrigatório), sexo, aniversário (dia/mês)
- **Etapa 2**: Telefone WhatsApp (máscara, pré-preenchido se veio do check-in), email
- **Etapa 3**: Como conheceu a igreja, necessidades especiais, observações, checkboxes (aceitou Jesus, deseja contato)
- **Submissão**: chama edge function `cadastro-publico` com `action: "cadastrar_visitante"`
- **Tela de sucesso**: exibida após submissão bem-sucedida; o botão "Voltar para o início" recarrega o próprio caminho (`window.location.pathname + window.location.search`), reiniciando o wizard no passo 1 mantendo os parâmetros de URL (ex.: `aceitou=true`, `igreja_id`, `filial_id`).
- **Parâmetros de URL**: `igreja_id`, `filial_id`, `todas_filiais`, `telefone` (pré-preenchimento), `aceitou=true` (muda título/ícone da etapa 1, exibe a caixa "Que alegria saber que você aceitou Jesus! 🎉" e marca/bloqueia o checkbox "Aceitei Jesus hoje" na etapa 3 — não pode ser desmarcado)
- **Layout público**: páginas `/cadastro`, `/cadastro/visitante`, `/cadastro/membro` e `/cadastro/cafe-vp` usam um cabeçalho minimalista (logo + nome da igreja), sem `PublicHeader`/botões "Instalar"/"Entrar", já que são acessadas externamente sem necessidade de navegação para o app autenticado.
- **Contatos Agendados** (`/pessoas/contatos`): a tela lista registros de `visitante_contatos`; contatos criados pelo cadastro público têm `membro_responsavel_id = null` (sem responsável definido) — a UI exibe "Sem responsável definido" nesses casos em vez de lançar erro de leitura de propriedade nula.
- **Validação de tenant**: `igreja_id`/`filial_id` vêm na URL (necessário para roteamento multi-tenant em um link público) — a edge function `cadastro-publico` valida (`validarIgrejaFilial`) que `igreja_id` existe em `igrejas` e, se informado, que `filial_id` pertence a essa igreja, retornando 400 ("Link inválido") caso contrário. Aplica-se às ações `cadastrar_visitante`, `buscar_membro`, `cadastrar_cafe_vp` e `atualizar_membro`.

#### Links Externos de Cadastro (Shortlinks)

Card `LinksExternosCard` (`src/components/pessoas/LinksExternosCard.tsx`), exibido na tela Pessoas para staff com filial selecionada.

- **4 links disponíveis**: Visitante (`/cadastro/visitante`), Aceitou Jesus (`/cadastro/visitante?aceitou=true` — abre direto o formulário de visitante, com a saudação de aceite e o checkbox "Aceitei Jesus hoje" pré-marcado e bloqueado, sem passar pela tela `/cadastro` com os botões de Visitante/Café V&P), Membros (`/cadastro/membro`), Café V&P (`/cadastro/cafe-vp`)
- **Shortlinks reais**: ao montar, o card consulta a tabela `short_links` por `igreja_id` + URL alvo (com `igreja_id`/`filial_id`/`todas_filiais` embutidos); se não existir, cria um registro com `slug` aleatório (7 caracteres) e `created_by` o usuário logado
- **URL final**: `{origin}/s/:slug`, resolvida pela página pública `src/pages/ShortLinkRedirect.tsx`, que busca `target_url` em `short_links` (acesso `anon`) e redireciona via `window.location.replace`
- **Layout**: 4 cards compactos em uma única linha (grid 2x2 em mobile, 4 colunas em telas maiores), cada um com título, botão de copiar e botão de QR Code
- **Migration**: `20260609150000_fix_short_links_anon_select.sql` restaura `SELECT` público (`anon`) em `short_links`, necessário para o redirect funcionar sem autenticação

---

## 1.8 Hub de Eventos e Voluntariado

### Objetivo

Sistema unificado para agendamento e gestão de **qualquer tipo de evento da igreja**, não apenas cultos. Suporta escalação de voluntários, liturgia, check-in e recursos audiovisuais para múltiplos formatos de atividades.

### Tipos de Eventos Suportados

- **CULTO**: Cultos dominicais, especiais, celebrações (com liturgia e músicas)
- **RELOGIO**: Relógios de Oração 24h com turnos de intercessão
- **TAREFA**: Atividades operacionais e projetos com checklist
- **EVENTO**: Eventos gerais (conferências, retiros, workshops)
- **OUTRO**: Categoria flexível para casos não cobertos

### Subtipos/Categorização

- Cada tipo pode ter **subtipos personalizados** (ex: "Culto de Celebração", "Vigília 24h", "Reunião de Conselho")
- Configurados via tabela `evento_subtipos` com cores e ícones próprios
- 14 subtipos pré-cadastrados na migração inicial

### Funcionalidades Principais

- **Criação de eventos**: Formulário com seleção de tipo/subtipo, data/hora, local, duração, tema, pregador
- **Tabs condicionais**: Interface adapta-se ao tipo do evento
  - CULTO: tabs de Liturgia, Músicas, Escalas, Check-in
  - RELOGIO: tabs de Turnos 24h, Escalas, Check-in
  - TAREFA: tabs de Checklist, Escalas
  - EVENTO: tabs de Visão Geral, Escalas, Check-in
- **Escalas unificadas**: Sistema de voluntariado funciona para todos os tipos
- **Check-in**: QR Code de presença disponível para qualquer evento
- **Templates**: Modelos reutilizáveis de liturgia aplicáveis a novos cultos

### Recursos Técnicos

- **Polimorfismo por enum**: Coluna `tipo` (evento_tipo) + tabela `evento_subtipos`
- **Consultas polimórficas**: Queries adaptam-se ao tipo via `.eq("tipo", ...)`
- **RLS policies**: Controle de acesso por feature flags (ex: apenas beta users criam tipos não-CULTO)

### Gestão de Times e Escalas

- **Times**: Equipes organizadas por categoria (Louvor, Mídia, Intercessão, etc.)
- **Posições**: Cargos dentro de cada time (Vocalista, Operador de Som, etc.)
- **Escalação**: Vinculação pessoa + time + posição + evento com confirmação de presença
- **Notificações**: Sistema de avisos automáticos via edge functions

### Funcionalidades do Relógio de Oração (tipo RELOGIO)

#### Player de Oração Imersivo

- **Exibição Full-Screen**: Interface escura (fundo preto) otimizada para projetores e imersão
- **Slides Dinâmicos**: 8 tipos de conteúdo renderizados condicionalmente:
  - `VERSICULO`: Citação bíblica com ícone BookOpen (amber)
  - `VIDEO`: Embed YouTube com fallback
  - `AVISO`: Título + texto descritivo
  - `TIMER`: Contagem de tempo visual (para momentos de silêncio/oração)
  - `PEDIDOS`: Lista de pedidos de oração com botão "Orei" (Heart → ThumbsUp) + persistência no banco
  - `CUSTOM_TESTEMUNHO`: Cards com citações estilizadas (Quote icon, gradiente amber-orange)
  - `CUSTOM_SENTIMENTO`: Alerta espiritual (AlertCircle icon, gradiente red-pink)
  - `CUSTOM_VISITANTES`: Componente visual com avatars circulares, badges de "Primeira Visita"
- **Edge Function `playlist-oracao`**: Orquestra montagem de slides agregando:
  - Sentimentos (24h) com análise automática de padrões críticos
  - Testemunhos públicos (últimos 3)
  - Visitantes recentes (7 dias)
  - Pedidos broadcast (prioritários para toda a igreja)
  - Pedidos pessoais (intercessão individual)
- **Marcação de Orações**: Intercessor clica "Orei" em pedidos → status persiste em `pedidos_oracao` como `em_oracao` com timestamp
- **Carregamento de Histórico**: Ao abrir Player, carrega quais pedidos o usuário já marcou como orados
- **Controls Intuitivos**: Navegação com chevrons (< >), progress bar segmentada no topo, timer do turno em andamento

#### Timeline Visual de Turnos (24h)

- **Grid Horário**: Layout de 24 horas (cada linha = 1 hora) com cards de voluntários
- **DatePicker**: Navega entre dias do RELOGIO (ex: vigor 24h = 7 dias)
- **Color Coding**:
  - Verde: Voluntário confirmado
  - Amarelo: Pendente de confirmação
  - Cinza: Slot vazio
  - Azul: Hora atual destacada
- **Ações por Slot**: Menu dropdown (⋮) com opções:
  - Editar: Abre dialog para mudar voluntário/horário
  - Duplicar para Amanhã: Copia slot para o dia seguinte
  - Remover: Delete do slot
- **Integração com Player**: Botão de acesso rápido no Centro de Operações (`/dashboard`) mostra "Relógio Ativo Agora" com link direto para Player do turno em andamento

#### Escalas com Recorrência (None/Daily/Weekly/Custom)

- **AdicionarVoluntarioSheet**: Interface em sheet (drawer mobile) com seções:
  - Busca de Voluntário: Combobox com autocomplete de nomes em tempo real
  - Horário: Seleção de início e fim (defaults do slot clicado)
  - Recorrência: 4 opções:
    - **None**: Apenas a data selecionada
    - **Daily**: Repete todos os dias até fim do evento
    - **Weekly**: Repete mesmo dia da semana (intervalo de 7 dias)
    - **Custom**: Checkboxes por dia da semana (Seg/Ter/Qua/Qui/Sex/Sab/Dom)
  - Preview: Card azul mostrando `"X escalas serão criadas em: [datas]"`
  - Detecção de Conflitos: Aviso se voluntário já tem escalas nas datas (lista conflitos)
- **Batch Insert**: Cria todas as escalas de uma vez (ex: 14 para Daily em 14 dias)
- **Feedback**: Toast com "14 turnos criados para João Silva"

#### Gestão de Convites (Eventos em geral)

- **ConvitesPendentesWidget**: Widget no Dashboard/DashboardLeader mostrando:
  - Convites pendentes de aceitação
  - Evento associado e data
  - Ações rápidas (Aceitar/Recusar)
- **Tab Convites**: Nova aba em EventoDetalhes (apenas para tipo EVENTO) com:
  - Lista de pessoas convidadas (nome, email, status: pendente/aceito/recusado)
  - Seleção múltipla para enviar convites em massa
  - Template customizável para mensagem de convite
  - Rastreamento de quem aceitou/recusou

#### Gestão de Inscrições (Eventos em geral)

- **Tab Inscrições**: `InscricoesTabContent` em EventoDetalhes exibe:
  - Tabela de inscritos com pessoa (nome, avatar, email, telefone)
  - Status de pagamento (Pendente, Pago, Isento, Cancelado) com badges coloridos
  - Data de inscrição formatada (ex: "15 de Jan, 2025")
  - Busca em tempo real por nome
  - Estatísticas no header: Total inscritos, Pendentes, Pagos, Cancelados (cards coloridos)
  - Ações por inscrito: Confirmar pagamento, Isentar, Cancelar, Remover
- **Dialog Adicionar Inscrição**: `AdicionarInscricaoDialog` permite admin:
  - Combobox de busca de pessoas (nome + avatar)
  - Seleção de status inicial (Pendente/Pago/Isento/Cancelado)
  - Validação de duplicatas (bloqueia se pessoa já inscrita)
  - Criação automática de transação financeira se `evento.requer_pagamento = true` (entrada na categoria/conta do evento)
- **Integração com Financeiro**:
  - Confirmar pagamento → `status_pagamento: pago` + marca transação vinculada como concluída
  - Isentar → `status_pagamento: isento` + cancela transação se houver
  - Cancelar → `status_pagamento: cancelado` + cancela transação pendente
  - Campos em eventos: `requer_pagamento` (bool), `valor_inscricao` (numeric), `categoria_financeira_id`, `conta_financeira_id`, `vagas_limite` (numeric)
- **Componentes**: `InscricoesTabContent.tsx` (+387 linhas), `AdicionarInscricaoDialog.tsx` (+277 linhas)

#### Tabs Condicionais por Tipo de Evento

- **Tabs Condicionais**:
  - **CULTO**: Liturgia, Músicas, Escalas, Check-in
  - **RELOGIO**: Timeline (Turnos), Escalas, Check-in
  - **TAREFA**: Checklist, Escalas
  - **EVENTO**: Visão Geral, Convites, Inscrições, Escalas, Check-in
- **Navegação Direta**: Parâmetro `?tab=liturgia` abre aba específica diretamente

### Portal de Voluntariado

#### Tela Pública de Inscrição

- **Rota**: `/voluntariado` (pública, sem necessidade de autenticação)
- **Componente**: `Voluntariado.tsx` (+257 linhas)
- **Formulário**:
  - Seleção de ministério: 7 opções (Recepção, Louvor, Mídia, Kids, Intercessão, Ação Social, Eventos)
  - Disponibilidade: 5 opções (Domingos manhã, Domingos noite, Durante a semana, Eventos pontuais, Flexível)
  - Experiência: 3 níveis (Nenhuma experiência, Já servi antes, Sirvo atualmente)
  - Campos: Contato (telefone/email) e Observações (textarea opcional)
  - Validação: Campos obrigatórios (área, disponibilidade, experiência)
- **Acesso**: Link na `Sidebar` para membros e admins; pode ser compartilhado publicamente via URL

#### Sistema de Triagem Automática

- **Biblioteca de Triagem**: `src/lib/voluntariado/triagem.ts` (+118 linhas)
  - Função `avaliarTriagemVoluntario(perfilStatus, ministerio)` retorna status `aprovado` ou `em_trilha`
  - 5 regras de ministério pré-definidas:
    - **Kids**: Requer ser membro → Trilha Kids
    - **Louvor**: Requer ser membro → Trilha de Louvor
    - **Mídia**: Requer ser membro → Trilha de Mídia
    - **Intercessão**: Não requer ser membro → Trilha de Intercessão
    - **Recepção**: Não requer ser membro → Trilha de Recepção
  - Fallback: Não-membros → **Trilha de Integração** (obrigatória antes de servir)
  - Normalização de texto (remove acentos) para matching flexível de nomes de ministério

- **Integração em GerenciarTimeDialog**:
  - Carrega perfil da pessoa (`profiles.tipo`) e ministério (`ministerios.nome` + `categoria`)
  - Chama `avaliarTriagemVoluntario()` ao adicionar membro
  - Exibe badge:
    - Verde "Aprovado" → Apto para escalar
    - Amarelo "Requer Trilha" → Tooltip com nome da trilha e requisitos não atendidos
  - Verifica inscrição em jornadas (trilhas) via `inscricoes_jornada`:
    - Busca jornada por título (ex: "Trilha Kids")
    - Mostra status de conclusão (`concluido: true/false`)
    - Lista pendências (etapas não concluídas)
  - Track de progresso: Contagem de etapas concluídas vs total

- **Trilhas Mapeadas**: 6 trilhas identificadas:
  1. Trilha de Integração (para não-membros)
  2. Trilha Kids
  3. Trilha de Louvor
  4. Trilha de Mídia
  5. Trilha de Intercessão
  6. Trilha de Recepção

- **Componentes**: `GerenciarTimeDialog.tsx` (+120 linhas de triagem), `triagem.ts` (biblioteca completa)

### Links

- **ADRs**: [ADR-017 (Hub de Eventos)](adr/ADR-017-refatoracao-hub-eventos-voluntariado.md), [ADR-018 (Migração)](adr/ADR-018-estrategia-migracao-cultos-eventos.md)
- **Manual**: [Relógio de Oração](manual-usuario.md#relógio-de-oração) _(a confirmar)_, [Escalas com Recorrência](manual-usuario.md#escalas-com-recorrência) _(a confirmar)_
- **Migrations**: `20251230000000_add_blocos_inteligentes.sql` (tipos de conteúdo)
- **Edge Functions**: `playlist-oracao` (agregação de conteúdo inteligente)

---

## Módulo Kids

### Visão de funcionalidades

- **Gestão de crianças e turmas**: diretório de crianças com busca/filtragem e visão de salas/turmas do ministério Kids (cadastro/edição direto no diretório está **a confirmar** conforme disponibilidade da tela).
- **Presença e diário**: registro de check-in/checkout nas atividades e anotações de diário (humor, saúde, observações). Resumo conceitual em `docs/KIDS_INCLUSION.md`.
- **Etiquetas e segurança**: uso das informações de perfil para etiquetas de segurança e conferência na retirada.
- **Ocupação por sala**: visão de lotação em tempo real das salas Kids.

### Regras de autorização de responsáveis

- **Quem pode retirar**: apenas responsáveis autorizados (guardians) configurados previamente podem realizar o checkout de uma criança.
- **Como configurar**: seleção de pessoa autorizada e, quando aplicável, indicação das crianças específicas. Fluxos e cenários em `docs/AUTHORIZED_GUARDIANS.md`.
- **Escopo**: autorização é vinculada ao contexto familiar e às crianças selecionadas; alterações devem ser registradas antes do evento.

### Regras de notificações

- **Eventos que disparam**: checkout concluído, registros de diário/observações e alertas comportamentais/assiduidade.
- **Para quem e quando**: direcionamento conforme perfil (equipe do Kids, responsáveis, liderança) e momento do evento. Resumo operacional em `docs/NOTIFICACOES_KIDS.md`.

### Referências

- Manual (seção Kids): [docs/manual-usuario.md](manual-usuario.md#kids)
- Produto (seção Kids): [docs/produto/README_PRODUTO.MD](produto/README_PRODUTO.MD#kids-visão-de-produto)
- Regras e fluxos Kids: [KIDS_INCLUSION.md](KIDS_INCLUSION.md) · [AUTHORIZED_GUARDIANS.md](AUTHORIZED_GUARDIANS.md) · [NOTIFICACOES_KIDS.md](NOTIFICACOES_KIDS.md)

## 2. Módulo Financeiro

### Objetivo do Módulo

Prover controle financeiro completo e transparente para igrejas, separando claramente os conceitos de **Fato Gerador**, **Fluxo de Caixa** e **DRE** para garantir relatórios contábeis precisos e rastreabilidade fiscal. O sistema permite gestão de receitas, despesas, reembolsos e relatórios gerenciais sem perder a integridade contábil.

### 2.1 Telas de Manutenção (Refatoradas em Dez/2024)

As telas de manutenção financeira foram modernizadas com layout tabular consistente:

- **Bases Ministeriais** (`BasesMinisteriais.tsx`): Gestão de grandes áreas de atuação com busca e edição rápida
- **Categorias Financeiras** (`Categorias.tsx`): Plano de contas com árvore expansível de categorias e subcategorias, separadas por entrada/saída
- **Centros de Custo** (`CentrosCusto.tsx`): Unidades orçamentárias com código opcional
- **Formas de Pagamento** (`FormasPagamento.tsx`): Meios de pagamento aceitos com ativação/desativação
- **Fornecedores** (`Fornecedores.tsx`): Cadastro de prestadores e parceiros com CNPJ/CPF e contatos
- **Contas Bancárias** (`ContasManutencao.tsx`): Gestão de contas bancárias e caixas físicos, com proteção contra exclusão de contas com movimentações

**Padrão de UX:** Todas as telas seguem modelo de card com tabela, busca integrada no header, botões de ação alinhados à direita e feedback visual para operações vazias.

### Conceitos Fundamentais

#### Fato Gerador (Competência)

- Representa **quando e por que** um valor foi originado (ex.: compra de material, evento, doação)
- Registrado independentemente do momento do pagamento/recebimento
- Vinculado a **categoria contábil**, **fornecedor**, **centro de custo** e **base ministerial**
- Pode ser decomposto em múltiplos itens (ex.: uma nota fiscal com vários produtos)
- Fonte de verdade para o DRE e análises gerenciais

#### Fluxo de Caixa (Regime de Caixa)

- Representa **quando e como** o dinheiro saiu ou entrou fisicamente
- Registra forma de pagamento, parcelamento, juros, multas, descontos
- Pode haver um fato gerador e múltiplos pagamentos (ex.: compra parcelada em 3x)
- Base para conciliação bancária e gestão de liquidez

#### DRE (Demonstrativo de Resultado do Exercício)

- Relatório contábil por competência que mostra resultado (receita - despesa) do período
- Calculado a partir dos **fatos geradores** (categorias), não do caixa
- Independente da forma de pagamento (parcelamento não altera a natureza do gasto)
- Agrupa receitas e despesas por seção DRE (Receitas Operacionais, Despesas Administrativas, etc.)

> **Importante**: Esta separação conceitual está documentada no [ADR-001](adr/ADR-001-separacao-fato-gerador-caixa-dre.md) e é a base de toda a arquitetura financeira do sistema.

---

### 2.1 Estrutura Contábil

- **Contas**: Bancárias, virtuais e físicas (caixa)
- **Bases Ministeriais**: Unidades de negócio/ministério para segmentação de custos
- **Centros de Custo**: Classificação de despesas por departamento/projeto
- **Categorias Financeiras**: Com seção DRE (Receitas/Despesas) e natureza contábil
- **Subcategorias**: Detalhamento de categorias para maior granularidade
- **Fornecedores**: Cadastro completo com CNPJ/CPF e dados bancários

### 2.2 Transações

- **Entradas**: Dízimos, ofertas, doações, outras receitas
- **Saídas**: Pagamentos, despesas operacionais, reembolsos
- **Status**: Pendente ou Pago/Recebido
- **Confirmação de Pagamento**: Registro de juros, multas, descontos, taxas
- **Vinculação**: Cada transação pode referenciar um ou mais fatos geradores

### 2.3 Relatório de Ofertas

- Workflow de duplo controle (lançador + conferente)
- Detalhamento por forma de pagamento
- Auditoria com aprovação independente
- Rastreabilidade completa de quem lançou, conferiu e aprovou

### 2.4 Dashboards e Relatórios

- **Dashboard Geral**: Visão consolidada de receitas e despesas
- **Dashboard de Ofertas**: Análise específica de ofertas por período
- **Projeção Financeira**: 12 meses histórico + 6 meses projetado
- **DRE**: Demonstrativo de Resultado do Exercício anual por competência
- **Insights**: Análises e tendências baseadas em histórico

### 2.5 Funcionalidades Avançadas

- **Importação Excel**: Importação em massa de transações com validação
- **Processamento de Notas Fiscais**: IA (Gemini) extrai dados de NF automaticamente
- **Reconciliação Bancária**: Comparação automática entre lançamentos e extrato bancário
- **Sistema de Aprendizado**: Auto-sugestão de categoria/fornecedor baseada em histórico
- **Exportação**: Excel com todos os dados filtrados e formatados

### 2.6 Formas de Pagamento

- Cadastro configurável (Dinheiro, PIX, Cartão, Transferência, Boleto, etc.)
- Vinculação em transações com rastreamento completo
- Suporte a parcelamento e juros

---

### Regras de Negócio

#### O que altera o DRE

- Lançamento de novos fatos geradores (receitas ou despesas)
- Reclassificação de categoria de um fato gerador
- Estorno de fato gerador (cancela o lançamento contábil)
- Ajustes de competência (mudança de mês/ano de referência)

#### O que altera o Caixa

- Registro de pagamento/recebimento efetivo
- Conciliação bancária (confirmação de entrada/saída)
- Ajustes de saldo manual (ex.: erro de lançamento)
- Juros, multas ou descontos aplicados no momento do pagamento

#### O que NÃO altera o DRE

- Forma de pagamento escolhida (à vista, parcelado, PIX, boleto)
- Data de pagamento diferente da data de competência
- Juros ou descontos aplicados no caixa (são tratados como ajustes de caixa, não de competência)

#### Reembolsos

- Fato gerador original permanece inalterado (ex.: líder comprou material)
- Transação de caixa registra o reembolso ao líder
- DRE reflete a categoria do material (não "Reembolso")
- Permite rastreamento de quem pagou e quando foi reembolsado

#### Estornos

- **Estorno de Fato Gerador**: Cancela o lançamento contábil e impacta DRE
- **Estorno de Caixa**: Reverte o pagamento/recebimento, impacta apenas o saldo da conta
- Ambos exigem justificativa e são registrados em log de auditoria

---

### Fluxo Completo (Exemplo Prático)

#### Cenário 1: Oferta Simples

1. Tesoureiro registra **fato gerador**: "Oferta Culto Domingo" (categoria: Receita Operacional)
2. Tesoureiro registra **transação de caixa**: Entrada de R$ 500 via PIX
3. Sistema vincula transação ao fato gerador automaticamente
4. DRE exibe R$ 500 em "Receita Operacional"
5. Caixa exibe R$ 500 em "Entradas do mês"

#### Cenário 2: Despesa com Parcelamento

1. Líder compra equipamento de R$ 3.000 parcelado em 3x sem juros
2. Sistema registra **fato gerador**: "Equipamento de Som" (categoria: Despesas Administrativas) - R$ 3.000
3. Tesoureiro registra **3 transações de caixa**: R$ 1.000 cada mês
4. **DRE do mês da compra**: Exibe R$ 3.000 em Despesas (competência)
5. **Fluxo de Caixa**: Exibe R$ 1.000 saindo por mês (regime de caixa)
6. Resultado: DRE reflete o impacto real da decisão; Caixa mostra o impacto financeiro mensal

---

### Referências e Links

- **Manual do Usuário (Financeiro)**: [docs/manual-usuario.md](manual-usuario.md) — Passo a passo para uso do módulo
- **Fluxo Visual (Mermaid)**: [docs/diagramas/fluxo-financeiro.md](diagramas/fluxo-financeiro.md) — Diagrama do fluxo completo
- **Sequência de Eventos**: [docs/diagramas/sequencia-financeira.md](diagramas/sequencia-financeira.md) — Ordem temporal das operações
- **Composição do DRE**: [docs/diagramas/dre.md](diagramas/dre.md) — Como o DRE é gerado
- **Decisão Arquitetural**: [docs/adr/ADR-001-separacao-fato-gerador-caixa-dre.md](adr/ADR-001-separacao-fato-gerador-caixa-dre.md) — Fundamento técnico da separação conceitual

---

---

## 3. Eventos e Liturgia

### 3.1 Gestão de Eventos

- Cadastro de eventos com tipo, data, local, tema
- Status: Planejado, Confirmado, Realizado, Cancelado
- Duração estimada e observações

### 3.2 Liturgia

- **Timeline Visual**: Sequência de itens da liturgia
- **Tipos de Itens**: Abertura, louvor, oração, pregação, avisos, encerramento
- **Responsáveis**: Membros ou convidados externos
- **Recursos de Mídia**: Vinculação de imagens/vídeos por item
- **Duração Individual**: Tempo estimado por item
- **Templates de Liturgia**: Salvar e aplicar modelos

### 3.3 Músicas

- Cadastro de canções com título, artista, tom, BPM
- Cifra e letra integradas
- Links para Spotify e YouTube
- Atribuição de ministro e solista

### 3.4 Escalas de Voluntários

- **Times**: Recepção, Mídia, Louvor, Kids, etc.
- **Posições**: Funções específicas por time
- **Membros**: Cadastro de voluntários por time
- **Escalação por Culto**: Atribuição de pessoas a posições
- **Confirmação**: Workflow de aceite/recusa pelos voluntários
- **Templates**: Escalas padrão para reutilização

### 3.5 Projeção (Telão)

- Página fullscreen para projeção (/telao/:cultoId)
- Playlist automática baseada na liturgia
- Controles por teclado (setas, F, P, B, C)
- Atualização em tempo real via Supabase Realtime
- Suporte a imagens e vídeos

#### Modos de Projeção (Evidências)

- **Modo Comunicados** — rota `/telao` (arquivo `src/pages/Telao.tsx`)
  - Fonte: tabela `comunicados` com filtros `ativo = true`, `exibir_telao = true`, janelas `data_inicio`/`data_fim`, `ordem_telao`
  - Controles: `→`/`Espaço` (próximo), `←` (anterior), `P` (pausa), `F` (tela cheia)
  - Suporte a imagens e vídeos (mp4/webm/mov)
- **Modo Liturgia** — rota `/telao-liturgia/:id` (arquivo `src/pages/TelaoLiturgia.tsx`)
  - Fonte: `eventos` → `liturgia_evento` (itens) → `liturgia_recursos` (recursos com `midias`)
  - Realtime: assina mudanças em `liturgia_culto` e `liturgia_recursos` (canal Supabase)
  - Controles: `→`/`Espaço` (próximo), `←` (anterior), `P` (pausa), `F` (tela cheia), `B` (tela preta), `C` (tela limpa)
  - Barra de progresso por recurso (quando `duracao_segundos > 0`)

#### Evidências no Repositório (Eventos)

- Páginas (src/pages/eventos/): `Geral.tsx`, `Eventos.tsx`, `Times.tsx`, `Posicoes.tsx`, `Categorias.tsx`, `Templates.tsx`, `LiturgiaDashboard.tsx`, `MidiasGeral.tsx`
- Página principal: `src/pages/EventoDetalhes.tsx` (detalhes com tabs: Escalas, Liturgia, Inscrições)
- Projeção: `src/pages/Telao.tsx`, `src/pages/TelaoLiturgia.tsx`
- Componentes: `src/components/eventos/` — dialogs e telas para liturgia, templates, escalas e mídias
  - Exemplos: `LiturgiaTimeline.tsx`, `LiturgiaWorkspace.tsx`, `LiturgiaDialog.tsx`, `LiturgiaItemDialog.tsx`, `EscalasTabContent.tsx`, `EscalasDialog.tsx`, `TimeDialog.tsx`, `PosicaoDialog.tsx`, `MidiaDialog.tsx`, `TemplatesLiturgiaDialog.tsx`, `SalvarComoTemplateDialog.tsx`

#### Tabelas/Entidades Referenciadas (Evidência de Código)

- `eventos`, `times_evento`, `escalas_evento`, `midias` (dashboard de `Geral.tsx`)
- `liturgia_evento`, `liturgia_recursos`, `midias` (playlist do `TelaoLiturgia.tsx`)
- `comunicados` (slideshow do `Telao.tsx`)

### Módulo Eventos

#### Evidências (código e rotas)

- Rota principal: `/eventos` (redireciona para `/eventos/geral`)
- `src/pages/eventos/Geral.tsx`: visão geral com métricas (próximos eventos, times ativos, membros escalados, realizados, mídias ativas) e cards para módulos; ações rápidas para criar evento e navegar.
- `src/pages/eventos/Eventos.tsx`: listagem completa de eventos/cultos com filtros (tipo, categoria, data).
- `src/pages/eventos/Times.tsx`: gestão de times/equipes com foco em voluntários e ministérios.
- `src/pages/eventos/Posicoes.tsx`: cadastro de posições/funções dentro de times.
- `src/pages/eventos/Categorias.tsx`: gestão de categorias de eventos.
- `src/pages/eventos/Templates.tsx`: templates reutilizáveis de liturgia aplicáveis a novos eventos.
- `src/pages/eventos/LiturgiaDashboard.tsx`: banco de músicas e gerenciamento de liturgia.
- `src/pages/cultos/MidiasGeral.tsx`: gestão/lista de mídias (detalhamento — (a confirmar)).
- `src/pages/Telao.tsx` (`/telao`): projeção fullscreen de comunicados (playlist com imagens/vídeos, filtros por período e ordem; controles de teclado).
- `src/pages/TelaoLiturgia.tsx` (`/telao-liturgia/:id`): projeção fullscreen da liturgia (playlist de recursos por item; controles de teclado; barra de progresso; atualiza via Supabase Realtime).

Componentes (src/components/cultos/):

- `LiturgiaTimeline.tsx`, `LiturgiaWorkspace.tsx`, `LiturgiaDialog.tsx`, `LiturgiaItemDialog.tsx`: componentes de liturgia (timeline/edição — (a confirmar funcionamento específico)).
- `RecursosLiturgiaSheet.tsx`, `MidiaDialog.tsx`, `TagMidiaDialog.tsx`, `SlideshowPreview.tsx`: componentes de recursos/mídias (vincular/visualizar — (a confirmar)).
- `TemplatesLiturgiaDialog.tsx`, `AplicarTemplateDialog.tsx`, `SalvarLiturgiaTemplateDialog.tsx`, `SalvarComoTemplateDialog.tsx`, `TemplatePreviewDialog.tsx`: componentes para templates de liturgia (aplicar/salvar/preview — (a confirmar)).
- `EscalasTabContent.tsx`, `EscalasDialog.tsx`: componentes para escalas de culto (alocação/visualização — (a confirmar)).
- `GerenciarTimeDialog.tsx`, `TimeDialog.tsx`: componentes para gestão de times (criar/editar — (a confirmar)).
- `PosicaoDialog.tsx`: componente para gestão de posições (criar/editar — (a confirmar)).
- `CancoesDialog.tsx`, `MusicaTabContent.tsx`: componentes relacionados a músicas do culto (gestão/lista — (a confirmar)).

Rotas relacionadas (evidência por navegação/código):

- `/cultos`, `/cultos/geral`, `/cultos/eventos`, `/cultos/times`, `/cultos/posicoes`, `/cultos/templates`, `/cultos/liturgia-dashboard`, `/cultos/midias`.
- Projeção: `/telao`, `/telao-liturgia/:id`.

Integrações Supabase (consultas confirmadas nos arquivos):

- `Geral.tsx`: `cultos` (status `planejado`/`confirmado` para futuros, `realizado` para contagem), `times_culto` (ativos), `escalas_culto` (por `culto_id`), `midias` (ativas).
- `Telao.tsx`: `comunicados` com filtros `ativo`, `exibir_telao`, janelas `data_inicio`/`data_fim`, ordenação `ordem_telao` e `created_at`.
- `TelaoLiturgia.tsx`: `cultos` (título/data), `liturgia_culto` (itens), `liturgia_recursos` (recursos com join `midias`); assinatura Realtime para atualizar playlist.

#### Funcionalidades confirmadas

- **Visão Geral**: métricas de cultos e atalhos de navegação para módulos (confirmado em `Geral.tsx`).
- **Ações rápidas**: navegar para novo culto/evento (`/cultos/eventos?novo=true`), times, dashboard liturgia e mídias (confirmado em `Geral.tsx`).
- **Projeção de **Comunicados\*\*: slideshow com auto-avance e controles (`→`, `←`, `P`, `F`), suportando imagens/vídeos e filtro por período/canal (confirmado em `Telao.tsx`).
- **Projeção (Liturgia)**: playlist linear dos recursos de liturgia com barra de progresso, controles (`→`, `←`, `P`, `F`, `B`, `C`) e atualização em tempo real (confirmado em `TelaoLiturgia.tsx`).
- **Templates/Liturgia/Times/Posições/Escalas/Músicas**: existência de componentes/díalogos específicos (fluxos detalhados — (a confirmar)).

#### Ações disponíveis (evidenciadas)

- Acessar **Geral** (redirect automático) e navegar para **Eventos**, **Times**, **Dashboard Liturgia**, **Mídias**.
- Criar novo culto/evento via ação rápida (navegação com `?novo=true`).
- Abrir projeção de **Comunicados** (`/telao`) e **Liturgia** (`/telao-liturgia/:id`) com atalhos de teclado.

#### Regras importantes

- Métricas em **Geral** filtram cultos futuros por `status ∈ {planejado, confirmado}` e contam realizados por `status = realizado` (confirmado).
- Projeção **Comunicados** respeita janela de exibição (`data_inicio`/`data_fim`), canal (`exibir_telao`) e ordenação (`ordem_telao`, `created_at`) (confirmado).
- Projeção **Liturgia** auto-avança por `duracao_segundos` e atualiza via Realtime ao editar liturgia/recursos (confirmado).
- Permissões/validações específicas de edição/criação não estão explícitas nos arquivos analisados — (a confirmar).

#### Links

- Manual do usuário — Cultos: `manual-usuario.md#5-cultos-e-liturgia`
- Fluxo (Mermaid): `diagramas/fluxo-cultos.md`
- Sequência (Mermaid): `diagramas/sequencia-cultos.md`

---

## 4. Gabinete Digital e Cuidado Pastoral

### Objetivo do Módulo

Centralizar o cuidado pastoral dos membros através de um sistema de tickets (atendimentos), permitindo que pastores e liderança acompanhem sistematicamente cada necessidade espiritual, pastoral ou de aconselhamento, com histórico completo e segurança de privacidade (view RLS protege dados sensíveis para secretaria).

### Visão Geral

- **Rota principal**: `/gabinete` (`GabinetePastoral.tsx`)
- **Destinatários**: Pastores, líderes, secretaria (com acesso restrito via RLS)
- **Integração**: Recebe tickets de múltiplas origens (chatbot WhatsApp, análise de sentimentos IA, pedidos de ajuda no app)
- **Estado**: Kanban interativo (Pendente → Em Acompanhamento → Agendado → Concluído)

### 4.1 Estrutura de Dados

#### Tabela: `atendimentos_pastorais`

- `id` (UUID): Identificador único do atendimento
- `pessoa_id` (FK → profiles) ou `visitante_id` (FK → visitantes_leads): Vinculação do atendido
- `origem` (ENUM): CHATBOT, SENTIMENTOS, APP_ORACAO, AGENDA, MANUAL
- `motivo_resumo` (TEXT): Resumo curto do motivo
- `conteudo_original` (TEXT): Relato completo (protegido por RLS, invisível para secretaria)
- `gravidade` (ENUM): BAIXA, MEDIA, ALTA, CRITICA (manual ou IA)
- `status` (ENUM): PENDENTE, EM_ACOMPANHAMENTO, AGENDADO, CONCLUIDO
- `data_agendamento` (TIMESTAMP) e `local_atendimento` (TEXT): Quando/onde acontecerá o encontro
- `observacoes_internas` (TEXT): Observação interna (ex: duração, slots)
- `historico_evolucao` (JSONB): Array de notas {timestamp, autor, mensagem, status_anterior, status_novo}
- `sessao_bot_id` (FK → atendimentos_bot): vínculo com a sessão do chatbot (quando origem = CHATBOT)
- `pastor_responsavel_id` (FK → profiles): Líder/Pastor atribuído
- `created_at`, `updated_at` (TIMESTAMP)

#### Tabela: `agenda_pastoral`

- `id` (UUID): Evento administrativo ou compromisso pastoral
- `pastor_id` (FK → profiles): Dono da agenda
- `titulo`, `descricao`, `tipo`: Identificação do compromisso (ex: culto, reunião, bloqueio)
- `data_inicio`, `data_fim`: Janela do compromisso
- `cor`: Cor opcional para exibição
- `criado_por`, `created_at`, `updated_at`

#### View: `view_agenda_secretaria`

- Exibe somente: `id`, `pessoa_id` (nome do membro), `status`, `pastor_responsavel_id`, `agendado_para`, `gravidade`
- **Oculta**: `conteudo_original` (protege segredo de confissão/aconselhamento)
- **Uso**: Secretaria pode agendar/operacionalizar sem ler dados sensíveis

### 4.2 Fluxo de Criação (Automático)

Atendimentos pastorais são criados automaticamente em 3 cenários:

1. **Via Chatbot (`chatbot-triagem` Edge Function)**
   - Membro ou visitante envia mensagem WhatsApp pedindo ajuda pastoral/encaminhamento
   - Se o telefone corresponde a múltiplos `profiles`, o bot escolhe o candidato mais antigo (data de nascimento > data de criação); se nenhum existir, cria/recupera `visitantes_leads`
   - Bot detecta intenção "SOLICITACAO_PASTORAL" ou conversa com índice de gravidade alto
   - Sistema cria `atendimentos_pastorais` com `origem = 'CHATBOT'`, `gravidade` conforme análise IA

2. **Via Análise de Sentimentos (`analise-sentimento-ia` Edge Function)**
   - Membro registra sentimento negativo (triste, ansioso, angustiado) 3+ dias consecutivos
   - IA detecta padrão crítico e marca `gravidade = CRITICA` ou `ALTA`
   - Sistema cria `atendimentos_pastorais` com `origem = 'SENTIMENTOS'`

3. **Via Pedido de Ajuda no App (a implementar)**
   - Membro clica em botão "Chamar Pastor" na interface
   - Sistema cria `atendimentos_pastorais` com `origem = 'APP_ORACAO'`, gravidade conforme seleção do membro

### 4.3 Roteamento Inteligente (Algoritmo)

Quando um atendimento é criado, o sistema determina `pastor_responsavel_id` automaticamente:

1. **Membro com Líder**: Se `membro.lider_id IS NOT NULL`, atende-o como responsável
2. **Sem Líder / Visitante**: Escala para "Pastor de Plantão" (ID configurável, gerenciar em `configuracoes_igreja.plantao_pastoral_id`)
3. **Fallback**: Se nem um nem outro existir, cria como PENDENTE e notifica Admin

### 4.4 Interface Kanban

**Visualização**: Drag-and-drop via `@dnd-kit`

- Coluna 1: PENDENTE (casos novos, aguardando alocação)
- Coluna 2: EM_ACOMPANHAMENTO (em atendimento ativo)
- Coluna 3: AGENDADO (com data e hora confirmadas)
- Coluna 4: CONCLUIDO (encerrados)

**Card de Atendimento**:

- Nome do membro, idade (a confirmar), gravidade (badge colorida: verde/amarelo/vermelho/crítico)
- Última interação (timestamp relativo, ex: "há 2 horas")
- Botões rápidos: Abrir Prontuário, Agendar, Encerrar

### 4.5 Prontuário (Drawer Detalhes)

Ao clicar no card, abre drawer com abas:

1. **Geral**
   - Nome, contacto, status na igreja, líder direto
   - Gravidade, origem do caso, histórico de criação
2. **Histórico de Conversa** (se origem = CHATBOT)
   - Exibe histórico completo da conversa `atendimentos_bot.historico_conversa` em timeline
3. **Notas de Evolução**
   - Array de `historico_evolucao` com timestamp, autor, mensagem
   - Botão "Adicionar Nota" para registrar progresso
4. **Agendamento**
   - Seletor de data/hora/modo (gabinete, visita, ligação, online); grava `data_agendamento` e `local_atendimento`
   - Sugere duração multi-slot (30min cada) e bloqueia conflitos considerando atendimentos existentes e `agenda_pastoral`
   - Integração com calendário pessoal do pastor (a confirmar)
5. **Análise IA**
   - Se disponível: `analise_ia_titulo`, `analise_ia_motivo`, `analise_ia_gravidade`, `analise_ia_resposta` (campos em `sentimentos_membros` ou JSON em `historico_evolucao`)

### 4.6 Notificações

**Alertas Imediatos** (Eventos que acionam notifications)

- Novo atendimento com `gravidade = CRITICA` → WhatsApp ao pastor responsável via Make
- Status muda para `EM_ACOMPANHAMENTO` → Confirmação in-app ao pastor

**Alertas Passivos** (Database Webhooks / Triggers, a implementar)

- INSERT em `atendimentos_pastorais` com `gravidade >= ALTA` dispara trigger que chama `disparar-alerta`

### 4.7 Permissões (RLS)

- **Pastor/Líder**: Vê seus próprios atendimentos (onde `pastor_responsavel_id = auth.uid()`); pode editar status, notas, agendamento
- **Secretaria**: Acesso via `view_agenda_secretaria` (sem ler `conteudo_original`); apenas agenda
- **Admin**: CRUD completo em `atendimentos_pastorais`
- **Membro**: Pode ver status do seu próprio atendimento (a confirmar via `view` específica)

### 4.8 KPIs (Dashboard Admin)

**Widget `GabinetePastoralWidget`** exibe:

- Total de pendentes
- Total em acompanhamento
- Total agendados
- Total concluídos (período: últimas 30 dias)
- Tendência visual (sparkline ou gráfico simples)

**Card no DashboardAdmin** redireciona para `/gabinete` ao clicar.

### 4.9 Referências e Links

- **ADR**: [`adr/ADR-014-gabinete-digital-e-roteamento-pastoral.md`](adr/ADR-014-gabinete-digital-e-roteamento-pastoral.md)
- **Tabela**: `atendimentos_pastorais`, `view_agenda_secretaria` (em `database-schema.sql`)
- **Edge Functions**: `analise-sentimento-ia`, `analise-pedido-ia`, `chatbot-triagem`
- **UI**: `src/pages/GabinetePastoral.tsx`, `src/components/gabinete/*`

---

## 5. Intercessão, Oração e Testemunhos

### Objetivo do Módulo

Centralizar gestão de pedidos de oração, intercessão organizada, registro de testemunhos e acompanhamento emocional dos membros, fortalecendo cuidado pastoral e resposta ágil a necessidades espirituais.

### Estrutura Geral

#### Páginas Principais (Rotas) — 3 Contextos

**📖 Contexto Pessoal (Membro)**

- `/intercessao/diario`: `DiarioDeOracao.tsx` — área privada do membro para gerenciar seus próprios pedidos de oração e testemunhos pessoais

**⚡ Contexto Ministério (Intercessor)**

- `/intercessao/sala-de-guerra`: `SalaDeGuerra.tsx` — área de trabalho dos intercessores para orar pelos pedidos da comunidade; visualização e ação em pedidos alocados

**🏛️ Contexto Admin (Liderança)**

- `/intercessao/equipes`: `GestaoEquipes.tsx` — gerenciamento de equipe de intercessores (cadastro, ativação, limites)
- `/intercessao/sentimentos`: `Sentimentos.tsx` — monitoramento de bem-estar emocional, alertas críticos e dashboard de sentimentos

**Hub Central**

- `/intercessao`: `Intercessao.tsx` — dashboard unificado com cards para Diário de Oração, Sala de Guerra, Gestão de Equipes e Sentimentos; exibe estatísticas gerais

### 5.1 Pedidos de Oração

- **Criação**: Membro/visitante/anônimo cria pedido via dialog, com tipo (saúde, família, financeiro, trabalho, espiritual, outro)
- **Fluxo de Status**: pendente → alocado → em_oracao → respondido/arquivado
- **Alocação**: Admin aloca a intercessor(es) manualmente ou via "Alocar Automático" (balanceado por carga)
- **Gerenciamento**: Intercessor registra observações, marca como "Em Oração" ou "Respondido"; admin pode reclassificar
- **Visualização Intercessor**: Vê apenas pedidos alocados (RLS aplicado)
- **Análise de IA (Dez/2025)**: Pedidos são analisados automaticamente via Edge Function `analise-pedido-ia` usando Lovable AI (Gemini 2.5 Flash):
  - `analise_ia_titulo`: Título sugerido resumindo a situação
  - `analise_ia_motivo`: Categoria raiz (Saúde, Financeiro, Luto, Relacionamento, Espiritual, Trabalho, Família, Outros)
  - `analise_ia_gravidade`: Classificação de urgência (baixa, media, critica)
  - `analise_ia_resposta`: Mensagem pastoral sugerida para acompanhamento
- **UI de Gravidade**: Badges coloridos (verde/amarelo/vermelho) com ícones na listagem para triagem visual rápida
- **Tabela**: `pedidos_oracao` com campos `id`, `pessoa_id`, `membro_id`, `intercessor_id`, `pedido`, `tipo`, `status`, `anonimo`, `data_criacao`, `data_alocacao`, `data_resposta`, `observacoes_intercessor`, `analise_ia_titulo`, `analise_ia_motivo`, `analise_ia_gravidade`, `analise_ia_resposta`
- **Operações Supabase**: INSERT (novo pedido), SELECT (listagem/filtros por status/tipo), UPDATE (alocar/mudar status/adicionar observação), DELETE (admin apenas)

### 4.2 Intercessores

- **Cadastro**: Admin cria intercessor com nome, email, telefone, `max_pedidos` (limite simultâneo)
- **Gerenciamento**: Ativar/inativar, editar dados, visualizar carga (count de pedidos alocados)
- **Alocação Automática**: Sistema distribui pedidos pendentes entre intercessores ativos respeitando limite
- **Tabela**: `intercessores` com campos `id`, `user_id`, `nome`, `email`, `telefone`, `ativo`, `max_pedidos`, `created_at`, `updated_at`
- **Operações Supabase**: INSERT, SELECT, UPDATE, DELETE (admin apenas)

### 4.3 Testemunhos

- **Criação**: Membro envia testemunho via dialog, com título, categoria, mensagem, opcional anônimo
- **Workflow de Aprovação**: Status aberto (submissão) → público (aprovado/publicado) ou arquivado
- **Publicação**: Testemunho com `status = publico` aparece no carrossel do dashboard para todos membros
- **Exportação**: Admin pode baixar listagem em Excel
- **Tabela**: `testemunhos` com campos `id`, `autor_id`, `pessoa_id`, `titulo`, `mensagem`, `categoria`, `status`, `anonimo`, `publicar`, `data_publicacao`, `nome_externo` (se anônimo), `created_at`, `updated_at`
- **Operações Supabase**: INSERT (novo), SELECT (listagem por status), UPDATE (aprovar/arquivar), DELETE (admin apenas)

### 4.4 Sentimentos

- **Registro**: Membro registra sentimento diário (feliz, triste, ansioso, grato, abençoado, angustiado) via dialog ou notificação automática (9h)
- **Redirecionamento Inteligente**: Sistema sugere ação baseada em sentimento
  - Positivo (feliz/grato/abençoado) → "Compartilhar Testemunho?" → link para `/intercessao/testemunhos?novo=true`
  - Negativo (triste/ansioso/angustiado) → "Fazer Pedido de Oração?" → link para `/intercessao/pedidos?novo=true`
- **Alertas Críticos**: Detecção automática de 3+ dias consecutivos de sentimentos negativos; exibidos em cards destacados no dashboard com dados de contato
- **Análise de IA (Dez/2025)**: Sentimentos são analisados automaticamente via Edge Function `analise-sentimento-ia` usando Lovable AI (Gemini 2.5 Flash):
  - `analise_ia_titulo`: Título resumindo a situação emocional
  - `analise_ia_motivo`: Categoria raiz (Saúde, Financeiro, Luto, Relacionamento, Espiritual, etc.)
  - `analise_ia_gravidade`: Classificação de urgência (baixa, media, critica)
  - `analise_ia_resposta`: Mensagem pastoral sugerida
- **Notificação Automática**: Sentimentos críticos disparam alertas WhatsApp para líder de equipe ou plantão pastoral via Make.com
- **Tabela**: `sentimentos_membros` com campos `id`, `pessoa_id`, `sentimento`, `mensagem`, `data_registro`, `analise_ia_titulo`, `analise_ia_motivo`, `analise_ia_gravidade`, `analise_ia_resposta`, `created_at`, `updated_at`
- **Operações Supabase**: INSERT (novo sentimento), SELECT (listar por período/pessoa), UPDATE (opcional), DELETE (não usual)

### 4.5 Integração Frontend

- **Hub Central** (`Intercessao.tsx`): Dashboard com módulos temáticos separados em 3 contextos (Pessoal, Ministério, Admin); cards para **Diário de Oração**, **Sala de Guerra**, **Gestão de Equipes** e **Sentimentos**, com estatísticas de pedidos/intercessores/testemunhos e navegação direta
- **Diário de Oração** (`DiarioDeOracao.tsx`): Área privada do membro com tabs para pedidos e testemunhos próprios; filtros por status/tipo/categoria; CTAs mobile-friendly
- **Sala de Guerra** (`SalaDeGuerra.tsx`): Workspace dos intercessores com listagem de pedidos da comunidade; filtros avançados; ações rápidas (atribuir, marcar como orado); exportação
- **Gestão de Equipes** (`GestaoEquipes.tsx`): Wrapper para `IntercessoresManager` com controle de acesso por role (líder ou hasAccess); navegação com `?focus=intercessao`
- **Componentes Dialogs**: `NovoPedidoDialog`, `PedidoDetailsDialog`, `IntercessoresManager`, `NovoTestemunhoDialog`, `TestemunhoDetailsDialog`, `RegistrarSentimentoDialog`, `AlertasCriticos`
- **Timeline por Pessoa**: `VidaIgrejaIntercessao` exibe histórico unificado (pedidos + sentimentos + testemunhos) para contexto pastoral
- **Queries/Realtime**: Uso de `@supabase/supabase-js` para CRUD; TanStack Query para cache; Supabase Realtime para atualizações em tempo real (a confirmar se implementado)

### 4.6 Permissões (RLS Básico)

- **Membro**: Cria próprio pedido, vê próprios sentimentos, envia testemunho
- **Intercessor**: Vê pedidos alocados a si, atualiza observações/status
- **Admin/Pastor**: CRUD completo em todas as tabelas; aprova testemunhos; aloca pedidos; gerencia intercessores

### 4.7 Referências e Links

- Manual do usuário: [`../manual-usuario.md#6-intercessão`](../manual-usuario.md#6-intercessão)
- Diagramas: [`../diagramas/fluxo-intercessao.md`](../diagramas/fluxo-intercessao.md), [`../diagramas/sequencia-intercessao.md`](../diagramas/sequencia-intercessao.md)

---

## 5. Jornadas e Ensino

### 5.1 Jornadas (Cursos)

- Criação de trilhas educacionais (Consolidação, Escola de Líderes, etc.)
- **Etapas**: Fases sequenciais da jornada
- **Tipos de Conteúdo**: Vídeo, texto, presencial, evento
- **Kanban**: Visualização do progresso dos participantes
- **Responsáveis**: Líderes/discipuladores por participante

#### Tipos de Jornada (Dez/2024)

- **auto_instrucional**: Exibe Player como visão principal (aluno avança sozinho)
- **processo_acompanhado**: Exibe Kanban como visão principal (líder acompanha)
- **hibrido**: Combinação de ambos os modos
- **Campo**: `tipo_jornada` em `jornadas`

#### Etapas Avançadas (Dez/2024)

- **Tipos de conteúdo**: `texto`, `video`, `quiz`, `tarefa`, `reuniao`
- **URL de conteúdo**: Link de vídeo ou embed externo
- **Configuração de Quiz**: JSON com nota mínima e perguntas (`quiz_config`)
- **Check automático**: Se `true`, sistema avança sozinho; se `false`, requer ação do aluno (soft-lock)
- **Duração estimada**: Tempo previsto para conclusão em minutos
- **Campos**: `conteudo_tipo`, `conteudo_url`, `quiz_config`, `check_automatico`, `duracao_estimada_minutos` em `etapas_jornada`

#### Sistema de Quiz (Dez/2024)

- **Tabela**: `respostas_quiz` armazena histórico de respostas
- **Campos**: `inscricao_id`, `etapa_id`, `respostas` (JSONB), `nota_obtida`, `aprovado`, `tentativa_numero`
- **RLS**: Aluno vê e insere apenas suas próprias respostas; admin gerencia todas

#### Cursos Pagos (Dez/2024)

- **Configuração de valor**: Admin pode definir se a jornada requer pagamento e o valor
- **Status de pagamento**: Inscrições possuem status `isento` (padrão), `pendente` ou `pago`
- **Integração financeira**: Pagamentos podem ser vinculados a transações financeiras (categoria "Cursos e Treinamentos")
- **Campos**: `requer_pagamento` (boolean), `valor` (numeric) em `jornadas`; `status_pagamento`, `transacao_id` em `inscricoes_jornada`

### 5.2 Player de Cursos (Aluno)

- Interface LMS para consumo de conteúdo
- Barra de progresso por curso
- Marcação de etapas concluídas
- Navegação entre etapas com status visual
- **Certificado de Conclusão (Dez/2025)**: download de PDF (jsPDF) ao completar 100% das etapas; tela de celebração destaca a conquista e oferece botão de download (sidebar e tela cheia). Sem alterações de schema — reutiliza dados de jornada/inscrição.

### 5.3 Gestão de Ensino

- Agendamento de aulas (presencial/online/híbrido), vinculadas a jornadas e/ou cultos
- Cadastro/edição de salas com capacidade, tipo e status ativo/inativo
- Registro de presenças por aula (inclui check-in manual com validação de criança/perfil)
- Impressão de etiquetas de segurança por aula/sala (quando aplicável)
- Detalhamento de aula com tema, professor, horário e modalidade

### 5.4 Ministério Infantil (Kids)

- **Salas**: Cadastro com capacidade e faixa etária
- **Check-in/Check-out**: Registro de entrada e saída
- **Segurança**: Código único por criança
- **Etiquetas**: Impressão de labels para criança e responsável
- **Ocupação em Tempo Real**: Visualização de lotação por sala

---

### 5.5 Cursos Pagos (Integração Financeira)

- **Campos (DB)**: `jornadas.requer_pagamento` (boolean), `jornadas.valor` (number), `inscricoes_jornada.status_pagamento` (`isento` | `pendente` | `pago`), `inscricoes_jornada.transacao_id` (uuid), `transacoes_financeiras` (entrada vinculada à inscrição).
- **Fluxo de Inscrição (Aluno)**: ao inscrever-se em jornada paga, o sistema cria uma `transacoes_financeiras` de entrada com `status: pendente` e registra a inscrição com `status_pagamento: pendente` e vínculo em `transacao_id`. Para cursos gratuitos, `status_pagamento: isento`.
- **Bloqueio de Acesso**: o `CursoPlayer` impede acesso ao conteúdo enquanto `status_pagamento = pendente`, exibindo mensagem de aguardo com o valor da inscrição.
- **Configuração Financeira**: resolução de `categoria_id`, `base_ministerial_id` e `conta_id` via nomes existentes ou variáveis `.env` (`VITE_FIN_CATEGORIA_CURSOS_ID`, `VITE_BASE_MINISTERIAL_ENSINO_ID`, `VITE_CONTA_PADRAO_ENTRADAS_ID`). Caso não haja `conta_id`, a inscrição paga permanece pendente (a confirmar política de fallback).
- **Admin (Jornadas)**: criação/edição de jornadas inclui seleção "curso é pago?" e campo de valor (R$), persistindo em `jornadas.requer_pagamento` e `jornadas.valor`.
- **Diagrama do Fluxo**: ver `docs/diagramas/fluxo-cursos-pagos.md`.

**Links relacionados**

- Manual do usuário — Jornadas e Ensino: `manual-usuario.md#7-jornadas-e-ensino`
- Produto — Jornadas e Ensino: `produto/README_PRODUTO.MD#jornadas-e-ensino-visão-de-produto`
- Arquitetura — Módulo Jornadas e Ensino: `01-Arquitetura/01-arquitetura-geral.MD#módulo-jornadas-e-ensino-visão-técnica`
- Diagramas: `diagramas/fluxo-ensino.md`, `diagramas/sequencia-ensino.md`, `diagramas/fluxo-cursos-pagos.md`

#### Admin — Confirmação de Pagamento e Liberação de Acesso

- **Onde confirmar**: no módulo Financeiro, localizar a `transacoes_financeiras` vinculada à inscrição (via descrição e/ou `transacao_id`).
- **Como confirmar**: executar a baixa alterando o **status** da transação para **pago**. Passo a passo em: [Manual do Usuário — Confirmar Pagamento](manual-usuario.md#45-confirmando-pagamento).
- **Efeito esperado**: a inscrição deve refletir **`status_pagamento: pago`** e o acesso ao `CursoPlayer` é liberado.
- **Automação da atualização da inscrição**: (a confirmar) — caso não haja atualização automática, o admin pode ajustar manualmente o `status_pagamento` da inscrição no gerenciamento de alunos.

> Observações
>
> - Integração PIX/checkout externo: (a confirmar) — não há evidência de integração direta no código atual.
> - Baixas de pagamento: realizadas no módulo financeiro; quando a transação muda para `pago`, o acesso ao curso é liberado.

## 6. Comunicação

### 6.1 Canais de Distribuição

- **App/Dashboard**: Alertas e banners para usuários logados
- **Telão**: Slideshow para projeção na igreja
- **Site**: Integração futura com website

### 6.2 Tipos de Comunicado

- **Banners**: Comunicados visuais com imagem
- **Alertas**: Mensagens de urgência

### 6.3 Gestão de Mídias

- Biblioteca centralizada de imagens e vídeos
- Tags para categorização
- Vinculação com comunicados e liturgia

### 6.4 Hub de Publicação

- Interface unificada para gerenciar comunicações
- Filtros por canal
- Agendamento de publicação
- Status ativo/inativo

---

## 7. Dashboard

### 7.1 Dashboard Admin/Pastor

- Gráfico de fluxo de caixa mensal
- KPIs de projetos e tarefas
- Alertas pastorais (ovelhas em risco)
- Aniversariantes do período

### 7.2 Dashboard Líder

- Gestão de célula/ministério
- Ações rápidas de chamada
- Registro de visitantes

### 7.3 Dashboard Membro

- Carrossel de comunicados
- Carteirinha digital com QR Code
- Grade de ações (PIX, pedidos, etc.)
- Minhas tarefas

---

## 8. Projetos e Tarefas

### 8.1 Projetos

- Cadastro com título, descrição, datas
- Status: Ativo, Concluído, Pausado
- Líder responsável
- Barra de progresso visual

### 8.2 Tarefas (Kanban)

- Três colunas: Não Iniciado, Em Execução, Finalizado
- Drag-and-drop para mudança de status
- Prioridade: Baixa, Média, Alta
- Data de vencimento com destaque para atrasadas
- Responsável por tarefa

---

## 9. Presença e Check-in

### 9.1 Chamada de Culto

- Registro de presença por culto
- Métodos: Manual, QR Code, WhatsApp Geo, Líder
- Validação por líder de célula/ministério

### 9.2 Check-in por Geolocalização

- Integração via WhatsApp (Make.com)
- Validação de proximidade com coordenadas da igreja
- Registro automático de presença

### 9.3 QR Code de Membro

- Carteirinha digital no dashboard
- Leitura para check-in rápido

---

## 10. Minhas Escalas (Voluntário)

- Visualização de escalas atribuídas
- Confirmação ou recusa com justificativa
- Briefing por categoria:
  - Louvor: Repertório com tom/BPM/cifra
  - Kids: Tema da aula e materiais
  - Outros: Checklist geral

---

## 11. Minha Família

- Visualização de membros da família
- Adição de dependentes (filhos)
- Edição de dados dos dependentes
- Vinculação automática via `familia_id`

---

## 12. Cadastro Público

### 12.1 Registro de Visitante

- Página pública (/cadastro/Visitante)
- QR Code para distribuição
- Campos: Nome, telefone, como conheceu, tipo de visita

### 12.2 Atualização de Membro

- Página pública (/cadastro/Membro)
- Busca por email
- Atualização de dados sem login

---

## 13. Autenticação e Permissões

### 13.1 Roles do Sistema

- **Admin**: Acesso total
- **Pastor**: Acesso total
- **Líder**: Acesso a funcionalidades de liderança
- **Secretário**: Gestão de pessoas e cadastros
- **Tesoureiro**: Acesso ao módulo financeiro
- **Membro**: Acesso básico + módulos permitidos
- **Básico**: Acesso restrito (visualização)

### 13.2 Níveis de Acesso por Módulo

- Visualizar
- Criar e Editar
- Aprovar/Gerenciar
- Acesso Total

### 13.3 Gestão Avançada de Permissões (Admin)

#### Controles Tri-State por Módulo

A matriz de permissões (`AdminPermissions.tsx`) agrupa permissões por módulo em accordion expansível. Cada cabeçalho de módulo exibe células individuais por cargo com indicadores visuais:

- ✅ **Verde (todas ativas)**: Todas as permissões do módulo estão ativas para aquele cargo
- ➖ **Amarelo (parcial)**: Algumas permissões ativas, outras não
- ⭕ **Cinza (nenhuma)**: Nenhuma permissão ativa

**Ação em massa**: Click no indicador alterna entre ativar todas ou desativar todas as permissões do módulo para aquele cargo. Cargos sistema (admin) não podem ser editados.

#### Clonagem de Permissões

Botão **Copy** no cabeçalho de cada coluna de cargo abre dropdown listando outros cargos como origem. Ao selecionar:

- Sistema calcula diff baseado no estado efetivo (inclui alterações pendentes)
- Sincronização total: adiciona permissões ausentes, remove permissões extras
- Batch update: atualiza `matrix` e `pendingChanges` de uma vez (sem rerenders)
- Toast confirma operação com quantidade de alterações pendentes

**Caso de uso**: Criar cargo "Líder Júnior" → Copiar permissões de "Líder" → Ajustar diferenças específicas → Salvar.

#### Dialog de Confirmação Visual

Botão "Salvar Alterações" interceptado por modal de confirmação que exibe:

- Resumo agrupado por cargo
- Adições em verde (✅ Adicionar: Financeiro View)
- Remoções em vermelho (❌ Remover: Kids Manage)
- Contador de alterações por cargo e total
- Lista scrollável (max-height 60vh) para muitas alterações

**Fluxo**: Revisar diff → Cancelar ou Confirmar → Persistência no Supabase via `executeSave`.

#### Estado Efetivo e Pending Changes

A interface mantém dois estados:

- `originalMatrix`: Estado persistido no banco (role_permissions)
- `pendingChanges`: Array de `{roleId, permissionId, action: 'add'|'remove'}`

Função `getEffectiveState(roleId, permId)` calcula estado real considerando ambos. Todas as operações (tri-state, clonagem, diff) respeitam alterações não salvas.

#### Histórico de Permissões e Rollback

A aba "Histórico" em AdminPermissions implementa auditoria completa com capacidade de reversão:

**Visualização de Histórico:**

- Query agrupa `role_permissions_audit` por `request_id` (transação)
- Cada grupo exibe:
  - Timestamp e usuário que fez a alteração (`created_at`, `actor`)
  - Ações agrupadas e codificadas por cor: ✅ (verde, adição), ❌ (vermelho, remoção)
  - Nomes dos cargos e permissões afetados
  - IDs de módulo e informações técnicas
- Collapse automático para economia de espaço (expansível por clique)

**Rollback de Transações:**

- Cada grupo possui botão Undo2 que abre `AlertDialog` de confirmação
- Confirmação exibe: `request_id`, data/hora, quantidade de mudanças
- Ao confirmar: chama RPC `rollback_audit_batch(request_id)`
  - RPC reverte todas as mudanças daquela transação em `role_permissions`
  - Marca operação como "undone" na auditoria (não deleta, apenas registra revertimento)
- Callback `onRollbackSuccess` recarrega: histórico (refetch) + matriz de permissões
- Toast exibe sucesso/erro com mensagem descritiva

**Rastreabilidade:**

- Nenhuma operação é "silenciosa": toda mudança em permissões registra:
  - `request_id` (agrupa mudanças da mesma transação)
  - `actor` (usuário que fez)
  - `action` (insert/update/delete)
  - `old_value` e `new_value` (antes/depois)
  - `timestamp` (quando)
  - `metadata` (contexto adicional)

**Fluxo Completo:**

1. Admin faz mudanças (tri-state, clonagem) → `pendingChanges`
2. Clica "Salvar" → Dialog confirmação → `executeSave`
3. `save_permissions_batch()` cria transação com `request_id` no `set_audit_context`
4. Alterações persistem com `request_id` em `role_permissions_audit`
5. Meses depois, Admin vê histórico, clica Undo2 em um grupo antigo
6. `rollback_audit_batch()` reverte apenas aquele request_id
7. Auditoria mostra reversão (novo registro com `action: 'rollback'`)

---

### 13.4 Autenticação Biométrica

- WebAuthn/Passkeys
- Desbloqueio rápido por biometria do dispositivo

---

## 14. Notificações

### 14.1 Tipos de Notificação

- Novos pedidos de oração
- Novos testemunhos
- Escalas atribuídas
- Alertas de sentimentos críticos
- Aniversariantes

### 14.2 Automações

- Notificação diária de sentimentos (9h)
- Alertas de aniversário
- Verificação de sentimentos críticos (8h)

---

## 15. Integrações

### 15.1 Make.com (Webhooks)

- Recebimento de pedidos de oração
- Recebimento de testemunhos
- Check-in por geolocalização
- Notificação de liturgia

### 15.2 Supabase Realtime

- Atualização em tempo real do telão
- Sincronização de dados

---

## 16. Exportação de Dados

- Exportação Excel disponível em:
  - Transações financeiras
  - Lista de pessoas
  - Pedidos de oração
  - Testemunhos
  - DRE

---

## 16.1 Gestão Unificada de Dados Financeiros

### Objetivo do Módulo

Centralizar operações de importação e exportação de transações financeiras e extratos bancários em uma interface unificada com tabs, facilitando o fluxo de trabalho da tesouraria e preparando dados para conciliação bancária.

### Rota e Navegação

- **Rota**: `/financas/gerenciar-dados`
- **Acesso**: Via botões "Importar" e "Exportar" nas páginas `Entradas.tsx` e `Saidas.tsx`
- **Query params**: `?tab=importar&tipo=entrada` | `?tab=exportar&tipo=saida` | `?tab=extratos`

### Estrutura (3 Tabs)

#### Tab 1: Importar (Transações Financeiras)

**Componente**: `ImportarTab.tsx` (extraído de `ImportarFinancasPage`)

**Funcionalidades**:

- Wizard 4 etapas: Upload → Mapeamento → Validação → Confirmação
- Formatos suportados: CSV, XLSX
- Auto-detecção de colunas (data, descrição, valor, categoria, fornecedor, conta)
- Validação de campos obrigatórios antes da importação
- Preview virtualizado com `@tanstack/react-virtual` (suporta 10k+ linhas)
- Importação em chunks de 200 registros por lote
- Tracking via `import_jobs` table (histórico de importações)

**Campos mapeáveis**:

- Data (obrigatório)
- Descrição (obrigatório)
- Valor (obrigatório)
- Tipo (entrada/saída)
- Categoria
- Fornecedor/Beneficiário
- Conta
- Forma de Pagamento
- Status (pago/pendente)
- Observações

#### Tab 2: Exportar (Transações Financeiras)

**Componente**: `ExportarTab.tsx`

**Funcionalidades**:

- Filtros avançados: tipo (entrada/saída), status (pago/pendente), período (data início/fim), conta, categoria
- Seleção customizada de colunas para export
- Preview virtualizado dos dados antes da exportação
- Exportação para Excel via biblioteca `xlsx`
- Formatação automática de valores monetários (R$ 1.234,56)
- Formatação de datas (DD/MM/YYYY)

**Colunas exportáveis**:

- Data, Descrição, Tipo, Valor, Categoria, Conta, Fornecedor, Status, Forma de Pagamento, Observações

#### Tab 3: Extratos (Importação para Conciliação Bancária)

**Componente**: `ImportarExtratosTab.tsx`

**Objetivo**: Importar transações de extratos bancários para posterior conciliação com transações financeiras registradas

**Formatos suportados**:

- **CSV/XLSX**: Extratos genéricos exportados de sistemas bancários
- **OFX** (Open Financial Exchange): Formato padrão brasileiro para dados bancários

**Fluxo de Importação**:

1. **Seleção de conta**: Escolher conta bancária destino
2. **Upload de arquivo**: Arrasto ou seleção (até 10MB)
3. **Parsing automático**:
   - **CSV/XLSX**: Extração de colunas e rows via `xlsx` library
   - **OFX**: Parse via `ofx-js` library, extração de nós `STMTTRN` (Statement Transactions)
4. **Mapeamento de colunas**:
   - **Auto-detecção**: Sistema identifica colunas por keywords (data, descricao, valor, saldo, documento, tipo)
   - **Manual**: Usuário ajusta mapeamento se necessário
5. **Validação**:
   - Verifica campos obrigatórios: data, descrição, valor
   - Marca linhas com problemas (data inválida, descrição vazia, valor zero)
   - Exibe preview com destaque visual de erros
6. **Exclusão seletiva**: Checkbox para marcar/desmarcar linhas com erro
7. **Importação**: Insere em chunks de 200 registros na tabela `extratos_bancarios`
8. **Confirmação**: Toast com contagem de registros importados

**Parser OFX (Detalhes Técnicos)**:

- Biblioteca: `ofx-js` v0.2.0
- Extração de campos do nó `STMTTRN`:
  - `DTPOSTED` → `data_transacao` (converte YYYYMMDD para DD/MM/YYYY)
  - `TRNAMT` → `valor` (valor da transação)
  - `MEMO` ou `NAME` → `descricao`
  - `FITID` ou `CHECKNUM` → `numero_documento`
  - `TRNTYPE` → inferência de tipo (crédito/débito)
- Conversão automática de data: `formatOFXDate(YYYYMMDD)` → `DD/MM/YYYY`
- Mapeamento pré-definido (não requer ajuste manual)

**Auto-detecção CSV/XLSX**:

- Analisa nomes de colunas com keywords:
  - `data` → data_transacao
  - `descri` → descricao
  - `valor` → valor
  - `saldo` → saldo
  - `doc`, `numero` → numero_documento
  - `tipo`, `deb`, `cred` → tipo

**Inferência de Tipo (Crédito/Débito)**:

1. **Por texto da coluna tipo**: Analisa texto (debito/credito, d/c, dr/cr)
2. **Por sinal do valor**: Negativo = débito, positivo = crédito
3. **Fallback**: Crédito (padrão)

**Virtualização de Preview**:

- `@tanstack/react-virtual`: Suporta visualização de 10k+ linhas sem lag
- Grid responsivo com scroll horizontal para muitas colunas
- Estimativa de altura: 32px por row

**Validação de Campos**:

- **Data inválida**: Formato não reconhecido (DD/MM/YYYY ou YYYY-MM-DD)
- **Descrição ausente**: Campo vazio ou apenas espaços
- **Valor inválido**: Zero, nulo ou não numérico

### Tabela: `extratos_bancarios`

**Schema** (Migration `20260109_extratos_bancarios.sql`):

```sql
CREATE TABLE extratos_bancarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conta_id UUID NOT NULL REFERENCES contas(id),
  igreja_id UUID NOT NULL REFERENCES igrejas(id),
  filial_id UUID REFERENCES filiais(id),
  data_transacao DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  saldo NUMERIC(15,2),
  numero_documento TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('credito', 'debito')),
  reconciliado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Índices**:

- `conta_id` (FK, acesso por conta)
- `data_transacao` (filtro por período)
- `igreja_id` (multi-tenant)
- `filial_id` (multi-tenant opcional)

**RLS Policies**: Isolamento por `igreja_id` (a confirmar implementação exata)

**Campo `reconciliado`**:

- `FALSE` (padrão): Extrato não reconciliado
- `TRUE`: Transação do extrato já vinculada a uma `transacao_financeira`
- Uso futuro: Interface de conciliação automática/manual

### Integração com Conciliação Bancária (Próximos Passos)

**Objetivo**: Matching automático entre `extratos_bancarios` e `transacoes_financeiras`

**Critérios de Match**:

- Conta bancária (`conta_id`)
- Valor próximo (± R$ 0,50 tolerância)
- Data próxima (± 3 dias úteis)
- Descrição similar (Levenshtein distance ou keywords)

**Scoring de Similaridade**:

- 100%: Match exato (valor + data + conta)
- 80-99%: Alta probabilidade (valor + data próxima)
- 60-79%: Média probabilidade (valor + descrição similar)
- <60%: Baixa probabilidade (requer revisão manual)

**Interface (a implementar)**:

- `ReconciliacaoBancaria.tsx`: Tela de sugestões de match
- Grid lado-a-lado: Extrato | Transação Sugerida | Score
- Ações: Aprovar match, Rejeitar, Criar transação nova
- Bulk actions: Aprovar todos >90%, Rejeitar todos <60%
- Relatório de não reconciliados por conta/período

### Dependências Técnicas

**Bibliotecas**:

- `xlsx` v0.18.5: Parse/export de Excel e CSV
- `ofx-js` v0.2.0: Parser de arquivos OFX
- `@tanstack/react-virtual` v3.13.10: Virtualização de grids grandes
- `@tanstack/react-query` v5.83.0: Cache e gerenciamento de estado

**Hooks**:

- `useFilialId`: Contexto de igreja/filial para queries
- `useQuery`: Fetch de contas bancárias disponíveis

**Utilities**:

- `parseValor(valor)`: Converte string para número (lida com R$, vírgulas, pontos)
- `parseData(data)`: Converte DD/MM/YYYY ou YYYY-MM-DD para ISO
- `inferirTipo(valor, tipoTexto)`: Determina crédito/débito

### Permissões

- **Admin/Tesoureiro**: Acesso completo (importar, exportar, visualizar extratos)
- **Secretário**: Apenas visualização (a confirmar)
- **Outros**: Sem acesso

### Arquivos Criados

- `src/pages/financas/GerenciarDados.tsx`
- `src/components/financas/ImportarTab.tsx`
- `src/components/financas/ExportarTab.tsx`
- `src/components/financas/ImportarExtratosTab.tsx`
- `supabase/migrations/20260109_extratos_bancarios.sql`

### Arquivos Modificados

- `src/pages/financas/Entradas.tsx` (navegação para Gerenciar Dados)
- `src/pages/financas/Saidas.tsx` (navegação para Gerenciar Dados)
- `src/App.tsx` (rota `/financas/gerenciar-dados`)
- `package.json` (dependência `ofx-js`)

### Referências

- ADR: (a criar) `docs/adr/ADR-XXX-gerenciar-dados-financeiros.md`
- Manual: `docs/manual-usuario.md#4-finanças` (seção Gerenciar Dados)
- Fluxo: `docs/diagramas/fluxo-financas.md` (atualizar com nova tela)
- Tabela: `extratos_bancarios` em `docs/database-schema.sql`

---

## 16.2 Integração Getnet SFTP — Parser V10.1 {#getnet-sftp}

### Objetivo do Módulo

Importar automaticamente os arquivos de extrato eletrônico da adquirente Getnet disponibilizados via SFTP, processando todos os tipos de registro do layout posicional V10.1 (400 bytes/linha) e persistindo os dados em tabelas dedicadas para posterior conciliação e relatórios financeiros.

### Rota e Acesso

- **Rota**: `/financas/integracoes`
- **Acesso**: Via tela de Integrações Financeiras, botão "Listar Arquivos SFTP" e "Importar" para integrações do tipo Getnet
- **Roles**: Admin / Tesoureiro

### Padrão de Arquivo

Os arquivos seguem o padrão `getnetextr_YYYYMMDD_XXXXXXXX_c101.txt`. A data de referência é extraída automaticamente do nome do arquivo.

### Tipos de Registro Suportados (Layout V10.1)

| Tipo | Nome | Tabela de destino |
|------|------|-------------------|
| 0 | Header | `getnet_arquivos` (metadados) |
| 1 | Resumo Transacional (RV) | `getnet_resumo` |
| 2 | Analítico / CV | `getnet_analitico` |
| 3 | Ajustes e Chargebacks | `getnet_ajustes` |
| 5 | Resumo Financeiro (UR) | `getnet_financeiro_resumo` |
| 6 | Detalhe Financeiro | `getnet_financeiro_detalhe` |
| 9 | Trailer | `getnet_arquivos` (validação de contagem) |

### Ciclo de Vida PF → LQ

O tipo 1 pode aparecer duas vezes para o mesmo RV:

- **PF** (Previsto de Pagamento): agendamento do crédito
- **LQ** (Liquidação): confirmação do pagamento efetivo

O campo `indicador_tipo_pagamento` faz parte da chave única `(integracao_id, rv, data_rv, indicador_tipo_pagamento)`, permitindo armazenar PF e LQ como linhas distintas e suportando reimportações idempotentes.

### Componentes de UI

- **`GetnetListFilesDialog`**: Lista os arquivos disponíveis no servidor SFTP, exibindo nome, tamanho e data de modificação. Detecta a data de referência a partir do nome do arquivo.
- **`GetnetImportDialog`**: Permite selecionar (ou confirmar) a data de referência antes de iniciar a importação. Exibe resultado detalhado por arquivo (total recebido, inserido, ignorado).

### Edge Function

- **Função**: `getnet-sftp`
- **Ações**:
  - `list_files`: Conecta ao SFTP e retorna lista de arquivos disponíveis
  - `import_extrato`: Baixa e processa arquivo(s) de uma data específica usando `getnetExtratoParser.ts`
  - `sync`: Detecta automaticamente arquivos pendentes (diff SFTP vs `getnet_arquivos`) e importa em lote (padrão: até 7 arquivos por execução, do mais antigo para o mais novo). Usado pelo cron e pelo botão "Sincronizar" na UI. `getnet_arquivos` só é gravado após sucesso total, garantindo que falhas sejam retentadas.

### Sincronização Automática (Cron)

O cron dispara periodicamente a action `sync` via service_role key. Parâmetros:

- **`batch_size`**: Número máximo de arquivos por execução (padrão 7, máximo 30)
- **`created_by`**: `NULL` para execuções do cron (campo UUID — não aceita string)
- **Idempotência**: Todos os `upsert` usam `ON CONFLICT DO NOTHING`, tornando seguros os reprocessamentos de arquivos já parcialmente importados

### Parser (`getnetExtratoParser.ts`)

Parser posicional sem dependências externas. Destaques:

- Offsets 1-based conforme manual V10.1
- Valores monetários em centavos (12 dígitos) convertidos para reais
- Datas no formato `DDMMAAAA` convertidas para ISO `YYYY-MM-DD`
- Campo sinal (`+`/`-`) aplicado ao valor via `applySign()`
- Validação de trailer (contagem de registros)

### Migrations

`supabase/migrations/20260617000001_getnet_schema_expand.sql` expande o schema com:

- Novas colunas em `getnet_resumo`: `indicador_tipo_pagamento`, `data_pagamento_rv`, `chave_ur`, `valor_tarifa`, `valor_taxa_desconto`, `banco`, `agencia`, `conta_corrente`, `tipo_conta`, `num_parcela_rv`, `qtd_parcelas_rv`, `data_vencimento_original`, `moeda`
- Novas colunas em `getnet_analitico`: `data_transacao`, `hora_transacao`, `codigo_terminal`, `valor_comissao`, `numero_parcelas`, `parcela_do_cv`, `valor_parcela`, `moeda`, `sinal`
- Nova tabela `getnet_arquivos` (controle por arquivo importado)
- Nova tabela `getnet_ajustes` (tipo 3)
- Nova tabela `getnet_financeiro_resumo` (tipo 5)
- Nova tabela `getnet_financeiro_detalhe` (tipo 6)
- Índice auxiliar `idx_getnet_resumo_chave_ur` para junção 1↔5↔6

`supabase/migrations/20260619000001_fix_getnet_sync_constraint.sql` corrige o constraint de auditoria:

- Adiciona `'sync'` e `'import_extrato_arquivo'` ao CHECK constraint de `integracoes_execucoes_log.acao`

### Arquivos Criados/Modificados

- `src/components/financas/GetnetImportDialog.tsx` (novo)
- `src/components/financas/GetnetListFilesDialog.tsx` (novo)
- `src/pages/financas/Integracoes.tsx` (botões de listagem e importação)
- `supabase/functions/getnet-sftp/getnetExtratoParser.ts` (novo)
- `supabase/functions/getnet-sftp/index.ts` (expandido)
- `supabase/migrations/20260617000001_getnet_schema_expand.sql` (novo)
- `src/App.tsx` (rota `/financas/integracoes`)

### Referências

- Fluxo: [`docs/diagramas/fluxo-getnet-sftp.md`](diagramas/fluxo-getnet-sftp.md)
- Integração com conciliação bancária: seção 16.1 acima
- Fluxo financeiro geral: [`docs/diagramas/fluxo-financeiro.md`](diagramas/fluxo-financeiro.md)

---

## 17. Bíblia

- Acesso integrado à Bíblia
- Disponível para todos os usuários

---

## 18. Configurações da Igreja

- Painel único para manutenção, identidade visual e integrações críticas
- Card "Webhooks de Integração" abre `/admin/webhooks` para gerenciar URLs de forma mascarada
- Card "Chatbots & Inteligência Artificial" exibe status do `OPENAI_API_KEY` e leva direto à tela `/admin/chatbots` para setup detalhado
- Configuração de plantão pastoral segue disponível com máscara de telefone e escolha de provedor WhatsApp

### 18.1 Chatbots & IAs (Admin)

- Tela dedicada em `/admin/chatbots` lista os bots cadastrados (`chatbot_configs`) com status Ativo/Inativo
- Cadastro/edição permite informar nome, descrição, edge function associada e modelos para texto (`gpt-4o-mini`, `gpt-4o`, etc.), áudio (`whisper-1`) e visão (`gpt-4o`, `gpt-4-turbo`)
- Cada canal possui campo de prompt/role editável com pré-visualização expandível para leitura rápida
- Toggle habilita/desabilita o bot sem apagar configuração; exclusão exige confirmação com diálogo dedicado
- Botão "Novo Chatbot" abre modal para inserir dados obrigatórios e salvar diretamente via Supabase

---

## Tecnologias Utilizadas

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn/UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **IA**: Google Gemini 2.5 Pro (processamento de notas fiscais)
- **Gráficos**: Recharts
- **PWA**: Instalável como aplicativo
- **Realtime**: Supabase Realtime para atualizações ao vivo

### Mobile UX e ResponsiveDialog Pattern

#### Safe Areas e iOS Optimization

- **CSS Variables**: `--safe-area-inset-top/bottom/left/right` aplicadas em `MainLayout` para respeitar notch/island do iPhone
- **Input zoom prevention**: `font-size: 16px` em inputs/selects mobile evita zoom automático no iOS
- **Overflow fixes**: Remoção de `overflow-x: hidden` fixo, aplicação consistente de `pb-safe` em wrappers

#### ResponsiveDialog Component

Componente unificado (`src/components/ui/responsive-dialog.tsx`) que adapta automaticamente baseado em viewport:

- **Desktop (≥768px)**: Renderiza `Dialog` do shadcn/ui (modal centralizado)
- **Mobile (<768px)**: Renderiza `Drawer` do shadcn/ui (bottom sheet)
- **API unificada**: Mesmas props para ambos os modos
- **Accessibility**: Atributos ARIA, foco gerenciado, navegação por teclado preservada

**72 dialogs migrados** incluem: TransacaoDialog, LiturgiaDialog, CultoDialog, CheckinManualDialog, NovoPedidoDialog, ContaDialog, FormaPagamentoDialog, dialogs de Jornadas, Pessoas, Projetos, Ensino, Testemunhos, Intercessão, etc.

**Impacto**: Experiência consistente e nativa mobile; melhor uso de espaço em telas pequenas; drawer bottom sheet substitui modais sobrepostos.

---
