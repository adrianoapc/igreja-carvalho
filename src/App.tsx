import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import MainLayout from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Banners from "./pages/Banners";
import Pessoas from "./pages/pessoas";
import PessoaDetalhes from "./pages/PessoaDetalhes";
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
import Midias from "./pages/Midias";
import Financas from "./pages/Financas";
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
import Ensinamentos from "./pages/Ensinamentos";
import ConfiguracoesIgreja from "./pages/ConfiguracoesIgreja";
import Auth from "./pages/Auth";
import Public from "./pages/Public";
import Announcements from "./pages/Announcements";
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
import { useAuth } from "./hooks/useAuth";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, isMember } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isMember) {
    return <Navigate to="/public" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/public" element={<Public />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/biblia" element={<Biblia />} />
          <Route path="/install" element={<Install />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* Rotas públicas de cadastro externo */}
          <Route path="/cadastro" element={<CadastroIndex />} />
          <Route path="/cadastro/visitante" element={<CadastroVisitante />} />
          <Route path="/cadastro/membro" element={<CadastroMembro />} />
          
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
            path="/banners"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Banners />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
