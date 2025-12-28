import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import {MainLayout} from "./components/layout/MainLayout";
import { AuthGate } from "./components/auth/AuthGate";
import { ThemeProvider } from "next-themes";

// Pages Imports
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/auth/ResetPassword";
import NotFound from "./pages/NotFound";
import Maintenance from "./pages/Maintenance";
import Install from "./pages/Install";
import BiometricLogin from "./pages/BiometricLogin";

// Módulos
import Dashboard from "./pages/Dashboard";
import Public from "./pages/Public";
import Perfil from "./pages/Perfil";
import MinhaFamilia from "./pages/MinhaFamilia";
import FamilyWallet from "./pages/FamilyWallet";
import Biblia from "./pages/Biblia";
import Agenda from "./pages/Agenda";
import Chamada from "./pages/Chamada";
import Escalas from "./pages/Escalas";
import MinhasEscalas from "./pages/MinhasEscalas";
import Publicacao from "./pages/Publicacao";
import Comunicados from "./pages/Comunicados";
import Announcements from "./pages/Announcements";
import AnnouncementsAdmin from "./pages/AnnouncementsAdmin";

// Cadastro Publico
import CadastroIndex from "./pages/cadastro/Index";
import CadastroVisitante from "./pages/cadastro/Visitante";
import CadastroMembro from "./pages/cadastro/Membro";

// Pessoas
import PessoasIndex from "./pages/pessoas/index";
import PessoasTodos from "./pages/pessoas/Todos";
import PessoasMembros from "./pages/pessoas/Membros";
import PessoasVisitantes from "./pages/pessoas/Visitantes";
import PessoasFrequentadores from "./pages/pessoas/Frequentadores";
import PessoasContatos from "./pages/pessoas/Contatos";
import PessoasAlteracoes from "./pages/pessoas/AlteracoesPendentes";
import PessoaDetalhes from "./pages/PessoaDetalhes";
import EditarPessoa from "./pages/pessoas/EditarPessoa";

// Gabinete
import GabinetePastoral from "./pages/GabinetePastoral";
import AtendimentoProntuario from "./pages/gabinete/AtendimentoProntuario";

// Intercessão
import Intercessao from "./pages/Intercessao";
import PedidosOracao from "./pages/intercessao/PedidosOracao";
import Intercessores from "./pages/intercessao/Intercessores";
import Testemunhos from "./pages/intercessao/Testemunhos";
import Sentimentos from "./pages/intercessao/Sentimentos";

// Ministério Kids
import KidsDashboard from "./pages/kids/Dashboard";
import KidsCriancas from "./pages/kids/Criancas";
import KidsScanner from "./pages/kids/Scanner";
import KidsTurmaAtiva from "./pages/kids/TurmaAtiva";
import KidsConfig from "./pages/kids/Config";
import Kids from "./pages/Kids";

// Ensino
import EnsinoDashboard from "./pages/ensino/Dashboard";
import Ensino from "./pages/Ensino";
import Jornadas from "./pages/Jornadas";
import DetalhesJornada from "./pages/ensino/DetalhesJornada";
import JornadaBoard from "./pages/JornadaBoard";
import Ensinamentos from "./pages/Ensinamentos";
import MeusCursos from "./pages/MeusCursos";
import CursoPlayer from "./pages/CursoPlayer";

// Eventos (Hub)
import EventosGeral from "./pages/eventos/Geral";
import EventosLista from "./pages/eventos/Eventos";
import EventosTimes from "./pages/eventos/Times";
import EventosCategorias from "./pages/eventos/Categorias";
import EventosPosicoes from "./pages/eventos/Posicoes";
import EventosTemplates from "./pages/eventos/Templates";
import EventosMidias from "./pages/eventos/MidiasGeral";
import EventosLiturgia from "./pages/eventos/LiturgiaDashboard";
import EventoDetalhes from "./pages/EventoDetalhes";

