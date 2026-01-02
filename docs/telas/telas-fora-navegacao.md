# Telas fora da navegação (Sidebar)

Este documento identifica telas que **não aparecem na navegação lateral** (Sidebar) e
arquivos de páginas que **não possuem rota registrada** em `src/App.tsx`.

**Fontes de evidência**:
- Rotas: `src/App.tsx`
- Navegação lateral: `src/components/layout/Sidebar.tsx`

## 1) Arquivos de páginas sem rota registrada em `App.tsx`

Telas que existem em `src/pages/` mas **não possuem import/rota** em `App.tsx`:

| Tela (Arquivo) | Status | Onde é acessada |
| :--- | :--- | :--- |
| `src/pages/Eventos.tsx` | Sem rota registrada | Acesso direto/legado (a confirmar). |
| `src/pages/financas/ContasManutencao.tsx` | Sem rota registrada | Renderizada via Configurações (`src/pages/Configuracoes.tsx`, view `FINANCEIRO_CONTAS`). |

## 2) Rotas registradas em `App.tsx` que não aparecem na navegação lateral

Rotas abaixo **não possuem item na Sidebar**; podem ser acessadas via links internos,
atalhos, redirecionamentos ou fluxos secundários (a confirmar).

> Colunas seguem o modelo do catálogo de telas, com a coluna adicional **Onde é acessada**.

### Sistema / Auth

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `*` | `*` | Sistema | Erro | Público | — | Todos | Fallback/catch-all em `src/App.tsx`. |
| `/auth/*` | `/auth` | Auth | Login | Público | Login/Cadastro | Todos | Redirecionamentos do `AuthGate` e ações do header público (`src/components/auth/AuthGate.tsx`, `src/components/layout/PublicHeader.tsx`). |
| `/auth/reset-password` | `/auth/reset` | Auth | Segurança | Público | Recuperar senha | Todos | Fluxo de recuperação em `src/pages/Auth.tsx` (redirectTo `/auth/reset`, rota divergente). |
| `/biometric-login` | `/auth/biometric` | Auth | Segurança | Público | Login biométrico | Todos | Deep link direto (a confirmar). |
| `/install` | `/install` | Sistema | Setup | Setup | Configurar Igreja | Owner | Botão no header público (`src/components/layout/PublicHeader.tsx`). |
| `/maintenance` | `/maintenance` | Sistema | Infra | Público | Status do sistema | Todos | Redirecionamento do `AuthGate` em modo manutenção (`src/components/auth/AuthGate.tsx`). |
| `/public/:slug` | `/public/:slug` | Sistema | Público | Público | Landing pública | Todos | Links externos compartilhados (a confirmar). |

### Cadastro público

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/cadastro` | `/cadastro` | Pessoas | Captação | Público | Menu de links | Visitante | Card de links externos em Pessoas (`src/components/pessoas/LinksExternosCard.tsx`). |
| `/cadastro/visitante` | `/cadastro/visitante` | Pessoas | Captação | Público | Formulário | Visitante | Botões do `src/pages/cadastro/Index.tsx` e fluxo do check-in (`src/pages/Checkin.tsx`, usa `/cadastro/Visitante`). |
| `/cadastro/membro` | `/cadastro/membro` | Pessoas | Captação | Público | Atualização | Membro | Botões do `src/pages/cadastro/Index.tsx`. |

### Telão & Check-in

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/telao/:id` | `/telao/:id` | Eventos | Projeção | Operação | Slide atual | Mídia | Link direto (a confirmar). |
| `/telao/liturgia/:id` | `/telao/liturgia/:id` | Eventos | Projeção | Operação | Lista da ordem | Backstage | Botões em `src/pages/EventoDetalhes.tsx` e `src/components/eventos/RecursosLiturgiaSheet.tsx`. |
| `/checkin/:tipo/:id` | `/checkin/:tipo/:id` | Kids | Operação | Operação | Totem/Check-in | Pais | Link/QR em `src/pages/EventoDetalhes.tsx` (`/checkin/culto/:id`). |

