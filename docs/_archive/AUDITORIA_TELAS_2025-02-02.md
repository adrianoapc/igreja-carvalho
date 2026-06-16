# 🔍 Auditoria de Telas - Sistema Igreja Carvalho

**📅 Data:** 02/02/2025  
**🎯 Objetivo:** Identificar telas órfãs (sem rota) e telas inacessíveis (sem navegação)

---

## 📊 Resumo Executivo

| Categoria                             | Quantidade | %       |
| ------------------------------------- | ---------- | ------- |
| **Total de páginas analisadas**       | 125        | 100%    |
| ✅ Páginas com rota + navegação       | 4          | 3%      |
| ⚠️ Páginas com rota mas sem navegação | 17         | 14%     |
| 🔴 **Páginas SEM ROTA (órfãs)**       | **104**    | **83%** |

---

## 🚨 CRÍTICO: 104 Páginas Órfãs (Sem Rota Registrada)

### ⚠️ Páginas que DEVEM ser registradas (alta prioridade)

#### 📊 Dashboard & Core

- `src/pages/Dashboard.tsx` - **Dashboard principal do sistema**
- `src/pages/Index.tsx` - Possível página inicial

#### 👥 Pessoas (CRM)

- `src/pages/pessoas/Todos.tsx` - Listagem geral de pessoas
- `src/pages/pessoas/Membros.tsx` - Gestão de membros
- `src/pages/pessoas/Visitantes.tsx` - Gestão de visitantes
- `src/pages/pessoas/Frequentadores.tsx` - Gestão de frequentadores
- `src/pages/pessoas/Contatos.tsx` - CRM de contatos
- `src/pages/pessoas/AlteracoesPendentes.tsx` - Aprovações pendentes
- `src/pages/pessoas/EditarPessoa.tsx` - Edição de perfil
- `src/pages/pessoas/index.tsx` - Dashboard de pessoas
- `src/pages/PessoaDetalhes.tsx` - Detalhes de pessoa

#### 💰 Finanças

- `src/pages/financas/Dashboard.tsx` - **Dashboard financeiro**
- `src/pages/financas/DRE.tsx` - **Demonstrativo de Resultado (DRE)** 🔴 RECÉM CORRIGIDO
- `src/pages/financas/SessoesContagem.tsx` - **Sessões de Contagem** 🔴 RECÉM CORRIGIDO
- `src/pages/financas/Entradas.tsx` - Lançamentos de entrada
- `src/pages/financas/Saidas.tsx` - Lançamentos de saída
- `src/pages/financas/Reconciliacao.tsx` - Conciliação bancária
- `src/pages/financas/Reclassificacao.tsx` - Reclassificação de lançamentos
- `src/pages/financas/DashboardOfertas.tsx` - Dashboard de ofertas
- `src/pages/financas/RelatorioOferta.tsx` - Relatório de oferta
- `src/pages/financas/SessaoLancamentos.tsx` - Sessão de lançamentos
- `src/pages/financas/Projecao.tsx` - Projeção financeira
- `src/pages/financas/Insights.tsx` - Insights e analytics
- `src/pages/financas/Reembolsos.tsx` - Gestão de reembolsos
- `src/pages/financas/PixRecebido.tsx` - Gestão de PIX recebidos
- `src/pages/financas/Categorias.tsx` - Categorias financeiras
- `src/pages/financas/Contas.tsx` - Contas bancárias
- `src/pages/financas/ContasManutencao.tsx` - Manutenção de contas
- `src/pages/financas/CentrosCusto.tsx` - Centros de custo
- `src/pages/financas/BasesMinisteriais.tsx` - Bases ministeriais
- `src/pages/financas/FormasPagamento.tsx` - Formas de pagamento
- `src/pages/financas/Fornecedores.tsx` - Cadastro de fornecedores
- `src/pages/financas/ConfigFinanceiro.tsx` - Configurações
- `src/pages/financas/Integracoes.tsx` - Integrações financeiras
- `src/pages/financas/GerenciarDados.tsx` - Gerenciar dados
- `src/pages/financas/ImportarFinancasPage.tsx` - Importação de dados

#### 📅 Eventos & Agenda

- `src/pages/Eventos.tsx` - Listagem de eventos
- `src/pages/Agenda.tsx` - Agenda/calendário
- `src/pages/EventoDetalhes.tsx` - Detalhes de evento
- `src/pages/eventos/Eventos.tsx` - Gestão de eventos
- `src/pages/eventos/AgendaPublica.tsx` - Agenda pública
- `src/pages/eventos/Geral.tsx` - Configurações gerais
- `src/pages/eventos/Categorias.tsx` - Categorias de eventos
- `src/pages/eventos/Times.tsx` - Times/equipes
- `src/pages/eventos/Posicoes.tsx` - Posições em escalas
- `src/pages/eventos/Templates.tsx` - Templates de eventos
- `src/pages/eventos/LiturgiaDashboard.tsx` - Dashboard de liturgia
- `src/pages/eventos/MidiasGeral.tsx` - Gestão de mídias