// Telão & Checkin
import Telao from "./pages/Telao";
import TelaoLiturgia from "./pages/TelaoLiturgia";
import Checkin from "./pages/Checkin";

// Mídias
import Midias from "./pages/Midias";

// Financeiro
import FinancasDashboard from "./pages/financas/Dashboard";
import Financas from "./pages/Financas";
import FinancasEntradas from "./pages/financas/Entradas";
import FinancasSaidas from "./pages/financas/Saidas";
import FinancasContas from "./pages/financas/Contas";
import FinancasCategorias from "./pages/financas/Categorias";
import FinancasCentrosCusto from "./pages/financas/CentrosCusto";
import FinancasFornecedores from "./pages/financas/Fornecedores";
import FinancasBases from "./pages/financas/BasesMinisteriais";
import FinancasFormas from "./pages/financas/FormasPagamento";
import FinancasDRE from "./pages/financas/DRE";
import FinancasRelatorioOferta from "./pages/financas/RelatorioOferta";
import FinancasDashboardOfertas from "./pages/financas/DashboardOfertas";
import FinancasProjecao from "./pages/financas/Projecao";
import FinancasInsights from "./pages/financas/Insights";
import FinancasReembolsos from "./pages/financas/Reembolsos";

// Projetos
import Projetos from "./pages/Projetos";
import ProjetoDetalhes from "./pages/ProjetoDetalhes";

// Admin
import Admin from "./pages/Admin";
import AdminPermissions from "./pages/AdminPermissions";
import AdminWebhooks from "./pages/admin/Webhooks";
import AdminNotificacoes from "./pages/admin/Notificacoes";
import AdminChatbots from "./pages/admin/Chatbots";
import Configuracoes from "./pages/Configuracoes";
import ConfiguracoesIgreja from "./pages/ConfiguracoesIgreja";

const queryClient = new QueryClient();

