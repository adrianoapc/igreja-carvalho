# Catálogo de Telas do Sistema

| Tela (Arquivo) | Rota (Real — App.tsx) | Rota (Sugestão) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SISTEMA & AUTH** | | | | | | | |
| `Install.tsx` | — | `/install (sugestão)` | Sistema | Setup | Setup | Configurar Igreja | Owner |
| `Maintenance.tsx` | `/maintenance` | `/maintenance` | Sistema | Infra | Público | Status do sistema | Todos |
| `NotFound.tsx` | `*` | `*` | Sistema | Erro | Público | - | Todos |
| `Auth.tsx` | `/auth` | `/auth` | Auth | Login | Público | Login/Cadastro | Todos |
| `ResetPassword.tsx` | `/auth/reset` | `/auth/reset` | Auth | Segurança | Público | Recuperar Senha | Todos |
| `BiometricLogin.tsx` | `/biometric-login` | `/auth/biometric (sugestão)` | Auth | Segurança | Público | Login Facial | Todos |
| `ConfiguracoesIgreja.tsx` | `/configuracoes-igreja` | `/configuracoes (sugestão)` | Admin | Config | Admin | Dados da Igreja | Admin/Técnico |
| `admin/Webhooks.tsx` | `/admin/webhooks` | `/admin/webhooks` | Admin | Integrações | Admin | Gerir Webhooks | Admin/Técnico |
| `AdminPermissions.tsx` | `/teste-permissoes` | `/admin/permissoes (sugestão)` | Admin | Segurança | Admin | Gerir Roles | Admin |
| `admin/Notificacoes.tsx` | `/admin/notificacoes` | `/admin/notificacoes` | Admin | Comunicação | Admin | Enviar Push | Admin |
| **DASHBOARD & PERFIL** | | | | | | | |
| `Dashboard.tsx` | `/dashboard` | `/` | Core | Home | Híbrido | KPIs e Atalhos | Todos |
| `Perfil.tsx` | `/perfil` | `/perfil` | Core | Eu | Membro | Editar Dados | Logado |
| `MinhaFamilia.tsx` (`FamilyWallet.tsx`) | `/perfil/familia` | `/perfil/familia` | Core | Família | Membro | Gerir Dependentes | Logado |
| **PESSOAS (CRM)** | | | | | | | |
| `pessoas/index.tsx` | `/pessoas` | `/pessoas` | Pessoas | Gestão | Admin | Dashboard Pessoas | Secretaria |
| `pessoas/Todos.tsx` | `/pessoas/todos` | `/pessoas/todos` | Pessoas | Listagem | Admin | Busca Geral | Secretaria |
| `pessoas/Membros.tsx` | `/pessoas/membros` | `/pessoas/membros` | Pessoas | Membresia | Admin | Listar Membros | Secretaria |
| `pessoas/Visitantes.tsx` | `/pessoas/visitantes` | `/pessoas/visitantes` | Pessoas | Recepção | Admin | Listar Visitantes | Recepção |
| `pessoas/Contatos.tsx` | `/pessoas/contatos` | `/pessoas/contatos` | Pessoas | CRM | Admin | Agendar Contato | Voluntário |
| `PessoaDetalhes.tsx` | `/pessoas/:id` | `/pessoas/:id` | Pessoas | Perfil 360 | Admin | Ver Histórico/Editar | Liderança |
| `cadastro/Index.tsx` | `/cadastro` | `/cadastro` | Pessoas | Captação | Público | Menu Links | Visitante |
| `cadastro/Visitante.tsx` | `/cadastro/visitante` | `/cadastro/visitante` | Pessoas | Captação | Público | Formulário | Visitante |
| `cadastro/Membro.tsx` | `/cadastro/membro` | `/cadastro/membro` | Pessoas | Captação | Público | Atualização | Membro |
| **CULTOS & LITURGIA** | | | | | | | |
| `Cultos.tsx` | `/cultos` | `/cultos` | Cultos | Gestão | Admin | Criar/Listar Cultos | Admin/Pastor |
| `CultoDetalhes.tsx` | `/cultos/:id` | `/cultos/:id` | Cultos | Operação | Admin | Escala/Liturgia | Min. Louvor |
| `cultos/LiturgiaDashboard.tsx` | `/cultos/liturgia-dashboard` | `/liturgia (sugestão)` | Cultos | Planejamento | Admin | Banco de Músicas | Min. Louvor |
| `Telao.tsx` | `/telao` | `/telao/:id (sugestão)` | Cultos | Projeção | Operação | Slide Atual | Mídia |
| `TelaoLiturgia.tsx` | `/telao/liturgia/:id`, `/telao/:id` | `/telao/liturgia (sugestão)` | Cultos | Projeção | Operação | Lista Ordem | Backstage |
| `Midias.tsx` | `/midias` | `/midias` | Cultos | Assets | Admin | Upload Arquivos | Mídia |
| **ENSINO (E-LEARNING)** | | | | | | | |
| `Ensino.tsx` | `/ensino` | `/ensino` | Ensino | Gestão | Admin | Turmas/Salas | Lider Ensino |
| `Jornadas.tsx` | `/jornadas` | `/jornadas` | Ensino | Trilhas | Admin | Criar Cursos | Lider Ensino |
| `JornadaBoard.tsx` | `/jornadas/:id/board` | `/jornadas/:id/board` | Ensino | Processo | Admin | Kanban Alunos | Discipulador |
| `ensino/DetalhesJornada.tsx` | `/jornadas/:id` | `/jornadas/:id` | Ensino | Curso | Admin | Configurar Conteúdo | Professor |
| `MeusCursos.tsx` | `/cursos` | `/meus-cursos (sugestão)` | Ensino | Aluno | Membro | Vitrine/Inscrições | Aluno |
| `CursoPlayer.tsx` | `/cursos/:id` | `/curso/:id (sugestão)` | Ensino | Player | Membro | Assistir/Quiz | Aluno |
| `Ensinamentos.tsx` | `/ensinamentos` | `/ensinamentos` | Ensino | Conteúdo | Público | Blog/Devocional | Todos |
| **FINANÇAS** | | | | | | | |
| `Financas.tsx` | `/financas` | `/financas` | Finanças | Dashboard | Admin | Visão Geral | Tesouraria |
| `financas/Entradas.tsx` | `/financas/entradas` | `/financas/entradas` | Finanças | Receita | Admin | Dízimos/Ofertas | Tesouraria |
| `financas/Saidas.tsx` | `/financas/saidas` | `/financas/saidas` | Finanças | Despesa | Admin | Contas a Pagar | Tesouraria |
| `financas/Reembolsos.tsx` | `/financas/reembolsos` | `/financas/reembolsos` | Finanças | Processo | Híbrido | Solicitar/Aprovar | Lider/Tesoureiro |
| `financas/DRE.tsx` | `/financas/dre` | `/financas/dre` | Finanças | Relatório | Admin | Relatório Gerencial | Conselho |
| `financas/DashboardOfertas.tsx` | `/financas/dashboard-ofertas` | `/financas/ofertas (sugestão)` | Finanças | Receita | Admin | Conferência Culto | Tesouraria |
| `financas/Projecao.tsx` | `/financas/projecao` | `/financas/projecao` | Finanças | Planejamento | Admin | Orçamento | Tesouraria |
| **KIDS & CHECK-IN** | | | | | | | |
| `Kids.tsx` | `/kids` | `/kids` | Kids | Gestão | Admin | Visão Geral | Lider Kids |
| `kids/Dashboard.tsx` | `/kids/dashboard` | `/kids/dashboard` | Kids | KPIs | Admin | Números | Lider Kids |
| `Checkin.tsx` | `/checkin/:tipo/:id` | `/checkin (sugestão)` | Kids | Operação | Operação | Totem | Pais |
| `kids/TurmaAtiva.tsx` | `/kids/turma-ativa` | `/kids/turma/:id (sugestão)` | Kids | Sala | Admin | Chamada/Check-out | Professor |
| `kids/Scanner.tsx` | `/kids/scanner` | `/kids/scanner` | Kids | Operação | Admin | Leitura Etiqueta | Voluntário |
| **VOLUNTARIADO & AGENDA** | | | | | | | |
| `Escalas.tsx` | `/escalas` | `/escalas` | Voluntariado | Gestão | Admin | Criar Escalas | Lider Min. |
| `MinhasEscalas.tsx` | `/minhas-escalas` | `/minhas-escalas` | Voluntariado | Pessoal | Membro | Aceitar/Recusar | Voluntário |
| `Agenda.tsx` | `/agenda` | `/agenda` | Agenda | Eventos | Híbrido | Calendário | Todos |
| **INTERCESSÃO** | | | | | | | |
| `Intercessao.tsx` | `/intercessao` | `/intercessao` | Intercessao | Gestão | Admin | Painel Geral | Lider Oração |
| `intercessao/PedidosOracao.tsx` | `/intercessao/pedidos` | `/intercessao/pedidos` | Intercessao | Operação | Híbrido | Ver/Criar Pedidos | Intercessor |
| `intercessao/Intercessores.tsx` | `/intercessao/intercessores` | `/intercessao/intercessores` | Intercessao | Equipe | Admin | Gerir Intercessores | Lider Oração |
| `intercessao/Testemunhos.tsx` | `/intercessao/testemunhos` | `/intercessao/testemunhos` | Intercessao | Conteúdo | Público | Ler/Postar | Todos |
| `intercessao/Sentimentos.tsx` | `/intercessao/sentimentos` | `/intercessao/sentimentos` | Intercessao | Monitoramento | Admin | Alertas/Emoções | Lider Oração |
| **PROJETOS & COMUNICAÇÃO** | | | | | | | |
| `Projetos.tsx` | `/projetos` | `/projetos` | Projetos | Gestão | Admin | Listar Projetos | Liderança |
| `ProjetoDetalhes.tsx` | `/projetos/:id` | `/projetos/:id` | Projetos | Execução | Admin | Kanban Tarefas | Equipe |
| `Announcements.tsx` | — | `/mural (sugestão)` | Comunicação | Mural | Membro | Ver Avisos | Membro |
| `Publicacao.tsx` | `/publicacao` | `/publicacao` | Comunicação | Social | Híbrido | Feed/Postar | Membro |
| `Biblia.tsx` | — | `/biblia (sugestão)` | Conteúdo | Utilitário | Público | Leitura | Todos |