### Admin & Configurações

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/admin` | `/admin` | Admin | Gestão | Admin | Administração geral | Admin | Acesso direto (a confirmar). |
| `/admin/permissoes` | `/admin/permissoes` | Admin | Segurança | Admin | Gerir roles | Admin | Acesso direto; tela também renderizada dentro de Configurações (`src/pages/Configuracoes.tsx`). |
| `/admin/webhooks` | `/admin/webhooks` | Admin | Integrações | Admin | Gerir webhooks | Admin/Técnico | Acesso direto; tela também renderizada dentro de Configurações (`src/pages/Configuracoes.tsx`). |
| `/admin/notificacoes` | `/admin/notificacoes` | Admin | Comunicação | Admin | Enviar/gerir notificações | Admin | Acesso direto; tela também renderizada dentro de Configurações (`src/pages/Configuracoes.tsx`). |
| `/admin/chatbots` | `/admin/chatbots` | Admin | IA & Automações | Admin | Gerir chatbots | Admin | Acesso direto; tela também renderizada dentro de Configurações (`src/pages/Configuracoes.tsx`). |
| `/admin/mural` | `/admin/mural` | Comunicação | Mural (Admin) | Admin | Gerir avisos | Admin | Acesso direto (a confirmar). |
| `/configuracoes-igreja` | `/configuracoes` | Admin | Config | Admin | Dados da igreja | Admin/Técnico | Acesso direto; tela também renderizada dentro de Configurações (`src/pages/Configuracoes.tsx`). |

### Comunicação

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/publicacao` | `/publicacao` | Comunicação | Social | Híbrido | Feed/Postar | Membro | Acesso direto (a confirmar). |

