import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { SuperAdminLayout } from "./components/layout/SuperAdminLayout";
import { AuthGate } from "./components/auth/AuthGate";
import { ThemeProvider } from "next-themes";

// Pages Imports
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Install = lazy(() => import("./pages/Install"));
const BiometricLogin = lazy(() => import("./pages/BiometricLogin"));

// Módulos
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Public = lazy(() => import("./pages/Public"));
const Perfil = lazy(() => import("./pages/Perfil"));
const MinhaFamilia = lazy(() => import("./pages/MinhaFamilia"));
const FamilyWallet = lazy(() => import("./pages/FamilyWallet"));
const Biblia = lazy(() => import("./pages/Biblia"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Chamada = lazy(() => import("./pages/Chamada"));
const Escalas = lazy(() => import("./pages/Escalas"));
const MinhasEscalas = lazy(() => import("./pages/MinhasEscalas"));
const Voluntariado = lazy(() => import("./pages/Voluntariado"));
const VoluntariadoCandidatos = lazy(
  () => import("./pages/voluntario/Candidatos")
);
const VoluntariadoHistorico = lazy(
  () => import("./pages/voluntariado/Historico")
);
const Publicacao = lazy(() => import("./pages/Publicacao"));
const Comunicados = lazy(() => import("./pages/Comunicados"));
const Announcements = lazy(() => import("./pages/Announcements"));
const AnnouncementsAdmin = lazy(() => import("./pages/AnnouncementsAdmin"));

// Cadastro Publico
const CadastroIndex = lazy(() => import("./pages/cadastro/Index"));
const CadastroVisitante = lazy(() => import("./pages/cadastro/Visitante"));
const CadastroMembro = lazy(() => import("./pages/cadastro/Membro"));

// Pessoas
const PessoasIndex = lazy(() => import("./pages/pessoas/index"));
const PessoasTodos = lazy(() => import("./pages/pessoas/Todos"));
const PessoasMembros = lazy(() => import("./pages/pessoas/Membros"));
const PessoasVisitantes = lazy(() => import("./pages/pessoas/Visitantes"));
const PessoasFrequentadores = lazy(
  () => import("./pages/pessoas/Frequentadores")
);
const PessoasContatos = lazy(() => import("./pages/pessoas/Contatos"));
const PessoasAlteracoes = lazy(
  () => import("./pages/pessoas/AlteracoesPendentes")
);
const PessoaDetalhes = lazy(() => import("./pages/PessoaDetalhes"));
const EditarPessoa = lazy(() => import("./pages/pessoas/EditarPessoa"));

// Gabinete
const GabinetePastoral = lazy(() => import("./pages/GabinetePastoral"));
const AtendimentoProntuario = lazy(
  () => import("./pages/gabinete/AtendimentoProntuario")
);

// Intercessão
const Intercessao = lazy(() => import("./pages/Intercessao"));
const DiarioDeOracao = lazy(
  () => import("./pages/intercessao/pessoal/DiarioDeOracao")
);
const SalaDeGuerra = lazy(
  () => import("./pages/intercessao/ministerio/SalaDeGuerra")
);
const GestaoEquipes = lazy(
  () => import("./pages/intercessao/admin/GestaoEquipes")
);
const Sentimentos = lazy(() => import("./pages/intercessao/admin/Sentimentos"));

// Ministério Kids
const KidsDashboard = lazy(() => import("./pages/kids/Dashboard"));
const KidsCriancas = lazy(() => import("./pages/kids/Criancas"));
const KidsScanner = lazy(() => import("./pages/kids/Scanner"));
const KidsTurmaAtiva = lazy(() => import("./pages/kids/TurmaAtiva"));
const KidsConfig = lazy(() => import("./pages/kids/Config"));
const Kids = lazy(() => import("./pages/Kids"));

// Ensino
const EnsinoDashboard = lazy(() => import("./pages/ensino/Dashboard"));
const Ensino = lazy(() => import("./pages/Ensino"));
const Jornadas = lazy(() => import("./pages/ensino/Jornadas"));
const DetalhesJornada = lazy(() => import("./pages/ensino/DetalhesJornada"));
const JornadaBoard = lazy(() => import("./pages/ensino/JornadaBoard"));
const Ensinamentos = lazy(() => import("./pages/Ensinamentos"));
const MeusCursos = lazy(() => import("./pages/MeusCursos"));
const CursoPlayer = lazy(() => import("./pages/CursoPlayer"));

// Eventos (Hub)
const EventosGeral = lazy(() => import("./pages/eventos/Geral"));
const EventosLista = lazy(() => import("./pages/eventos/Eventos"));
const EventosTimes = lazy(() => import("./pages/eventos/Times"));
const EventosCategorias = lazy(() => import("./pages/eventos/Categorias"));
const EventosPosicoes = lazy(() => import("./pages/eventos/Posicoes"));
const EventosTemplates = lazy(() => import("./pages/eventos/Templates"));
const EventosMidias = lazy(() => import("./pages/eventos/MidiasGeral"));
const EventosLiturgia = lazy(() => import("./pages/eventos/LiturgiaDashboard"));
const EventoDetalhes = lazy(() => import("./pages/EventoDetalhes"));

// Telão & Checkin
const Telao = lazy(() => import("./pages/Telao"));
const TelaoLiturgia = lazy(() => import("./pages/TelaoLiturgia"));
const Checkin = lazy(() => import("./pages/Checkin"));

// Mídias
const Midias = lazy(() => import("./pages/Midias"));

// Financeiro
const FinancasDashboard = lazy(() => import("./pages/financas/Dashboard"));
const Financas = lazy(() => import("./pages/Financas"));
const FinancasEntradas = lazy(() => import("./pages/financas/Entradas"));
const FinancasSaidas = lazy(() => import("./pages/financas/Saidas"));
const FinancasContas = lazy(() => import("./pages/financas/Contas"));
const FinancasCategorias = lazy(() => import("./pages/financas/Categorias"));
const FinancasCentrosCusto = lazy(
  () => import("./pages/financas/CentrosCusto")
);
const FinancasFornecedores = lazy(
  () => import("./pages/financas/Fornecedores")
);
const FinancasBases = lazy(() => import("./pages/financas/BasesMinisteriais"));
const FinancasFormas = lazy(() => import("./pages/financas/FormasPagamento"));
const FinancasDRE = lazy(() => import("./pages/financas/DRE"));
const FinancasRelatorioOferta = lazy(
  () => import("./pages/financas/RelatorioOferta")
);
const FinancasDashboardOfertas = lazy(
  () => import("./pages/financas/DashboardOfertas")
);
const FinancasProjecao = lazy(() => import("./pages/financas/Projecao"));
const FinancasInsights = lazy(() => import("./pages/financas/Insights"));
const FinancasReembolsos = lazy(() => import("./pages/financas/Reembolsos"));

// Projetos
const Projetos = lazy(() => import("./pages/Projetos"));
const ProjetoDetalhes = lazy(() => import("./pages/ProjetoDetalhes"));

// Oração
const PrayerPlayer = lazy(() => import("./pages/oracao/Player"));

// Admin
const Admin = lazy(() => import("./pages/Admin"));
const AdminPermissions = lazy(() => import("./pages/AdminPermissions"));
const AdminWebhooks = lazy(() => import("./pages/admin/Webhooks"));
const AdminNotificacoes = lazy(() => import("./pages/admin/Notificacoes"));
const AdminChatbots = lazy(() => import("./pages/admin/Chatbots"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const ConfiguracoesIgreja = lazy(() => import("./pages/ConfiguracoesIgreja"));

// Super Admin
const SuperAdminDashboard = lazy(
  () => import("./pages/superadmin/Dashboard")
);
const SuperAdminIgrejas = lazy(
  () => import("./pages/superadmin/Igrejas")
);
const SuperAdminMetricas = lazy(
  () => import("./pages/superadmin/Metricas")
);
const NovaIgreja = lazy(() => import("./pages/cadastro/NovaIgreja"));

const queryClient = new QueryClient();

// ScrollToTop component
const ScrollToTop = () => {
  const { pathname } = useLocation();

  // Não rola para o topo em telas de apresentação
  if (pathname.includes("/telao")) return null;

  window.scrollTo(0, 0);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Suspense
            fallback={
              <div className="p-6 text-center text-muted-foreground">
                Carregando...
              </div>
            }
          >
            <Routes>
              {/* --- ROTAS PÚBLICAS (Sem AuthGate ou AuthGate liberado) --- */}
              <Route path="/auth/*" element={<Auth />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/biometric-login" element={<BiometricLogin />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/install" element={<Install />} />
              <Route path="/public/:slug" element={<Public />} />

              {/* Telão e Check-in (Públicos ou tokenizados) */}
              <Route path="/telao/:id" element={<Telao />} />
              <Route path="/telao/liturgia/:id" element={<TelaoLiturgia />} />
              <Route path="/checkin/:tipo/:id" element={<Checkin />} />

              {/* Cadastro Público */}
              <Route path="/cadastro" element={<CadastroIndex />} />
              <Route
                path="/cadastro/visitante"
                element={<CadastroVisitante />}
              />
              <Route path="/cadastro/membro" element={<CadastroMembro />} />
              <Route path="/cadastro/igreja" element={<NovaIgreja />} />

              {/* --- ROTAS PROTEGIDAS (MainLayout) --- */}
              <Route element={<MainLayout />}>
                <Route
                  path="/"
                  element={
                    <AuthGate>
                      <Dashboard />
                    </AuthGate>
                  }
                />

                {/* Perfil & Família */}
                <Route
                  path="/perfil"
                  element={
                    <AuthGate>
                      <Perfil />
                    </AuthGate>
                  }
                />
                <Route
                  path="/perfil/familia"
                  element={
                    <AuthGate>
                      <MinhaFamilia />
                    </AuthGate>
                  }
                />
                <Route
                  path="/perfil/wallet"
                  element={
                    <AuthGate>
                      <FamilyWallet />
                    </AuthGate>
                  }
                />
                <Route
                  path="/biblia"
                  element={
                    <AuthGate>
                      <Biblia />
                    </AuthGate>
                  }
                />
                <Route
                  path="/agenda"
                  element={
                    <AuthGate>
                      <Agenda />
                    </AuthGate>
                  }
                />
                <Route
                  path="/chamada"
                  element={
                    <AuthGate>
                      <Chamada />
                    </AuthGate>
                  }
                />
                <Route
                  path="/voluntariado"
                  element={
                    <AuthGate>
                      <Voluntariado />
                    </AuthGate>
                  }
                />
                <Route
                  path="/voluntariado/candidatos"
                  element={
                    <AuthGate>
                      <VoluntariadoCandidatos />
                    </AuthGate>
                  }
                />
                <Route
                  path="/voluntariado/historico"
                  element={
                    <AuthGate>
                      <VoluntariadoHistorico />
                    </AuthGate>
                  }
                />

                {/* Comunicação */}
                <Route
                  path="/publicacao"
                  element={
                    <AuthGate>
                      <Publicacao />
                    </AuthGate>
                  }
                />
                <Route
                  path="/comunicados"
                  element={
                    <AuthGate>
                      <Comunicados />
                    </AuthGate>
                  }
                />
                <Route
                  path="/mural"
                  element={
                    <AuthGate>
                      <Announcements />
                    </AuthGate>
                  }
                />
                <Route
                  path="/admin/mural"
                  element={
                    <AuthGate>
                      <AnnouncementsAdmin />
                    </AuthGate>
                  }
                />

                {/* Pessoas */}
                <Route
                  path="/pessoas"
                  element={
                    <AuthGate>
                      <PessoasIndex />
                    </AuthGate>
                  }
                />
                <Route
                  path="/pessoas/todos"
                  element={
                    <AuthGate>
                      <PessoasTodos />
                    </AuthGate>
                  }
                />
                <Route
                  path="/pessoas/membros"
                  element={
                    <AuthGate>
                      <PessoasMembros />
                    </AuthGate>
                  }
                />
                <Route
                  path="/pessoas/visitantes"
                  element={
                    <AuthGate>
                      <PessoasVisitantes />
                    </AuthGate>
                  }
                />
                <Route
                  path="/pessoas/frequentadores"
                  element={
                    <AuthGate>
                      <PessoasFrequentadores />
                    </AuthGate>
                  }
                />
                <Route
                  path="/pessoas/contatos"
                  element={
                    <AuthGate>
                      <PessoasContatos />
                    </AuthGate>
                  }
                />
                <Route
                  path="/pessoas/pendentes"
                  element={
                    <AuthGate>
                      <PessoasAlteracoes />
                    </AuthGate>
                  }
                />
                <Route
                  path="/pessoas/:id/editar"
                  element={
                    <AuthGate>
                      <EditarPessoa />
                    </AuthGate>
                  }
                />
                <Route
                  path="/pessoas/:id"
                  element={
                    <AuthGate>
                      <PessoaDetalhes />
                    </AuthGate>
                  }
                />

                {/* Gabinete */}
                <Route
                  path="/gabinete"
                  element={
                    <AuthGate>
                      <GabinetePastoral />
                    </AuthGate>
                  }
                />
                <Route
                  path="/gabinete/atendimento/:id"
                  element={
                    <AuthGate>
                      <AtendimentoProntuario />
                    </AuthGate>
                  }
                />

                {/* Intercessão - Hub */}
                <Route
                  path="/intercessao"
                  element={
                    <AuthGate>
                      <Intercessao />
                    </AuthGate>
                  }
                />
                <Route
                  path="/intercessao/diario"
                  element={
                    <AuthGate>
                      <DiarioDeOracao />
                    </AuthGate>
                  }
                />
                <Route
                  path="/intercessao/sala-de-guerra"
                  element={
                    <AuthGate>
                      <SalaDeGuerra />
                    </AuthGate>
                  }
                />
                <Route
                  path="/intercessao/equipes"
                  element={
                    <AuthGate>
                      <GestaoEquipes />
                    </AuthGate>
                  }
                />
                <Route
                  path="/intercessao/sentimentos"
                  element={
                    <AuthGate>
                      <Sentimentos />
                    </AuthGate>
                  }
                />

                {/* Ministério Kids */}
                <Route
                  path="/kids"
                  element={
                    <AuthGate>
                      <Kids />
                    </AuthGate>
                  }
                />
                <Route
                  path="/kids/dashboard"
                  element={
                    <AuthGate>
                      <KidsDashboard />
                    </AuthGate>
                  }
                />
                <Route
                  path="/kids/criancas"
                  element={
                    <AuthGate>
                      <KidsCriancas />
                    </AuthGate>
                  }
                />
                <Route
                  path="/kids/scanner"
                  element={
                    <AuthGate>
                      <KidsScanner />
                    </AuthGate>
                  }
                />
                <Route
                  path="/kids/turma-ativa"
                  element={
                    <AuthGate>
                      <KidsTurmaAtiva />
                    </AuthGate>
                  }
                />
                <Route
                  path="/kids/config"
                  element={
                    <AuthGate>
                      <KidsConfig />
                    </AuthGate>
                  }
                />

                {/* Ensino */}
                <Route
                  path="/ensino"
                  element={
                    <AuthGate>
                      <Ensino />
                    </AuthGate>
                  }
                />
                <Route
                  path="/ensino/dashboard"
                  element={
                    <AuthGate>
                      <EnsinoDashboard />
                    </AuthGate>
                  }
                />
                <Route
                  path="/ensino/jornadas"
                  element={
                    <AuthGate>
                      <Jornadas />
                    </AuthGate>
                  }
                />
                <Route
                  path="/ensino/jornadas/:id"
                  element={
                    <AuthGate>
                      <DetalhesJornada />
                    </AuthGate>
                  }
                />
                <Route
                  path="/ensino/jornadas/:id/board"
                  element={
                    <AuthGate>
                      <JornadaBoard />
                    </AuthGate>
                  }
                />
                {/* Redirects legado de Jornadas para o módulo de Ensino */}
                <Route
                  path="/jornadas"
                  element={
                    <AuthGate>
                      <Navigate to="/ensino/jornadas" replace />
                    </AuthGate>
                  }
                />
                <Route
                  path="/jornadas/:id"
                  element={
                    <AuthGate>
                      <Navigate to="/ensino/jornadas/:id" replace />
                    </AuthGate>
                  }
                />
                <Route
                  path="/jornadas/:id/board"
                  element={
                    <AuthGate>
                      <Navigate to="/ensino/jornadas/:id/board" replace />
                    </AuthGate>
                  }
                />
                <Route
                  path="/ensinamentos"
                  element={
                    <AuthGate>
                      <Ensinamentos />
                    </AuthGate>
                  }
                />
                <Route
                  path="/cursos"
                  element={
                    <AuthGate>
                      <MeusCursos />
                    </AuthGate>
                  }
                />
                <Route
                  path="/cursos/:id/aula/:aulaId"
                  element={
                    <AuthGate>
                      <CursoPlayer />
                    </AuthGate>
                  }
                />

                {/* Eventos & Escalas */}
                <Route
                  path="/eventos"
                  element={
                    <AuthGate>
                      <EventosGeral />
                    </AuthGate>
                  }
                />
                <Route
                  path="/eventos/geral"
                  element={
                    <AuthGate>
                      <EventosGeral />
                    </AuthGate>
                  }
                />
                <Route
                  path="/eventos/lista"
                  element={
                    <AuthGate>
                      <EventosLista />
                    </AuthGate>
                  }
                />
                <Route
                  path="/eventos/times"
                  element={
                    <AuthGate>
                      <EventosTimes />
                    </AuthGate>
                  }
                />
                <Route
                  path="/eventos/categorias"
                  element={
                    <AuthGate>
                      <EventosCategorias />
                    </AuthGate>
                  }
                />
                <Route
                  path="/eventos/posicoes"
                  element={
                    <AuthGate>
                      <EventosPosicoes />
                    </AuthGate>
                  }
                />
                <Route
                  path="/eventos/templates"
                  element={
                    <AuthGate>
                      <EventosTemplates />
                    </AuthGate>
                  }
                />
                <Route
                  path="/eventos/midias"
                  element={
                    <AuthGate>
                      <EventosMidias />
                    </AuthGate>
                  }
                />
                <Route
                  path="/eventos/liturgia"
                  element={
                    <AuthGate>
                      <EventosLiturgia />
                    </AuthGate>
                  }
                />
                <Route
                  path="/eventos/:id"
                  element={
                    <AuthGate>
                      <EventoDetalhes />
                    </AuthGate>
                  }
                />

                {/* Redirects legado de /cultos para /eventos */}
                <Route
                  path="/cultos"
                  element={
                    <AuthGate>
                      <Navigate to="/eventos" replace />
                    </AuthGate>
                  }
                />
                <Route
                  path="/cultos/geral"
                  element={
                    <AuthGate>
                      <Navigate to="/eventos/geral" replace />
                    </AuthGate>
                  }
                />
                <Route
                  path="/cultos/lista"
                  element={
                    <AuthGate>
                      <Navigate to="/eventos/lista" replace />
                    </AuthGate>
                  }
                />
                <Route
                  path="/cultos/liturgia"
                  element={
                    <AuthGate>
                      <Navigate to="/eventos/liturgia" replace />
                    </AuthGate>
                  }
                />
                <Route
                  path="/cultos/times"
                  element={
                    <AuthGate>
                      <Navigate to="/eventos/times" replace />
                    </AuthGate>
                  }
                />
                <Route
                  path="/cultos/:id"
                  element={
                    <AuthGate>
                      <EventoDetalhes />
                    </AuthGate>
                  }
                />
                <Route
                  path="/escalas"
                  element={
                    <AuthGate>
                      <Escalas />
                    </AuthGate>
                  }
                />
                <Route
                  path="/minhas-escalas"
                  element={
                    <AuthGate>
                      <MinhasEscalas />
                    </AuthGate>
                  }
                />

                {/* Oração */}
                <Route
                  path="/oracao/player/:escalaId"
                  element={
                    <AuthGate>
                      <PrayerPlayer />
                    </AuthGate>
                  }
                />

                {/* Mídias */}
                <Route
                  path="/midias"
                  element={
                    <AuthGate>
                      <Midias />
                    </AuthGate>
                  }
                />
                <Route
                  path="/midias/geral"
                  element={
                    <AuthGate>
                      <Midias />
                    </AuthGate>
                  }
                />

                {/* Financeiro */}
                {/* 🥥 PROVA DE CONCEITO RBAC: Bloqueio da rota principal */}
                <Route
                  path="/financas"
                  element={
                    <AuthGate requiredPermission="financeiro.view">
                      <Financas />
                    </AuthGate>
                  }
                />

                <Route
                  path="/financas/dashboard"
                  element={
                    <AuthGate>
                      <FinancasDashboard />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/dashboard-ofertas"
                  element={
                    <AuthGate>
                      <FinancasDashboardOfertas />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/projecao"
                  element={
                    <AuthGate>
                      <FinancasProjecao />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/insights"
                  element={
                    <AuthGate>
                      <FinancasInsights />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/entradas"
                  element={
                    <AuthGate>
                      <FinancasEntradas />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/saidas"
                  element={
                    <AuthGate>
                      <FinancasSaidas />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/contas"
                  element={
                    <AuthGate>
                      <FinancasContas />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/reembolsos"
                  element={
                    <AuthGate>
                      <FinancasReembolsos />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/categorias"
                  element={
                    <AuthGate>
                      <FinancasCategorias />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/centros-custo"
                  element={
                    <AuthGate>
                      <FinancasCentrosCusto />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/fornecedores"
                  element={
                    <AuthGate>
                      <FinancasFornecedores />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/bases-ministeriais"
                  element={
                    <AuthGate>
                      <FinancasBases />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/formas-pagamento"
                  element={
                    <AuthGate>
                      <FinancasFormas />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/dre"
                  element={
                    <AuthGate>
                      <FinancasDRE />
                    </AuthGate>
                  }
                />
                <Route
                  path="/financas/relatorios/ofertas"
                  element={
                    <AuthGate>
                      <FinancasRelatorioOferta />
                    </AuthGate>
                  }
                />

                {/* Projetos */}
                <Route
                  path="/projetos"
                  element={
                    <AuthGate>
                      <Projetos />
                    </AuthGate>
                  }
                />
                <Route
                  path="/projetos/:id"
                  element={
                    <AuthGate>
                      <ProjetoDetalhes />
                    </AuthGate>
                  }
                />

                {/* Admin & Configurações */}
                <Route
                  path="/admin"
                  element={
                    <AuthGate>
                      <Admin />
                    </AuthGate>
                  }
                />
                <Route
                  path="/admin/permissoes"
                  element={
                    <AuthGate>
                      <AdminPermissions />
                    </AuthGate>
                  }
                />
                <Route
                  path="/admin/webhooks"
                  element={
                    <AuthGate>
                      <AdminWebhooks />
                    </AuthGate>
                  }
                />
                <Route
                  path="/admin/notificacoes"
                  element={
                    <AuthGate>
                      <AdminNotificacoes />
                    </AuthGate>
                  }
                />
                <Route
                  path="/admin/chatbots"
                  element={
                    <AuthGate>
                      <AdminChatbots />
                    </AuthGate>
                  }
                />
                <Route
                  path="/configuracoes-igreja"
                  element={
                    <AuthGate>
                      <ConfiguracoesIgreja />
                    </AuthGate>
                  }
                />
                <Route
                  path="/configuracoes"
                  element={
                    <AuthGate>
                      <Configuracoes />
                    </AuthGate>
                  }
                />

              </Route>

              {/* --- ROTAS SUPER ADMIN (Layout Separado) --- */}
              <Route element={<SuperAdminLayout />}>
                <Route path="/superadmin" element={<SuperAdminDashboard />} />
                <Route path="/superadmin/igrejas" element={<SuperAdminIgrejas />} />
                <Route path="/superadmin/metricas" element={<SuperAdminMetricas />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
