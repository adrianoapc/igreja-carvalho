import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  Target, 
  Layers, 
  FolderTree, 
  Users,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Financas() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  
  const isActive = (path: string) => {
    if (path === '/financas' && location.pathname === '/financas') return true;
    if (path !== '/financas' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    { path: '/financas', label: 'Geral', icon: DollarSign },
    { path: '/financas/entradas', label: 'Entradas', icon: TrendingUp },
    { path: '/financas/saidas', label: 'Saídas', icon: TrendingDown },
    { path: '/financas/contas', label: 'Contas', icon: Building2 },
    { path: '/financas/bases-ministeriais', label: 'Bases Ministeriais', icon: Target },
    { path: '/financas/centros-custo', label: 'Centros de Custo', icon: Layers },
    { path: '/financas/categorias', label: 'Categorias', icon: FolderTree },
    { path: '/financas/fornecedores', label: 'Fornecedores', icon: Users },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 h-full">
      {/* Sidebar de Navegação */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="bg-card border border-border rounded-lg p-3 md:p-4 shadow-soft">
          <Button
            variant="ghost"
            className="w-full justify-between mb-2"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span className="font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Finanças
            </span>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
          
          {isExpanded && (
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start",
                      isActive(item.path) && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
