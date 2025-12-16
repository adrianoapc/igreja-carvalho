import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HideValuesProvider } from "@/hooks/useHideValues";
import { useAuth } from "@/hooks/useAuth";
import { useAppConfig } from "@/hooks/useAppConfig";
import { canAccessDuringMaintenance } from "@/utils/roles";
import { AlertTriangle } from "lucide-react";
import MainLayout from "./components/layout/MainLayout";
import { AuthGate } from "./components/auth/AuthGate";
import BiometricLogin from "./pages/BiometricLogin";
import Maintenance from "./pages/Maintenance";
import Dashboard from "./pages/Dashboard";
import Comunicados from "./pages/Comunicados";
import Publicacao from "./pages/Publicacao";
import Pessoas from "./pages/pessoas";
import PessoaDetalhes from "./pages/PessoaDetalhes";
import EditarPessoa from "./pages/pessoas/EditarPessoa";
import TodosPessoas from "./pages/pessoas/Todos";
import Frequentadores from "./pages/pessoas/Frequentadores";
import Membros from "./pages/pessoas/Membros";
import Visitantes from "./pages/pessoas/Visitantes";
import ContatosDashboard from "./pages/pessoas/Contatos";
import AlteracoesPendentes from "./pages/pessoas/AlteracoesPendentes";
import Kids from "./pages/Kids";
import Intercessao from "./pages/Intercessao";
import PedidosOracao from "./pages/intercessao/PedidosOracao";
import Intercessores from "./pages/intercessao/Intercessores";
import TestemunhosIntercessao from "./pages/intercessao/Testemunhos";
import Sentimentos from "./pages/intercessao/Sentimentos";
import Cultos from "./pages/Cultos";
import CultosGeral from "./pages/cultos/Geral";
import CultosEventos from "./pages/cultos/Eventos";
import CultosTimes from "./pages/cultos/Times";
import CultosCategorias from "./pages/cultos/Categorias";
import CultosPosicoes from "./pages/cultos/Posicoes";
import LiturgiaDashboard from "./pages/cultos/LiturgiaDashboard";
import MidiasGeral from "./pages/cultos/MidiasGeral";
import Templates from "./pages/cultos/Templates";
import CultoDetalhes from "./pages/CultoDetalhes";
import Midias from "./pages/Midias";
import Financas from "./pages/Financas";
import DRE from "./pages/financas/DRE";
import FinancasDashboard from "./pages/financas/Dashboard";
import FinancasProjecao from "./pages/financas/Projecao";
import Entradas from "./pages/financas/Entradas";
import Saidas from "./pages/financas/Saidas";
import Insights from "./pages/financas/Insights";
import RelatorioOferta from "./pages/financas/RelatorioOferta";
import DashboardOfertas from "./pages/financas/DashboardOfertas";
import Contas from "./pages/financas/Contas";
import BasesMinisteriais from "./pages/financas/BasesMinisteriais";
import CentrosCusto from "./pages/financas/CentrosCusto";
import Categorias from "./pages/financas/Categorias";
import Fornecedores from "./pages/financas/Fornecedores";
import FormasPagamento from "./pages/financas/FormasPagamento";
import Reembolsos from "./pages/financas/Reembolsos";
import Ensinamentos from "./pages/Ensinamentos";
import Ensino from "./pages/Ensino";
import MeusCursos from "./pages/MeusCursos";
import CursoPlayer from "./pages/CursoPlayer";
import ConfiguracoesIgreja from "./pages/ConfiguracoesIgreja";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/auth/ResetPassword";
import Public from "./pages/Public";
import Announcements from "./pages/Announcements";
import AnnouncementsAdmin from "./pages/AnnouncementsAdmin";
import Agenda from "./pages/Agenda";
import Biblia from "./pages/Biblia";
import Install from "./pages/Install";
import Admin from "./pages/Admin";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";
import CadastroIndex from "./pages/cadastro/Index";
import CadastroVisitante from "./pages/cadastro/Visitante";
import CadastroMembro from "./pages/cadastro/Membro";
import Chamada from "./pages/Chamada";
import Jornadas from "./pages/Jornadas";
import JornadaBoard from "./pages/JornadaBoard";
import Projetos from "./pages/Projetos";
import ProjetoDetalhes from "./pages/ProjetoDetalhes";
import Telao from "./pages/Telao";
import TelaoLiturgia from "./pages/TelaoLiturgia";
import Escalas from "./pages/Escalas";
import MinhasEscalas from "./pages/MinhasEscalas";
import Checkin from "./pages/Checkin";
import PermissionMatrixPrototype from "./pages/AdminPermissions";
import FamilyWallet from "./pages/FamilyWallet";
import KidsCheckinScanner from "./pages/kids/Scanner";
import KidsDashboard from "./pages/kids/Dashboard";
import KidsConfig from "./pages/kids/Config";
import KidsCriancas from "./pages/kids/Criancas";
import EnsinoDashboard from "./pages/ensino/Dashboard";
import TurmaAtiva from "./pages/kids/TurmaAtiva";
import NotificacoesAdmin from "./pages/admin/Notificacoes";

const queryClient = new QueryClient();

