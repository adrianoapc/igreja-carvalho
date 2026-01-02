# Checklist — Readequação de Layout (UX) por Tela

Baseado em:
- Catálogo de telas: `docs/telas/catalogo-telas.md`
- Telas fora da navegação: `docs/telas/telas-fora-navegacao.md`
- Documentação geral e changelog: `docs/README.MD`, `docs/CHANGELOG.md`, `docs/funcionalidades.md`, `docs/DOCOPS_REVIEW_2024-12-24.md`, `README.md`

**Critério de marcação**
- **UX readequada (Sim/Não):** marcado como **Sim** apenas quando há evidência explícita de refatoração/modernização de layout em docs/changelog.
- **Testes (Sim/Não):** marcado como **Sim** somente quando há referência explícita a testes por tela. *(Não há evidências por tela nos documentos citados; portanto todas estão como **Não**.)*

## 1) Catálogo de Telas (docs/telas/catalogo-telas.md)

| Tela (arquivo) | Rota | UX readequada | Testes | Evidência |
| --- | --- | --- | --- | --- |
| Install.tsx | — | Não | Não | Sem referência de refatoração UX |
| Maintenance.tsx | /maintenance | Não | Não | Sem referência de refatoração UX |
| NotFound.tsx | * | Não | Não | Sem referência de refatoração UX |
| Auth.tsx | /auth | Não | Não | Sem referência de refatoração UX |
| ResetPassword.tsx | /auth/reset | Não | Não | Sem referência de refatoração UX |
| BiometricLogin.tsx | /biometric-login | Não | Não | Sem referência de refatoração UX |
| ConfiguracoesIgreja.tsx | /configuracoes-igreja | Não | Não | Sem referência de refatoração UX |
| admin/Webhooks.tsx | /admin/webhooks | Sim | Não | DOCOPS_REVIEW_2024-12-24.md (Telas Admin refactor UX) |
| AdminPermissions.tsx | /teste-permissoes | Não | Não | Sem referência de refatoração UX |
| admin/Notificacoes.tsx | /admin/notificacoes | Não | Não | Sem referência de refatoração UX |
| admin/Chatbots.tsx | /admin/chatbots | Sim | Não | DOCOPS_REVIEW_2024-12-24.md (Telas Admin refactor UX) |
| Dashboard.tsx | / | Não | Não | Sem referência de refatoração UX |
| Perfil.tsx | /perfil | Não | Não | Sem referência de refatoração UX |
| MinhaFamilia.tsx (FamilyWallet.tsx) | /perfil/familia | Sim | Não | CHANGELOG.md (Mobile UX refactor: componentes de família) |
| pessoas/index.tsx | /pessoas | Sim | Não | CHANGELOG.md (Dashboards Pessoas ajustados + AniversariosDashboard mobile) |
| pessoas/Todos.tsx | /pessoas/todos | Sim | Não | CHANGELOG.md (Mobile UX refactor: tabs → select) |
| pessoas/Membros.tsx | /pessoas/membros | Não | Não | Sem referência de refatoração UX |
| pessoas/Visitantes.tsx | /pessoas/visitantes | Sim | Não | CHANGELOG.md (Mobile UX refactor: tabs → select) |
| pessoas/Contatos.tsx | /pessoas/contatos | Não | Não | Sem referência de refatoração UX |
| PessoaDetalhes.tsx | /pessoas/:id | Não | Não | Sem referência de refatoração UX |
| cadastro/Index.tsx | /cadastro | Não | Não | Sem referência de refatoração UX |
| cadastro/Visitante.tsx | /cadastro/visitante | Não | Não | Sem referência de refatoração UX |
| cadastro/Membro.tsx | /cadastro/membro | Não | Não | Sem referência de refatoração UX |
| eventos/Eventos.tsx | /eventos/lista | Não | Não | Sem referência de refatoração UX |
| EventoDetalhes.tsx | /eventos/:id | Não | Não | Sem referência de refatoração UX |
| eventos/Geral.tsx | /eventos/geral | Não | Não | Sem referência de refatoração UX |
| eventos/Times.tsx | /eventos/times | Não | Não | Sem referência de refatoração UX |
| eventos/Categorias.tsx | /eventos/categorias | Não | Não | Sem referência de refatoração UX |
| eventos/Posicoes.tsx | /eventos/posicoes | Não | Não | Sem referência de refatoração UX |
| eventos/Templates.tsx | /eventos/templates | Não | Não | Sem referência de refatoração UX |
| eventos/LiturgiaDashboard.tsx | /eventos/liturgia | Não | Não | Sem referência de refatoração UX |
| eventos/MidiasGeral.tsx | /eventos/midias | Não | Não | Sem referência de refatoração UX |
| Telao.tsx | /telao | Não | Não | Sem referência de refatoração UX |
| TelaoLiturgia.tsx | /telao/liturgia/:id | Não | Não | Sem referência de refatoração UX |
| oracao/Player.tsx | /oracao/player/:escalaId | Não | Não | Sem referência de refatoração UX |
| escalas/EscalaTimeline.tsx (componente) | (integrado em EventoDetalhes) | Não | Não | Sem referência de refatoração UX |
| escalas/AdicionarVoluntarioSheet.tsx (componente) | (modal/sheet) | Não | Não | Sem referência de refatoração UX |
| Ensino.tsx | /ensino | Não | Não | Sem referência de refatoração UX |
| Jornadas.tsx | /jornadas | Não | Não | Sem referência de refatoração UX |
| JornadaBoard.tsx | /jornadas/:id/board | Não | Não | Sem referência de refatoração UX |
| ensino/DetalhesJornada.tsx | /jornadas/:id | Não | Não | Sem referência de refatoração UX |
| MeusCursos.tsx | /cursos | Não | Não | Sem referência de refatoração UX |
| CursoPlayer.tsx | /cursos/:id | Não | Não | Sem referência de refatoração UX |
| Ensinamentos.tsx | /ensinamentos | Não | Não | Sem referência de refatoração UX |
| Financas.tsx | /financas | Não | Não | Sem referência de refatoração UX |
| financas/Entradas.tsx | /financas/entradas | Não | Não | Sem referência de refatoração UX |
| financas/Saidas.tsx | /financas/saidas | Não | Não | Sem referência de refatoração UX |
| financas/Reembolsos.tsx | /financas/reembolsos | Não | Não | Sem referência de refatoração UX |
| financas/DRE.tsx | /financas/dre | Não | Não | Sem referência de refatoração UX |
| financas/DashboardOfertas.tsx | /financas/dashboard-ofertas | Não | Não | Sem referência de refatoração UX |
| financas/ContasManutencao.tsx | /financas/contas | Sim | Não | funcionalidades.md + DOCOPS_REVIEW_2024-12-24.md (telas de manutenção refatoradas) |
| financas/Projecao.tsx | /financas/projecao | Não | Não | Sem referência de refatoração UX |
| Kids.tsx | /kids | Não | Não | Sem referência de refatoração UX |
| kids/Dashboard.tsx | /kids/dashboard | Não | Não | Sem referência de refatoração UX |
| Checkin.tsx | /checkin/:tipo/:id | Não | Não | Sem referência de refatoração UX |
| kids/TurmaAtiva.tsx | /kids/turma-ativa | Não | Não | Sem referência de refatoração UX |
| kids/Scanner.tsx | /kids/scanner | Não | Não | Sem referência de refatoração UX |
| Voluntariado.tsx | /voluntariado | Não | Não | Sem referência de refatoração UX |
| Escalas.tsx | /escalas | Sim | Não | CHANGELOG.md (Mobile UX refactor: componentes de escalas) |
| MinhasEscalas.tsx | /minhas-escalas | Não | Não | Sem referência de refatoração UX |
| Agenda.tsx | /agenda | Não | Não | Sem referência de refatoração UX |
| GabinetePastoral.tsx | /gabinete | Não | Não | Sem referência de refatoração UX |
| Intercessao.tsx | /intercessao | Sim | Não | CHANGELOG.md (Dashboards Intercessão ajustados) |
| intercessao/pessoal/DiarioDeOracao.tsx | /intercessao/diario | Não | Não | Sem referência de refatoração UX |
| intercessao/ministerio/SalaDeGuerra.tsx | /intercessao/sala-de-guerra | Não | Não | Sem referência de refatoração UX |
| intercessao/admin/GestaoEquipes.tsx | /intercessao/equipes | Não | Não | Sem referência de refatoração UX |
| intercessao/admin/Sentimentos.tsx | /intercessao/sentimentos | Sim | Não | CHANGELOG.md (Mobile UX refactor: componentes de sentimentos) |
| Projetos.tsx | /projetos | Não | Não | Sem referência de refatoração UX |
| ProjetoDetalhes.tsx | /projetos/:id | Não | Não | Sem referência de refatoração UX |
| Announcements.tsx | — | Não | Não | Sem referência de refatoração UX |
| Publicacao.tsx | /publicacao | Não | Não | Sem referência de refatoração UX |
| Biblia.tsx | — | Não | Não | Sem referência de refatoração UX |