#### 👶 Kids (Ministério Infantil)

- `src/pages/Kids.tsx` - Dashboard kids
- `src/pages/kids/Dashboard.tsx` - Dashboard detalhado
- `src/pages/kids/Criancas.tsx` - Cadastro de crianças
- `src/pages/kids/TurmaAtiva.tsx` - Gestão de turma ativa
- `src/pages/kids/Scanner.tsx` - Scanner de check-in
- `src/pages/kids/Config.tsx` - Configurações
- `src/pages/Chamada.tsx` - Chamada/frequência
- `src/pages/CheckinInscricao.tsx` - Inscrição para check-in

#### 🙏 Intercessão

- `src/pages/Intercessao.tsx` - Dashboard de intercessão
- `src/pages/intercessao/admin/GestaoEquipes.tsx` - Gestão de equipes
- `src/pages/intercessao/admin/Sentimentos.tsx` - Categorização de sentimentos
- `src/pages/intercessao/ministerio/SalaDeGuerra.tsx` - Sala de guerra (torre de controle)
- `src/pages/intercessao/pessoal/DiarioDeOracao.tsx` - Diário de oração pessoal
- `src/pages/oracao/Player.tsx` - Player de relógio de oração

#### 🎓 Ensino & Jornadas

- `src/pages/Ensino.tsx` - Dashboard de ensino
- `src/pages/Ensinamentos.tsx` - Conteúdos de ensino
- `src/pages/Jornadas.tsx` - Jornadas de discipulado
- `src/pages/MeusCursos.tsx` - Meus cursos
- `src/pages/CursoPlayer.tsx` - Player de curso
- `src/pages/ensino/Dashboard.tsx` - Dashboard detalhado
- `src/pages/ensino/Jornadas.tsx` - Gestão de jornadas
- `src/pages/ensino/DetalhesJornada.tsx` - Detalhes de jornada
- `src/pages/ensino/JornadaBoard.tsx` - Board de jornada

#### 🤝 Voluntariado

- `src/pages/Voluntariado.tsx` - Dashboard de voluntariado
- `src/pages/voluntariado/Candidatos.tsx` - Candidatos a voluntário
- `src/pages/voluntariado/IntegracaoDashboard.tsx` - Dashboard de integração
- `src/pages/voluntariado/Historico.tsx` - Histórico de voluntariado
- `src/pages/voluntariado/MeuTeste.tsx` - Teste vocacional
- `src/pages/voluntariado/MinhaJornada.tsx` - Jornada do voluntário
- `src/pages/voluntariado/TestesCrud.tsx` - CRUD de testes
- `src/pages/voluntario/Candidatos.tsx` - Candidatos (duplicado?)

#### 🏛️ Gabinete Pastoral

- `src/pages/GabinetePastoral.tsx` - Dashboard do gabinete
- `src/pages/gabinete/AtendimentoProntuario.tsx` - Prontuário de atendimento

#### 🎬 Mídias & Comunicação

- `src/pages/Midias.tsx` - Gestão de mídias
- `src/pages/Comunicados.tsx` - Comunicados gerais
- `src/pages/Announcements.tsx` - Anúncios
- `src/pages/AnnouncementsAdmin.tsx` - Administração de anúncios
- `src/pages/Publicacao.tsx` - Publicações

#### 💼 Projetos

- `src/pages/Projetos.tsx` - Listagem de projetos
- `src/pages/ProjetoDetalhes.tsx` - Detalhes de projeto

#### 🔧 Configurações & Admin

- `src/pages/Configuracoes.tsx` - Configurações gerais
- `src/pages/ConfiguracoesIgreja.tsx` - Configurações da igreja
- `src/pages/configuracoes/Filiais.tsx` - Gestão de filiais
- `src/pages/Admin.tsx` - Dashboard admin
- `src/pages/AdminPermissions.tsx` - Gestão de permissões
- `src/pages/admin/Chatbots.tsx` - Gestão de chatbots
- `src/pages/admin/Notificacoes.tsx` - Gestão de notificações
- `src/pages/admin/Webhooks.tsx` - Gestão de webhooks
- `src/pages/admin/WhatsAppNumeros.tsx` - Números de WhatsApp

#### 📖 Outros

- `src/pages/Biblia.tsx` - Bíblia integrada
- `src/pages/Escalas.tsx` - Escalas de serviço
- `src/pages/MinhasEscalas.tsx` - Minhas escalas
- `src/pages/MinhaFamilia.tsx` - Minha família
- `src/pages/FamilyWallet.tsx` - Carteira familiar
- `src/pages/Perfil.tsx` - Perfil do usuário
- `src/pages/Financas.tsx` - Dashboard financeiro (duplicado?)

---

## ⚠️ Páginas com Rota mas SEM Navegação (17)

