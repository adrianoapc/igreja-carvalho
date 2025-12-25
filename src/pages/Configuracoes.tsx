import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Bell,
  Bot,
  Building2,
  ChevronRight,
  CreditCard,
  DollarSign,
  FileText,
  LayoutList,
  Settings,
  Shield,
  Users,
  Webhook,
} from "lucide-react";
import { useAppConfig } from "@/hooks/useAppConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Sub-pages
import BasesMinisteriais from "@/pages/financas/BasesMinisteriais";
import Categorias from "@/pages/financas/Categorias";
import CentrosCusto from "@/pages/financas/CentrosCusto";
import FormasPagamento from "@/pages/financas/FormasPagamento";
import Fornecedores from "@/pages/financas/Fornecedores";
import ConfiguracoesIgreja from "@/pages/ConfiguracoesIgreja";
import AdminPermissions from "@/pages/AdminPermissions";
import Webhooks from "@/pages/admin/Webhooks";
import Chatbots from "@/pages/admin/Chatbots";
import Notificacoes from "@/pages/admin/Notificacoes";
import ContasManutencao from "@/pages/financas/ContasManutencao";

type ViewState =
  | "MENU"
  | "IGREJA"
  | "PERMISSOES"
  | "WEBHOOKS"
  | "CHATBOTS"
  | "NOTIFICACOES"
  | "FINANCEIRO_BASES"
  | "FINANCEIRO_CATEGORIAS"
  | "FINANCEIRO_CENTROS"
  | "FINANCEIRO_CONTAS"
  | "FINANCEIRO_FORMAS"
  | "FINANCEIRO_FORNECEDORES";

type ConfigItem = {
  id: ViewState;
  title: string;
  description: string;
  icon: React.ElementType;
};

const GERAL_ITEMS: ConfigItem[] = [
  { id: "IGREJA", title: "Dados da Igreja", description: "Nome, logo e informações de contato", icon: Building2 },
  { id: "PERMISSOES", title: "Permissões de Acesso", description: "Funções e acessos por módulo", icon: Shield },
  { id: "NOTIFICACOES", title: "Notificações", description: "Regras e canais de notificação", icon: Bell },
  { id: "WEBHOOKS", title: "Webhooks", description: "Integrações externas (Make, etc.)", icon: Webhook },
  { id: "CHATBOTS", title: "Chatbots IA", description: "Configuração de agentes de IA", icon: Bot },
];

const FINANCEIRO_ITEMS: ConfigItem[] = [
  { id: "FINANCEIRO_BASES", title: "Bases Ministeriais", description: "Unidades de receita e despesa", icon: Users },
  { id: "FINANCEIRO_CATEGORIAS", title: "Categorias Financeiras", description: "Tipos de receita/despesa", icon: LayoutList },
  { id: "FINANCEIRO_CENTROS", title: "Centros de Custo", description: "Classificação por centro", icon: FileText },
  { id: "FINANCEIRO_CONTAS", title: "Contas Bancárias", description: "Caixa, bancos e carteiras", icon: CreditCard },
  { id: "FINANCEIRO_FORMAS", title: "Formas de Pagamento", description: "Dinheiro, PIX, cartão…", icon: DollarSign },
  { id: "FINANCEIRO_FORNECEDORES", title: "Fornecedores", description: "Cadastro de fornecedores", icon: Users },
];

// Wrapper component to add back button
function SubPageWrapper({ children, onBack, title }: { children: React.ReactNode; onBack: () => void; title: string }) {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        {children}
      </div>
    </MainLayout>
  );
}

export default function Configuracoes() {
  const [currentView, setCurrentView] = useState<ViewState>("MENU");
  const { config, isLoading, refetch } = useAppConfig();

  const goBack = () => setCurrentView("MENU");

  const quickToggleMaintenance = async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('app_config')
        .update({ maintenance_mode: checked })
        .eq('id', 1);
      if (error) throw error;
      await refetch();
      toast.success(checked ? "Manutenção ATIVADA" : "Manutenção DESATIVADA");
    } catch (e) {
      toast.error("Erro ao alterar");
    }
  };

  // Render sub-pages with onBack prop where supported
  if (currentView === "FINANCEIRO_BASES") return <BasesMinisteriais />;
  if (currentView === "FINANCEIRO_CATEGORIAS") return <Categorias onBack={goBack} />;
  if (currentView === "FINANCEIRO_CENTROS") return <CentrosCusto onBack={goBack} />;
  if (currentView === "FINANCEIRO_CONTAS") return <ContasManutencao onBack={goBack} />;
  if (currentView === "FINANCEIRO_FORMAS") return <FormasPagamento onBack={goBack} />;
  if (currentView === "FINANCEIRO_FORNECEDORES") return <Fornecedores onBack={goBack} />;
  
  // Pages without onBack - render as-is (they have their own navigation)
  if (currentView === "IGREJA") return <ConfiguracoesIgreja />;
  if (currentView === "PERMISSOES") return <AdminPermissions />;
  if (currentView === "WEBHOOKS") return <Webhooks />;
  if (currentView === "CHATBOTS") return <Chatbots />;
  if (currentView === "NOTIFICACOES") return <Notificacoes />;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
            <p className="text-muted-foreground">Gerencie as configurações do sistema</p>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="maintenance-toggle" className="text-sm text-muted-foreground">
              Modo Manutenção
            </Label>
            <Switch
              id="maintenance-toggle"
              checked={config?.maintenance_mode ?? false}
              onCheckedChange={quickToggleMaintenance}
              disabled={isLoading}
            />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Geral
            </CardTitle>
            <CardDescription>Configurações principais do sistema</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {GERAL_ITEMS.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className="w-full justify-between h-auto py-3 px-4"
                onClick={() => setCurrentView(item.id)}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financeiro
            </CardTitle>
            <CardDescription>Configurações do módulo financeiro</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {FINANCEIRO_ITEMS.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className="w-full justify-between h-auto py-3 px-4"
                onClick={() => setCurrentView(item.id)}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