## 2) Telas fora da navegação (docs/telas/telas-fora-navegacao.md)

| Tela/rota | Observação | UX readequada | Testes | Evidência |
| --- | --- | --- | --- | --- |
| src/pages/Eventos.tsx | Sem rota em App.tsx (a confirmar uso) | Não | Não | Sem referência de refatoração UX |
| src/pages/financas/ContasManutencao.tsx | Sem rota em App.tsx (a confirmar uso) | Sim | Não | funcionalidades.md + DOCOPS_REVIEW_2024-12-24.md |
| * | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /auth/* | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /auth/reset-password | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /biometric-login | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /install | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /maintenance | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /public/:slug | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /admin | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /admin/chatbots | Sem item de sidebar | Sim | Não | DOCOPS_REVIEW_2024-12-24.md (Telas Admin refactor UX) |
| /admin/mural | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /admin/notificacoes | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /admin/permissoes | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /admin/webhooks | Sem item de sidebar | Sim | Não | DOCOPS_REVIEW_2024-12-24.md (Telas Admin refactor UX) |
| /mural | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /publicacao | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /pessoas/:id | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /pessoas/:id/editar | Sem item de sidebar | Sim | Não | CHANGELOG.md (UX EditarPessoa mobile) |
| /pessoas/contatos | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /pessoas/frequentadores | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /pessoas/membros | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /pessoas/pendentes | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /pessoas/todos | Sem item de sidebar | Sim | Não | CHANGELOG.md (Mobile UX refactor: tabs → select) |
| /pessoas/visitantes | Sem item de sidebar | Sim | Não | CHANGELOG.md (Mobile UX refactor: tabs → select) |
| /intercessao | Sem item de sidebar | Sim | Não | CHANGELOG.md (Dashboards Intercessão ajustados) |
| /gabinete/atendimento/:id | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /eventos/:id | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /eventos/categorias | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /eventos/geral | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /eventos/lista | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /eventos/liturgia | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /eventos/midias | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /eventos/posicoes | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /eventos/templates | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /eventos/times | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /ensino/dashboard | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /ensinamentos | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /jornadas/:id | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /jornadas/:id/board | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /cursos/:id/aula/:aulaId | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /kids/config | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /kids/criancas | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /kids/dashboard | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /kids/scanner | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /kids/turma-ativa | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /checkin/:tipo/:id | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /financas/bases-ministeriais | Sem item de sidebar | Sim | Não | funcionalidades.md + DOCOPS_REVIEW_2024-12-24.md |
| /financas/categorias | Sem item de sidebar | Sim | Não | funcionalidades.md + DOCOPS_REVIEW_2024-12-24.md |
| /financas/centros-custo | Sem item de sidebar | Sim | Não | funcionalidades.md + DOCOPS_REVIEW_2024-12-24.md |
| /financas/contas | Sem item de sidebar | Sim | Não | funcionalidades.md + DOCOPS_REVIEW_2024-12-24.md |
| /financas/dashboard | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /financas/dashboard-ofertas | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /financas/dre | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /financas/entradas | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /financas/formas-pagamento | Sem item de sidebar | Sim | Não | funcionalidades.md + DOCOPS_REVIEW_2024-12-24.md |
| /financas/fornecedores | Sem item de sidebar | Sim | Não | funcionalidades.md + DOCOPS_REVIEW_2024-12-24.md |
| /financas/insights | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /financas/projecao | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /financas/reembolsos | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /financas/relatorios/ofertas | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /financas/saidas | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /voluntariado/candidatos | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /voluntariado/historico | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /agenda | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /biblia | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /chamada | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /cultos | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /cultos/:id | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /cultos/geral | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /cultos/lista | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /cultos/liturgia | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /cultos/times | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /midias/geral | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /oracao/player/:escalaId | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /perfil | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /perfil/wallet | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /telao/:id | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
| /telao/liturgia/:id | Sem item de sidebar | Não | Não | Sem referência de refatoração UX |