// Barra de aviso de manutenção
function MaintenanceBar() {
  const { config } = useAppConfig();
  const { user } = useAuth();
  const isAdmin = user && canAccessDuringMaintenance(user.user_metadata?.role);

  // Mostrar barra apenas se estiver em manutenção e for admin/técnico
  if (!config.maintenance_mode || !isAdmin) {
    return null;
  }

  return (
    <div className="bg-orange-500 text-white px-4 py-3 flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-semibold text-sm">Modo de Manutenção Ativo</p>
        <p className="text-xs opacity-90">{config.maintenance_message || "O sistema está passando por manutenção"}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const biometricEnabled = typeof window !== 'undefined' && localStorage.getItem('biometric_enabled') === 'true';
  const { config: maintenanceConfig } = useAppConfig();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Permite acesso se estiver autenticado (membro ou visitante)
  // A distinção de permissões é feita no menu lateral
  if (!isAuthenticated) {
    return <Navigate to={biometricEnabled ? "/auth?mode=biometric" : "/auth"} replace />;
  }

  // Se em manutenção e usuário não é admin/técnico, bloqueia
  if (maintenanceConfig.maintenance_mode && user && !canAccessDuringMaintenance(user.user_metadata?.role)) {
    return <Maintenance />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
        <HideValuesProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthGate>
                <MaintenanceBar />
                <Routes>
          {/* Rota raiz redireciona para /biometric-login */}
          <Route path="/" element={<Navigate to="/biometric-login" replace />} />
          
          {/* Tela de login com biometria */}
          <Route path="/biometric-login" element={<BiometricLogin />} />
          
          {/* Rota de autenticação */}
          <Route path="/auth" element={<Auth />} />
          {/* Rotas públicas */}
         
          <Route path="/auth/reset" element={<ResetPassword />} />
          
          {/* Rotas públicas de cadastro externo */}
          <Route path="/cadastro" element={<CadastroIndex />} />
          <Route path="/cadastro/visitante" element={<CadastroVisitante />} />
          <Route path="/cadastro/membro" element={<CadastroMembro />} />
          
          {/* Rotas públicas do Telão */}
          <Route path="/telao" element={<Telao />} />
          <Route path="/telao/liturgia/:id" element={<TelaoLiturgia />} />
          <Route path="/telao/:id" element={<TelaoLiturgia />} />
          
          {/* Rota pública de Check-in por QR Code */}
          <Route path="/checkin/:tipo/:id" element={<Checkin />} />

          {/* Rota de Prototipação Novo Admin */}
          <Route path="/teste-permissoes" element={<PermissionMatrixPrototype />} />
          
          {/* Rotas protegidas para membros */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/comunicados"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Comunicados />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/comunicados/announcements"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <AnnouncementsAdmin />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/publicacao"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Publicacao />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pessoas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Pessoas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pessoas/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PessoaDetalhes />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pessoas/:id/editar"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <EditarPessoa />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pessoas/todos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <TodosPessoas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pessoas/frequentadores"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Frequentadores />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pessoas/membros"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Membros />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pessoas/visitantes"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Visitantes />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pessoas/contatos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ContatosDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pessoas/alteracoes-pendentes"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <AlteracoesPendentes />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kids"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Kids />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kids/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <KidsDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kids/config"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <KidsConfig />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kids/criancas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <KidsCriancas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kids/scanner"
            element={
              <ProtectedRoute>
                <KidsCheckinScanner />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kids/turma-ativa"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <TurmaAtiva />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/intercessao"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Intercessao />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/intercessao/pedidos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PedidosOracao />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/intercessao/intercessores"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Intercessores />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/intercessao/testemunhos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <TestemunhosIntercessao />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/intercessao/sentimentos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Sentimentos />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cultos/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CultoDetalhes />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cultos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Cultos />
                </MainLayout>
              </ProtectedRoute>
            }
          >
            <Route path="geral" element={<CultosGeral />} />
            <Route path="eventos" element={<CultosEventos />} />
            <Route path="times" element={<CultosTimes />} />
            <Route path="categorias" element={<CultosCategorias />} />
            <Route path="posicoes" element={<CultosPosicoes />} />
            <Route path="liturgia-dashboard" element={<LiturgiaDashboard />} />
            <Route path="midias" element={<MidiasGeral />} />
            <Route path="templates" element={<Templates />} />
          </Route>
          <Route
            path="/escalas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Escalas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/minhas-escalas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <MinhasEscalas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/midias"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Midias />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/midias/geral"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <MidiasGeral />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Financas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <FinancasDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/projecao"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <FinancasProjecao />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/relatorio-oferta"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <RelatorioOferta />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/dashboard-ofertas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <DashboardOfertas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/entradas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Entradas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/saidas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Saidas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/insights"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Insights />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/contas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Contas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/bases-ministeriais"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <BasesMinisteriais />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/centros-custo"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CentrosCusto />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/categorias"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Categorias />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/fornecedores"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Fornecedores />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/reembolsos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Reembolsos />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/formas-pagamento"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <FormasPagamento />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financas/dre"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <DRE />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ensinamentos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Ensinamentos />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ensino"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Ensino />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ensino/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <EnsinoDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cursos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <MeusCursos />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cursos/:id"
            element={
              <ProtectedRoute>
                <CursoPlayer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Admin />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/notificacoes"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <NotificacoesAdmin />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Perfil />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil/familia"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <FamilyWallet />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracoes-igreja"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ConfiguracoesIgreja />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chamada"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Chamada />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/agenda"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Agenda />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jornadas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Jornadas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jornadas/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <JornadaBoard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/projetos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Projetos />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/projetos/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ProjetoDetalhes />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
              </AuthGate>
            </BrowserRouter>
          </TooltipProvider>
        </HideValuesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
