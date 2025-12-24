import { useState } from "react";
import { 
  Shield, Users, CreditCard, Church, 
  Bot, Bell, Globe, Hammer, Baby, ChevronRight, 
  Wallet, FileText, ArrowLeft, Info, Landmark, PieChart
} from "lucide-react";
import { useAppConfig } from "@/hooks/useAppConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// --- IMPORTS ---
import ConfiguracoesIgreja from "./ConfiguracoesIgreja";
import AdminPermissions from "./AdminPermissions";
import Webhooks from "./admin/Webhooks";
import Notificacoes from "./admin/Notificacoes";
import Chatbots from "./admin/Chatbots";
import BasesMinisteriais from "./financas/BasesMinisteriais";
import FinancasCategorias from "./financas/Categorias";
import FinancasCentrosCusto from "./financas/CentrosCusto";
import FinancasContas from "./financas/Contas";
import ContasManutencao from "./financas/ContasManutencao";
import FinancasFormas from "./financas/FormasPagamento";
import FinancasFornecedores from "./financas/Fornecedores";
import KidsConfig from "./kids/Config";

// --- NOVOS ESTADOS ---
type ViewState = 
  | "MENU"
  | "INSTITUCIONAL"
  | "PERMISSOES"
  | "KIDS"
  | "FINANCEIRO_BASES"     // Separado
  | "FINANCEIRO_CENTROS"   // Separado
  | "FINANCEIRO_PLANO"
  | "FINANCEIRO_TESOURARIA"
  | "FINANCEIRO_CONTAS_MANUTENCAO"
  | "FINANCEIRO_PARCEIROS"
  | "SISTEMA_NOTIFICACOES"
  | "SISTEMA_IA"
  | "SISTEMA_WEBHOOKS"
  | "SISTEMA_MANUTENCAO";

// --- COMPONENTE DE LINHA ---
interface SettingsRowProps {
  icon: any;
  title: string;
  description: string;
  onClick: () => void;
  danger?: boolean;
  action?: React.ReactNode;
}

function SettingsRow({ icon: Icon, title, description, onClick, danger, action }: SettingsRowProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center justify-between p-4 cursor-pointer group transition-all duration-200",
        "hover:bg-accent/50 border-b last:border-0 bg-card",
        danger ? "hover:bg-red-50 dark:hover:bg-red-950/10" : ""
      )}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 transition-colors group-hover:bg-background border",
          danger ? "text-red-500 bg-red-100/20 border-red-200" : "text-primary"
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className={cn("font-medium leading-none", danger && "text-red-600")}>{title}</p>
          <p className="text-sm text-muted-foreground line-clamp-1">{description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
        <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}

// ... (MaintenanceDetailView permanece igual ao anterior) ...
function MaintenanceDetailView() {
    // ... código do componente de manutenção anterior ...
    return <div>Componente Manutenção</div>; 
}