// ScrollToTop component
const ScrollToTop = () => {
  const { pathname } = useLocation();
  
  // Não rola para o topo em telas de apresentação
  if (pathname.includes('/telao')) return null;

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
            <Route path="/cadastro/visitante" element={<CadastroVisitante />} />
            <Route path="/cadastro/membro" element={<CadastroMembro />} />

            {/* --- ROTAS PROTEGIDAS (MainLayout) --- */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<AuthGate><Dashboard /></AuthGate>} />
              
              {/* Perfil & Família */}
              <Route path="/perfil" element={<AuthGate><Perfil /></AuthGate>} />
              <Route path="/perfil/familia" element={<AuthGate><MinhaFamilia /></AuthGate>} />
              <Route path="/perfil/wallet" element={<AuthGate><FamilyWallet /></AuthGate>} />
              <Route path="/biblia" element={<AuthGate><Biblia /></AuthGate>} />
              <Route path="/agenda" element={<AuthGate><Agenda /></AuthGate>} />
              <Route path="/chamada" element={<AuthGate><Chamada /></AuthGate>} />
              
              {/* Comunicação */}
              <Route path="/publicacao" element={<AuthGate><Publicacao /></AuthGate>} />
              <Route path="/comunicados" element={<AuthGate><Comunicados /></AuthGate>} />
              <Route path="/mural" element={<AuthGate><Announcements /></AuthGate>} />
              <Route path="/admin/mural" element={<AuthGate><AnnouncementsAdmin /></AuthGate>} />

              {/* Pessoas */}
              <Route path="/pessoas" element={<AuthGate><PessoasIndex /></AuthGate>} />
              <Route path="/pessoas/todos" element={<AuthGate><PessoasTodos /></AuthGate>} />
              <Route path="/pessoas/membros" element={<AuthGate><PessoasMembros /></AuthGate>} />
              <Route path="/pessoas/visitantes" element={<AuthGate><PessoasVisitantes /></AuthGate>} />
              <Route path="/pessoas/frequentadores" element={<AuthGate><PessoasFrequentadores /></AuthGate>} />
              <Route path="/pessoas/contatos" element={<AuthGate><PessoasContatos /></AuthGate>} />
              <Route path="/pessoas/pendentes" element={<AuthGate><PessoasAlteracoes /></AuthGate>} />
              <Route path="/pessoas/:id/editar" element={<AuthGate><EditarPessoa /></AuthGate>} />
              <Route path="/pessoas/:id" element={<AuthGate><PessoaDetalhes /></AuthGate>} />

              {/* Gabinete */}
              <Route path="/gabinete" element={<AuthGate><GabinetePastoral /></AuthGate>} />
              <Route path="/gabinete/atendimento/:id" element={<AuthGate><AtendimentoProntuario /></AuthGate>} />

              {/* Intercessão */}
              <Route path="/intercessao" element={<AuthGate><Intercessao /></AuthGate>} />
              <Route path="/intercessao/pedidos" element={<AuthGate><PedidosOracao /></AuthGate>} />
              <Route path="/intercessao/intercessores" element={<AuthGate><Intercessores /></AuthGate>} />
              <Route path="/intercessao/testemunhos" element={<AuthGate><Testemunhos /></AuthGate>} />
              <Route path="/intercessao/sentimentos" element={<AuthGate><Sentimentos /></AuthGate>} />

              {/* Ministério Kids */}
              <Route path="/kids" element={<AuthGate><Kids /></AuthGate>} />
              <Route path="/kids/dashboard" element={<AuthGate><KidsDashboard /></AuthGate>} />
              <Route path="/kids/criancas" element={<AuthGate><KidsCriancas /></AuthGate>} />
              <Route path="/kids/scanner" element={<AuthGate><KidsScanner /></AuthGate>} />
              <Route path="/kids/turma-ativa" element={<AuthGate><KidsTurmaAtiva /></AuthGate>} />
              <Route path="/kids/config" element={<AuthGate><KidsConfig /></AuthGate>} />

              {/* Ensino */}
              <Route path="/ensino" element={<AuthGate><Ensino /></AuthGate>} />
              <Route path="/ensino/dashboard" element={<AuthGate><EnsinoDashboard /></AuthGate>} />
              <Route path="/jornadas" element={<AuthGate><Jornadas /></AuthGate>} />
              <Route path="/jornadas/:id" element={<AuthGate><DetalhesJornada /></AuthGate>} />
              <Route path="/jornadas/:id/board" element={<AuthGate><JornadaBoard /></AuthGate>} />
              <Route path="/ensinamentos" element={<AuthGate><Ensinamentos /></AuthGate>} />
              <Route path="/cursos" element={<AuthGate><MeusCursos /></AuthGate>} />
              <Route path="/cursos/:id/aula/:aulaId" element={<AuthGate><CursoPlayer /></AuthGate>} />

              {/* Eventos & Escalas */}
              <Route path="/eventos" element={<AuthGate><EventosGeral /></AuthGate>} />
              <Route path="/eventos/geral" element={<AuthGate><EventosGeral /></AuthGate>} />
              <Route path="/eventos/lista" element={<AuthGate><EventosLista /></AuthGate>} />
              <Route path="/eventos/times" element={<AuthGate><EventosTimes /></AuthGate>} />
              <Route path="/eventos/categorias" element={<AuthGate><EventosCategorias /></AuthGate>} />
              <Route path="/eventos/posicoes" element={<AuthGate><EventosPosicoes /></AuthGate>} />
              <Route path="/eventos/templates" element={<AuthGate><EventosTemplates /></AuthGate>} />
              <Route path="/eventos/midias" element={<AuthGate><EventosMidias /></AuthGate>} />
              <Route path="/eventos/liturgia" element={<AuthGate><EventosLiturgia /></AuthGate>} />
              <Route path="/eventos/:id" element={<AuthGate><EventoDetalhes /></AuthGate>} />

              {/* Redirects legado de /cultos para /eventos */}
              <Route path="/cultos" element={<AuthGate><Navigate to="/eventos" replace /></AuthGate>} />
              <Route path="/cultos/geral" element={<AuthGate><Navigate to="/eventos/geral" replace /></AuthGate>} />
              <Route path="/cultos/lista" element={<AuthGate><Navigate to="/eventos/lista" replace /></AuthGate>} />
              <Route path="/cultos/liturgia" element={<AuthGate><Navigate to="/eventos/liturgia" replace /></AuthGate>} />
              <Route path="/cultos/:id" element={<AuthGate><EventoDetalhes /></AuthGate>} />
              <Route path="/escalas" element={<AuthGate><Escalas /></AuthGate>} />
              <Route path="/minhas-escalas" element={<AuthGate><MinhasEscalas /></AuthGate>} />

              {/* Mídias */}
              <Route path="/midias" element={<AuthGate><Midias /></AuthGate>} />
              <Route path="/midias/geral" element={<AuthGate><Midias /></AuthGate>} />

              {/* Financeiro */}
              {/* 🥥 PROVA DE CONCEITO RBAC: Bloqueio da rota principal */}
              <Route path="/financas" element={
                <AuthGate requiredPermission="financeiro.view">
                  <Financas />
                </AuthGate>
              } />
              
              <Route path="/financas/dashboard" element={<AuthGate><FinancasDashboard /></AuthGate>} />
              <Route path="/financas/dashboard-ofertas" element={<AuthGate><FinancasDashboardOfertas /></AuthGate>} />
              <Route path="/financas/projecao" element={<AuthGate><FinancasProjecao /></AuthGate>} />
              <Route path="/financas/insights" element={<AuthGate><FinancasInsights /></AuthGate>} />
              <Route path="/financas/entradas" element={<AuthGate><FinancasEntradas /></AuthGate>} />
              <Route path="/financas/saidas" element={<AuthGate><FinancasSaidas /></AuthGate>} />
              <Route path="/financas/contas" element={<AuthGate><FinancasContas /></AuthGate>} />
              <Route path="/financas/reembolsos" element={<AuthGate><FinancasReembolsos /></AuthGate>} />
              <Route path="/financas/categorias" element={<AuthGate><FinancasCategorias /></AuthGate>} />
              <Route path="/financas/centros-custo" element={<AuthGate><FinancasCentrosCusto /></AuthGate>} />
              <Route path="/financas/fornecedores" element={<AuthGate><FinancasFornecedores /></AuthGate>} />
              <Route path="/financas/bases-ministeriais" element={<AuthGate><FinancasBases /></AuthGate>} />
              <Route path="/financas/formas-pagamento" element={<AuthGate><FinancasFormas /></AuthGate>} />
              <Route path="/financas/dre" element={<AuthGate><FinancasDRE /></AuthGate>} />
              <Route path="/financas/relatorios/ofertas" element={<AuthGate><FinancasRelatorioOferta /></AuthGate>} />

              {/* Projetos */}
              <Route path="/projetos" element={<AuthGate><Projetos /></AuthGate>} />
              <Route path="/projetos/:id" element={<AuthGate><ProjetoDetalhes /></AuthGate>} />

              {/* Admin & Configurações */}
              <Route path="/admin" element={<AuthGate><Admin /></AuthGate>} />
              <Route path="/admin/permissoes" element={<AuthGate><AdminPermissions /></AuthGate>} />
              <Route path="/admin/webhooks" element={<AuthGate><AdminWebhooks /></AuthGate>} />
              <Route path="/admin/notificacoes" element={<AuthGate><AdminNotificacoes /></AuthGate>} />
              <Route path="/admin/chatbots" element={<AuthGate><AdminChatbots /></AuthGate>} />
              <Route path="/configuracoes-igreja" element={<AuthGate><ConfiguracoesIgreja /></AuthGate>} />
              <Route path="/configuracoes" element={<AuthGate><Configuracoes /></AuthGate>} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;