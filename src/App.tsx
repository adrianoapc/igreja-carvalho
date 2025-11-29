import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import Kids from "./pages/Kids";
import Intercessao from "./pages/Intercessao";
import PedidosOracao from "./pages/intercessao/PedidosOracao";
import Intercessores from "./pages/intercessao/Intercessores";
import TestemunhosIntercessao from "./pages/intercessao/Testemunhos";
import Sentimentos from "./pages/intercessao/Sentimentos";
import Cultos from "./pages/Cultos";
import Financas from "./pages/Financas";
import FinancasDashboard from "./pages/financas/Dashboard";
import Entradas from "./pages/financas/Entradas";
import Saidas from "./pages/financas/Saidas";
import Contas from "./pages/financas/Contas";
import BasesMinisteriais from "./pages/financas/BasesMinisteriais";
import CentrosCusto from "./pages/financas/CentrosCusto";
import Categorias from "./pages/financas/Categorias";
import Fornecedores from "./pages/financas/Fornecedores";
import Ensinamentos from "./pages/Ensinamentos";
import Auth from "./pages/Auth";
import Public from "./pages/Public";
import Announcements from "./pages/Announcements";
import FirstAdmin from "./pages/FirstAdmin";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/public" element={<Public />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/first-admin" element={<FirstAdmin />} />
          
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
}

export default App;
