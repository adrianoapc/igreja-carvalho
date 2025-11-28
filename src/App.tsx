import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Banners from "./pages/Banners";
import Pessoas from "./pages/Pessoas";
import PessoaDetalhes from "./pages/PessoaDetalhes";
import TodosPessoas from "./pages/TodosPessoas";
import Frequentadores from "./pages/Frequentadores";
import Membros from "./pages/Membros";
import Visitantes from "./pages/Visitantes";
import ContatosDashboard from "./pages/ContatosDashboard";
import Kids from "./pages/Kids";
import Oracoes from "./pages/Oracoes";
import Testemunhos from "./pages/Testemunhos";
import Cultos from "./pages/Cultos";
import Financas from "./pages/Financas";
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
            path="/membros"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Membros />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/visitantes"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Visitantes />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contatos"
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
            path="/oracoes"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Oracoes />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/testemunhos"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Testemunhos />
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