### Pessoas

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/pessoas/todos` | `/pessoas/todos` | Pessoas | Listagem | Admin | Busca geral | Secretaria | Ações do hub de Pessoas (`src/pages/pessoas/index.tsx`). |
| `/pessoas/membros` | `/pessoas/membros` | Pessoas | Membresia | Admin | Listar membros | Secretaria | Ações do hub de Pessoas (`src/pages/pessoas/index.tsx`). |
| `/pessoas/visitantes` | `/pessoas/visitantes` | Pessoas | Recepção | Admin | Listar visitantes | Recepção | Ações do hub de Pessoas e atalhos no Dashboard (`src/pages/pessoas/index.tsx`, `src/components/dashboard/DashboardLeader.tsx`, `src/components/dashboard/DashboardAdmin.tsx`). |
| `/pessoas/frequentadores` | `/pessoas/frequentadores` | Pessoas | Listagem | Admin | Listar frequentadores | Secretaria | Ações do hub de Pessoas (`src/pages/pessoas/index.tsx`). |
| `/pessoas/contatos` | `/pessoas/contatos` | Pessoas | CRM | Admin | Agendar contato | Voluntário | Ações do hub de Pessoas (`src/pages/pessoas/index.tsx`). |
| `/pessoas/pendentes` | `/pessoas/pendentes` | Pessoas | Alterações | Admin | Aprovar alterações | Secretaria | Link no hub aponta para `/pessoas/alteracoes-pendentes` (rota divergente) em `src/pages/pessoas/index.tsx`. |
| `/pessoas/:id` | `/pessoas/:id` | Pessoas | Perfil 360 | Admin | Ver histórico/editar | Liderança | Listas em Pessoas (`src/pages/pessoas/*.tsx`), cartões Kids (`src/components/kids/KidCard.tsx`) e Gabinete (`src/pages/gabinete/AtendimentoProntuario.tsx`). |
| `/pessoas/:id/editar` | `/pessoas/:id/editar` | Pessoas | Perfil 360 | Admin | Editar dados | Liderança | Botão “Editar” em `src/pages/PessoaDetalhes.tsx`. |

### Gabinete

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/gabinete/atendimento/:id` | `/gabinete/atendimento/:id` | Gabinete | Cuidado Pastoral | Admin | Prontuário/atendimento | Pastor/Secretaria | Kanban e inbox do gabinete (`src/components/gabinete/PastoralKanbanView.tsx`, `src/components/gabinete/PastoralInboxTable.tsx`, `src/components/gabinete/PastoralDetailsDrawer.tsx`). |

### Intercessão

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/intercessao` | `/intercessao` | Intercessão | Dashboard | Admin | Hub central | Todos | Botão “Voltar” na tela de sentimentos (`src/pages/intercessao/admin/Sentimentos.tsx`) e acesso direto. |

### Eventos

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/eventos/geral` | `/eventos` | Eventos | Dashboard | Admin | Visão geral | Admin | Redirecionamento legado `/cultos/geral` e acesso direto. |
| `/eventos/lista` | `/eventos/lista` | Eventos | Gestão | Admin | Criar/listar eventos | Admin/Pastor | Botões em `src/pages/eventos/Geral.tsx` e navegação em `src/pages/EventoDetalhes.tsx`. |
| `/eventos/:id` | `/eventos/:id` | Eventos | Operação | Admin | Escala/Liturgia/inscrições | Min. Louvor | Lista em `src/pages/eventos/Eventos.tsx` e atalhos em `src/pages/eventos/Geral.tsx`. |
| `/eventos/times` | `/eventos/times` | Eventos | Equipes | Admin | Gerir times | Lider Min. | Atalhos em `src/pages/eventos/Geral.tsx` e botão em `src/components/pedidos/IntercessoresManager.tsx`. |
| `/eventos/templates` | `/eventos/templates` | Eventos | Planejamento | Admin | Templates de liturgia | Min. Louvor | Atalhos em `src/pages/eventos/Geral.tsx` e `src/pages/eventos/LiturgiaDashboard.tsx`. |
| `/eventos/liturgia` | `/eventos/liturgia` | Eventos | Planejamento | Admin | Banco de músicas | Min. Louvor | Redirecionamento legado `/cultos/liturgia` e acesso direto. |
| `/eventos/midias` | `/eventos/midias` | Eventos | Assets | Admin | Upload arquivos | Mídia | Acesso direto (a confirmar). |
| `/eventos/categorias` | `/eventos/categorias` | Eventos | Config | Admin | Tipos de eventos | Admin | Acesso direto (a confirmar). |
| `/eventos/posicoes` | `/eventos/posicoes` | Eventos | Config | Admin | Funções/posições | Admin | Acesso direto (a confirmar). |

### Ensino

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/ensino/dashboard` | `/ensino` | Ensino | Gestão | Admin | KPIs/visão geral | Lider Ensino | Acesso direto (a confirmar). |
| `/jornadas/:id` | `/jornadas/:id` | Ensino | Curso | Admin | Configurar conteúdo | Professor | Link em `src/pages/Jornadas.tsx`. |
| `/jornadas/:id/board` | `/jornadas/:id/board` | Ensino | Processo | Admin | Kanban alunos | Discipulador | Link em `src/pages/ensino/DetalhesJornada.tsx`. |
| `/ensinamentos` | `/ensinamentos` | Ensino | Conteúdo | Público | Blog/Devocional | Todos | Acesso direto (a confirmar). |
| `/cursos/:id/aula/:aulaId` | `/curso/:id (sugestão)` | Ensino | Player | Membro | Assistir/quiz | Aluno | Rotas divergentes: `src/pages/MeusCursos.tsx` navega para `/cursos/:id` (a confirmar). |

### Kids

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/kids/dashboard` | `/kids/dashboard` | Kids | KPIs | Admin | Números | Lider Kids | Botões de retorno em `src/pages/kids/TurmaAtiva.tsx`, `src/pages/kids/Config.tsx` e `src/pages/kids/Scanner.tsx`. |
| `/kids/criancas` | `/kids/criancas` | Kids | Gestão | Admin | Lista de crianças | Lider Kids | Cards/atalhos em `src/pages/kids/Dashboard.tsx`. |
| `/kids/scanner` | `/kids/scanner` | Kids | Operação | Admin | Leitura etiqueta | Voluntário | Cards/atalhos em `src/pages/kids/Dashboard.tsx`. |
| `/kids/turma-ativa` | `/kids/turma-ativa` | Kids | Sala | Admin | Chamada/Check-out | Professor | Cards/atalhos em `src/pages/kids/Dashboard.tsx`. |
| `/kids/config` | `/kids/config` | Kids | Config | Admin | Ajustes do módulo | Lider Kids | Cards/atalhos em `src/pages/kids/Dashboard.tsx`. |

### Finanças

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/financas/dashboard` | `/financas/dashboard` | Finanças | Dashboard | Admin | Visão geral | Tesouraria | Painéis em `src/pages/Financas.tsx`. |
| `/financas/dashboard-ofertas` | `/financas/ofertas` | Finanças | Receita | Admin | Conferência culto | Tesouraria | Painéis em `src/pages/Financas.tsx`. |
| `/financas/projecao` | `/financas/projecao` | Finanças | Planejamento | Admin | Orçamento | Tesouraria | Painéis em `src/pages/Financas.tsx`. |
| `/financas/insights` | `/financas/insights` | Finanças | Análises | Admin | Insights/IA | Tesouraria | Painéis em `src/pages/Financas.tsx`. |
| `/financas/entradas` | `/financas/entradas` | Finanças | Receita | Admin | Dízimos/Ofertas | Tesouraria | Cards em `src/pages/Financas.tsx`. |
| `/financas/saidas` | `/financas/saidas` | Finanças | Despesa | Admin | Contas a pagar | Tesouraria | Cards em `src/pages/Financas.tsx`. |
| `/financas/contas` | `/financas/contas` | Finanças | Manutenção | Admin | Gerir contas | Tesouraria | Cards em `src/pages/Financas.tsx`. |
| `/financas/reembolsos` | `/financas/reembolsos` | Finanças | Processo | Híbrido | Solicitar/aprovar | Lider/Tesoureiro | Acesso direto (a confirmar). |
| `/financas/categorias` | `/financas/categorias` | Finanças | Receita | Admin | Plano de contas | Tesouraria | Cards em `src/pages/Financas.tsx`. |
| `/financas/centros-custo` | `/financas/centros-custo` | Finanças | Classificação | Admin | Centros de custo | Tesouraria | Cards em `src/pages/Financas.tsx`. |
| `/financas/fornecedores` | `/financas/fornecedores` | Finanças | Cadastros | Admin | Fornecedores | Tesouraria | Cards em `src/pages/Financas.tsx`. |
| `/financas/bases-ministeriais` | `/financas/bases-ministeriais` | Finanças | Cadastros | Admin | Bases ministeriais | Tesouraria | Cards em `src/pages/Financas.tsx`. |
| `/financas/formas-pagamento` | `/financas/formas-pagamento` | Finanças | Cadastros | Admin | Formas de pagamento | Tesouraria | Cards em `src/pages/Financas.tsx`. |
| `/financas/dre` | `/financas/dre` | Finanças | Relatório | Admin | Relatório gerencial | Conselho | Painéis em `src/pages/Financas.tsx`. |
| `/financas/relatorios/ofertas` | `/financas/relatorios/ofertas` | Finanças | Relatório | Admin | Relatório de ofertas | Tesouraria | Acesso direto; Dashboard Admin usa `/financas/relatorio-oferta` (rota divergente) em `src/components/dashboard/DashboardAdmin.tsx`. |

### Voluntariado

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/voluntariado/candidatos` | `/voluntariado/candidatos` | Voluntariado | Inscrições | Admin | Gerir candidatos | Lider Min. | Atalho no dashboard (`src/components/dashboard/CandidatosPendentesWidget.tsx`). |
| `/voluntariado/historico` | `/voluntariado/historico` | Voluntariado | Histórico | Admin | Histórico de candidatos | Lider Min. | Link em `src/pages/voluntariado/Candidatos.tsx`. |

### Outros / utilitários

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/agenda` | `/agenda` | Agenda | Eventos | Híbrido | Calendário | Todos | Atalhos no dashboard e página pública (`src/components/dashboard/DashboardMember.tsx`, `src/components/dashboard/DashboardVisitante.tsx`, `src/pages/Public.tsx`). |
| `/biblia` | `/biblia` | Conteúdo | Utilitário | Público | Leitura | Todos | Atalhos no dashboard e página pública (`src/components/dashboard/DashboardMember.tsx`, `src/pages/Public.tsx`). |
| `/chamada` | `/chamada` | Voluntariado | Operação | Admin | Check-in de escala | Lider Min. | Atalho no dashboard líder (`src/components/dashboard/DashboardLeader.tsx`). |
| `/midias/geral` | `/midias` | Eventos | Assets | Admin | Upload arquivos | Mídia | Botões em `src/pages/Midias.tsx`. |
| `/oracao/player/:escalaId` | `/oracao/player/:escalaId` | Oração | Player | Operação | Slides/oração | Intercessor | Atalhos no hub de eventos (`src/pages/eventos/Geral.tsx`). |
| `/perfil` | `/perfil` | Core | Eu | Membro | Editar dados | Logado | Menu do usuário (`src/components/layout/UserMenu.tsx`). |
| `/perfil/wallet` | `/perfil/wallet` | Core | Família | Membro | Carteirinha digital | Logado | Acesso direto (a confirmar). |
| `/projetos/:id` | `/projetos/:id` | Projetos | Execução | Admin | Kanban tarefas | Equipe | Cards em `src/pages/Projetos.tsx` e widgets (`src/components/dashboard/VisaoProjetosWidget.tsx`, `src/components/dashboard/MinhasTarefasWidget.tsx`). |

### Legado / Redirecionamentos

| Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido | Onde é acessada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/cultos` | `/eventos` | Eventos | Gestão | Admin | Redirecionar para Eventos | Admin/Pastor | Redirect em `src/App.tsx`. |
| `/cultos/geral` | `/eventos/geral` | Eventos | Dashboard | Admin | Redirecionar para Eventos | Admin/Pastor | Redirect em `src/App.tsx`. |
| `/cultos/lista` | `/eventos/lista` | Eventos | Gestão | Admin | Redirecionar para Eventos | Admin/Pastor | Redirect em `src/App.tsx`. |
| `/cultos/liturgia` | `/eventos/liturgia` | Eventos | Planejamento | Admin | Redirecionar para Eventos | Admin/Pastor | Redirect em `src/App.tsx`. |
| `/cultos/times` | `/eventos/times` | Eventos | Equipes | Admin | Redirecionar para Eventos | Admin/Pastor | Redirect em `src/App.tsx`. |
| `/cultos/:id` | `/eventos/:id` | Eventos | Operação | Admin | Redirecionar para Evento | Admin/Pastor | Redirect em `src/App.tsx`. |