Estas páginas têm rota registrada mas são acessíveis **apenas via URL direta** (sem link no sidebar ou navegação interna):

| Arquivo                               | Rota                         | Observação                           |
| ------------------------------------- | ---------------------------- | ------------------------------------ |
| `Auth.tsx`                            | `/auth`                      | ✅ Normal (página de login)          |
| `BiometricLogin.tsx`                  | `/biometric-login`           | ✅ Normal (autenticação)             |
| `Checkin.tsx`                         | `/checkin/:tipo/:id`         | ✅ Normal (acesso via parâmetro)     |
| `ContextSelect.tsx`                   | `/context-select`            | ✅ Normal (seleção de igreja/filial) |
| `ForcedPasswordChange.tsx`            | `/forced-password-change`    | ✅ Normal (forçar troca de senha)    |
| `InscricaoPublica.tsx`                | `/inscricao/:token`          | ✅ Normal (inscrição via token)      |
| `Install.tsx`                         | `/install`                   | ⚠️ Setup inicial da igreja           |
| `Maintenance.tsx`                     | `/maintenance`               | ✅ Normal (página de manutenção)     |
| `NotFound.tsx`                        | `*`                          | ✅ Normal (404)                      |
| `Public.tsx`                          | `/public/:slug`              | ✅ Normal (páginas públicas)         |
| `Telao.tsx`                           | `/telao/:id`                 | ✅ Normal (telão de projeção)        |
| `TelaoLiturgia.tsx`                   | `/telao/liturgia/:id`        | ✅ Normal (telão de liturgia)        |
| `auth/ResetPassword.tsx`              | `/reset-password`            | ✅ Normal (recuperação de senha)     |
| `cadastro/Membro.tsx`                 | `/cadastro/membro`           | ⚠️ Deveria ter link no menu          |
| `cadastro/NovaIgreja.tsx`             | `/cadastro/igreja`           | ✅ Normal (onboarding)               |
| `cadastro/Visitante.tsx`              | `/cadastro/visitante`        | ⚠️ Deveria ter link no menu          |
| `superadmin/ConfiguracoesGlobais.tsx` | `/superadmin/config-globais` | ⚠️ Deveria ter link no sidebar       |

**✅ Normal:** 13 páginas (esperado que não tenham navegação convencional)  
**⚠️ Revisar:** 4 páginas (deveriam ter link no menu/sidebar)

---

## ✅ Páginas com Navegação Completa (4)

Apenas **4 páginas** têm rota registrada E estão acessíveis via sidebar ou links internos:

1. _(Dados específicos não capturados na análise - precisa refinamento do script)_

---

## 📋 Próximas Ações Recomendadas

### 🔴 Prioridade ALTA

1. **Registrar rotas para módulos core:**
   - Dashboard principal
   - DRE (já corrigido, falta rota)
   - SessoesContagem (já corrigido, falta rota)
   - Pessoas (Todos, Membros, Visitantes)
   - Eventos principais

### 🟡 Prioridade MÉDIA

2. **Auditar módulos específicos:**
   - Kids completo
   - Intercessão completo
   - Financeiro completo
   - Ensino & Jornadas

### 🟢 Prioridade BAIXA

3. **Decidir sobre páginas duplicadas/obsoletas:**
   - `Financas.tsx` vs `financas/Dashboard.tsx`
   - `Voluntariado.tsx` vs `voluntariado/*`
   - `voluntariado/Candidatos.tsx` vs `voluntario/Candidatos.tsx`

### 🗑️ Considerar Exclusão

4. **Páginas possivelmente obsoletas:**
   - Verificar com equipe se ainda são necessárias
   - Mover para branch de arquivo antes de excluir

---

## 🛠️ Metodologia da Auditoria

**Script:** Python 3 com regex  
**Fontes analisadas:**

- `src/pages/**/*.tsx` (125 arquivos)
- `src/App.tsx` (lazy imports e rotas)
- `src/components/layout/Sidebar.tsx` (URLs do menu)
- Todos os arquivos `.tsx` (navegação interna via `navigate()` e `<Link to="">`)

**Critérios de classificação:**

- **COM ROTA:** Lazy import registrado em App.tsx + Route definida
- **NO SIDEBAR:** URL presente em Sidebar.tsx
- **LINK INTERNO:** Referenciada via navigate() ou Link em outros arquivos
- **SEM ACESSO (ÓRFÃ):** Nenhum dos critérios acima

---

## 📎 Arquivos Relacionados

- **Excel completo:** `telas_componentes.xlsx` (19KB)
- **Catálogo de telas:** `docs/telas/catalogo-telas.md`
- **Script de auditoria:** `/tmp/audit_telas.py`

---

**🔍 Revisão recomendada:** Equipe de desenvolvimento + Product Owner  
**🎯 Objetivo final:** 100% das telas com rota registrada ou justificativa para exclusão
