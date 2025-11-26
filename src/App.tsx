import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Membros from "./pages/Membros";
import Visitantes from "./pages/Visitantes";
import Oracoes from "./pages/Oracoes";
import Testemunhos from "./pages/Testemunhos";
import Cultos from "./pages/Cultos";
import Financas from "./pages/Financas";
import Ensinamentos from "./pages/Ensinamentos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/membros" element={<Membros />} />
            <Route path="/visitantes" element={<Visitantes />} />
            <Route path="/oracoes" element={<Oracoes />} />
            <Route path="/testemunhos" element={<Testemunhos />} />
            <Route path="/cultos" element={<Cultos />} />
            <Route path="/financas" element={<Financas />} />
            <Route path="/ensinamentos" element={<Ensinamentos />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
