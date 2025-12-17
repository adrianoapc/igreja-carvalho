# Catálogo de Telas do Sistema

| Tela (Arquivo) | Rota (Sugestão/Real) | Módulo | Submódulo | Tipo | Ações Principais | Papel Sugerido |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SISTEMA & AUTH** | | | | | | |
| `Install.tsx` | `/install` | Sistema | Setup | Setup | Configurar Igreja | Owner |
| `Maintenance.tsx` | `/maintenance` | Sistema | Infra | Público | Status do sistema | Todos |
| `NotFound.tsx` | `*` | Sistema | Erro | Público | - | Todos |
| `Auth.tsx` | `/auth` | Auth | Login | Público | Login/Cadastro | Todos |
| `ResetPassword.tsx` | `/auth/reset` | Auth | Segurança | Público | Recuperar Senha | Todos |
| `BiometricLogin.tsx` | `/auth/biometric` | Auth | Segurança | Público | Login Facial | Todos |
| `ConfiguracoesIgreja.tsx` | `/configuracoes` | Admin | Config | Admin | Dados da Igreja | Admin/Técnico |
| `AdminPermissions.tsx` | `/admin/permissoes` | Admin | Segurança | Admin | Gerir Roles | Admin |
| `admin/Notificacoes.tsx` | `/admin/notificacoes` | Admin | Comunicação | Admin | Enviar Push | Admin |
| **DASHBOARD & PERFIL** | | | | | | |
| `Dashboard.tsx` | `/` | Core | Home | Híbrido | KPIs e Atalhos | Todos |
| `Perfil.tsx` | `/perfil` | Core | Eu | Membro | Editar Dados | Logado |
| `MinhaFamilia.tsx` | `/perfil/familia` | Core | Família | Membro | Gerir Dependentes | Logado |
| `FamilyWallet.tsx` | `/perfil/wallet` | Core | Família | Membro | Carteirinha Digital | Logado |
| **PESSOAS (CRM)** | | | | | | |
| `pessoas/index.tsx` | `/pessoas` | Pessoas | Gestão | Admin | Dashboard Pessoas | Secretaria |
| `pessoas/Todos.tsx` | `/pessoas/todos` | Pessoas | Listagem | Admin | Busca Geral | Secretaria |
| `pessoas/Membros.tsx` | `/pessoas/membros` | Pessoas | Membresia | Admin | Listar Membros | Secretaria |
| `pessoas/Visitantes.tsx` | `/pessoas/visitantes` | Pessoas | Recepção | Admin | Listar Visitantes | Recepção |
| `pessoas/Contatos.tsx` | `/pessoas/contatos` | Pessoas | CRM | Admin | Agendar Contato | Voluntário |
| `PessoaDetalhes.tsx` | `/pessoas/:id` | Pessoas | Perfil 360 | Admin | Ver Histórico/Editar | Liderança |
| `cadastro/Index.tsx` | `/cadastro` | Pessoas | Captação | Público | Menu Links | Visitante |
| `cadastro/Visitante.tsx` | `/cadastro/visitante` | Pessoas | Captação | Público | Formulário | Visitante |
| `cadastro/Membro.tsx` | `/cadastro/membro` | Pessoas | Captação | Público | Atualização | Membro |
| **CULTOS & LITURGIA** | | | | | | |
| `Cultos.tsx` | `/cultos` | Cultos | Gestão | Admin | Criar/Listar Cultos | Admin/Pastor |
| `CultoDetalhes.tsx` | `/cultos/:id` | Cultos | Operação | Admin | Escala/Liturgia | Min. Louvor |
| `cultos/LiturgiaDashboard.tsx`| `/liturgia` | Cultos | Planejamento| Admin | Banco de Músicas | Min. Louvor |
| `Telao.tsx` | `/telao/:id` | Cultos | Projeção | Operação | Slide Atual | Mídia |
| `TelaoLiturgia.tsx` | `/telao/liturgia` | Cultos | Projeção | Operação | Lista Ordem | Backstage |
| `Midias.tsx` | `/midias` | Cultos | Assets | Admin | Upload Arquivos | Mídia |
| **ENSINO (E-LEARNING)** | | | | | | |
| `Ensino.tsx` | `/ensino` | Ensino | Gestão | Admin | Turmas/Salas | Lider Ensino |
| `Jornadas.tsx` | `/jornadas` | Ensino | Trilhas | Admin | Criar Cursos | Lider Ensino |
| `JornadaBoard.tsx` | `/jornadas/:id/board`| Ensino | Processo | Admin | Kanban Alunos | Discipulador |
| `ensino/DetalhesJornada.tsx`| `/jornadas/:id` | Ensino | Curso | Admin | Configurar Conteúdo | Professor |
| `MeusCursos.tsx` | `/meus-cursos` | Ensino | Aluno | Membro | Vitrine/Inscrições | Aluno |
| `CursoPlayer.tsx` | `/curso/:id` | Ensino | Player | Membro | Assistir/Quiz | Aluno |
| `Ensinamentos.tsx` | `/ensinamentos` | Ensino | Conteúdo | Público | Blog/Devocional | Todos |
| **FINANÇAS** | | | | | | |
| `Financas.tsx` | `/financas` | Finanças | Dashboard | Admin | Visão Geral | Tesouraria |
| `financas/Entradas.tsx` | `/financas/entradas`| Finanças | Receita | Admin | Dízimos/Ofertas | Tesouraria |
| `financas/Saidas.tsx` | `/financas/saidas` | Finanças | Despesa | Admin | Contas a Pagar | Tesouraria |
| `financas/Reembolsos.tsx` | `/financas/reembolsos`| Finanças | Processo | Híbrido | Solicitar/Aprovar | Lider/Tesoureiro |
| `financas/DRE.tsx` | `/financas/dre` | Finanças | Relatório | Admin | Relatório Gerencial | Conselho |
| `financas/DashboardOfertas.tsx`| `/financas/ofertas` | Finanças | Receita | Admin | Conferência Culto | Tesouraria |
| `financas/Projecao.tsx` | `/financas/projecao`| Finanças | Planejamento| Admin | Orçamento | Tesouraria |
| **KIDS & CHECK-IN** | | | | | | |
| `Kids.tsx` | `/kids` | Kids | Gestão | Admin | Visão Geral | Lider Kids |
| `kids/Dashboard.tsx` | `/kids/dashboard` | Kids | KPIs | Admin | Números | Lider Kids |
| `Checkin.tsx` | `/checkin` | Kids | Operação | Operação | Totem | Pais |
| `kids/TurmaAtiva.tsx` | `/kids/turma/:id` | Kids | Sala | Admin | Chamada/Check-out | Professor |
| `kids/Scanner.tsx` | `/kids/scanner` | Kids | Operação | Admin | Leitura Etiqueta | Voluntário |
| **VOLUNTARIADO & AGENDA** | | | | | | |
| `Escalas.tsx` | `/escalas` | Voluntariado | Gestão | Admin | Criar Escalas | Lider Min. |
| `MinhasEscalas.tsx` | `/minhas-escalas` | Voluntariado | Pessoal | Membro | Aceitar/Recusar | Voluntário |
| `Agenda.tsx` | `/agenda` | Agenda | Eventos | Híbrido | Calendário | Todos |
| **INTERCESSÃO** | | | | | | |
| `Intercessao.tsx` | `/intercessao` | Intercessao | Gestão | Admin | Painel Geral | Lider Oração |
| `intercessao/PedidosOracao.tsx`| `/pedidos` | Intercessao | Operação | Híbrido | Ver/Criar Pedidos | Intercessor |
| `intercessao/Testemunhos.tsx` | `/testemunhos` | Intercessao | Conteúdo | Público | Ler/Postar | Todos |
| **PROJETOS & COMUNICAÇÃO** | | | | | | |
| `Projetos.tsx` | `/projetos` | Projetos | Gestão | Admin | Listar Projetos | Liderança |
| `ProjetoDetalhes.tsx` | `/projetos/:id` | Projetos | Execução | Admin | Kanban Tarefas | Equipe |
| `Announcements.tsx` | `/mural` | Comunicação | Mural | Membro | Ver Avisos | Membro |
| `Publicacao.tsx` | `/publicacao` | Comunicação | Social | Híbrido | Feed/Postar | Membro |
| `Biblia.tsx` | `/biblia` | Conteúdo | Utilitário| Público | Leitura | Todos |