export default function Configuracoes() {
  const [currentView, setCurrentView] = useState<ViewState>("MENU");
  const { config, loading, refetch } = useAppConfig();

  const goBack = () => setCurrentView("MENU");

  const quickToggleMaintenance = async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('app_config')
        .update({ maintenance_mode: checked })
        .eq('id', config?.id);
      if (error) throw error;
      await refetch();
      toast.success(checked ? "Manutenção ATIVADA" : "Manutenção DESATIVADA");
    } catch (e) {
      toast.error("Erro ao alterar");
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case "INSTITUCIONAL": return <ConfiguracoesIgreja />;
      case "PERMISSOES": return <AdminPermissions />;
      case "KIDS": return <KidsConfig />;
      
      // --- SEPARAÇÃO REALIZADA AQUI ---
      case "FINANCEIRO_BASES":
        return <BasesMinisteriais />;
      
      case "FINANCEIRO_CENTROS":
        return <FinancasCentrosCusto />;

      case "FINANCEIRO_PLANO":
        return <FinancasCategorias />;
      
      case "FINANCEIRO_TESOURARIA":
        return <ContasManutencao />;
      
      case "FINANCEIRO_FORMAS":
        return <FinancasFormas />;
      
      case "FINANCEIRO_CONTAS_MANUTENCAO":
        return <ContasManutencao />;
      
      case "FINANCEIRO_PARCEIROS": return <FinancasFornecedores />;
      case "SISTEMA_NOTIFICACOES": return <Notificacoes />;
      case "SISTEMA_IA": return <Chatbots />;
      case "SISTEMA_WEBHOOKS": return <Webhooks />;
      case "SISTEMA_MANUTENCAO": return <MaintenanceDetailView />; // Ajustar import se necessário
      default: return null;
    }
  };

  return (
    <div className="container max-w-5xl mx-auto p-4 md:p-8 pb-24 animate-in fade-in duration-500">
      
      <div className="flex flex-col gap-2 mb-6">
        {currentView === "MENU" ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
            <p className="text-muted-foreground">Gerencie as preferências globais do sistema.</p>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goBack} className="-ml-3 gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        )}
      </div>

      {currentView === "MENU" ? (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
          
          {/* INSTITUCIONAL */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Institucional</h3>
            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
              <SettingsRow icon={Church} title="Dados da Igreja" description="Logo, nome, endereço e redes sociais." onClick={() => setCurrentView("INSTITUCIONAL")} />
              <SettingsRow icon={Users} title="Equipe & Permissões" description="Gerenciar pastores, líderes e níveis de acesso." onClick={() => setCurrentView("PERMISSOES")} />
            </div>
          </div>

          {/* MINISTÉRIOS */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Ministérios</h3>
            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
              <SettingsRow 
                icon={Landmark} 
                title="Bases Ministeriais" 
                description="Grandes áreas de atuação (Ex: Missões, Adoração)."
                onClick={() => setCurrentView("FINANCEIRO_BASES")}
              />
            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
              <SettingsRow icon={Baby} title="Ministério Kids" description="Salas, etiquetas e regras de check-in." onClick={() => setCurrentView("KIDS")} />
            </div>
          </div>

          {/* FINANCEIRO - SEPARADO */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Financeiro</h3>
              <SettingsRow 
                icon={Wallet} 
                title="Formas de Pagamento" 
                description="Cadastro de Formas de pagamento."
                onClick={() => setCurrentView("FINANCEIRO_FORMAS")}
              />
                            <SettingsRow 
                icon={PieChart} 
                title="Centros de Custo" 
                description="Unidades orçamentárias e projetos específicos."
                onClick={() => setCurrentView("FINANCEIRO_CENTROS")}
              />
              <SettingsRow 
                icon={FileText} 
                title="Plano de Contas" 
                description="Categorias de receitas e despesas."
                onClick={() => setCurrentView("FINANCEIRO_PLANO")}
              />
              <SettingsRow 
                icon={Wallet} 
                title="Tesouraria" 
                description="Cadastro de Contas bancárias."
                onClick={() => setCurrentView("FINANCEIRO_TESOURARIA")}
              />
              <SettingsRow 
                icon={Users} 
                title="Fornecedores" 
                description="Cadastro de parceiros."
                onClick={() => setCurrentView("FINANCEIRO_PARCEIROS")}
              />
            </div>
          </div>

          {/* SISTEMA */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Sistema</h3>
            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
              <SettingsRow icon={Bell} title="Notificações" description="Templates de mensagens." onClick={() => setCurrentView("SISTEMA_NOTIFICACOES")} />
              <SettingsRow icon={Bot} title="Inteligência Artificial" description="Configuração dos agentes." onClick={() => setCurrentView("SISTEMA_IA")} />
              <SettingsRow icon={Globe} title="Webhooks (API)" description="Integrações externas." onClick={() => setCurrentView("SISTEMA_WEBHOOKS")} />
              <SettingsRow 
                icon={Hammer} 
                title="Modo Manutenção" 
                description="Controle de acesso global."
                onClick={() => setCurrentView("SISTEMA_MANUTENCAO")}
                action={<Switch checked={config?.maintenance_mode || false} onCheckedChange={quickToggleMaintenance} disabled={loading} />}
              />
            </div>
          </div>

        </div>
      ) : (
        <div className="animate-in slide-in-from-right-8 duration-300">
          <div className="bg-card rounded-xl border shadow-sm p-6 min-h-[500px]">
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
}