import { NavLink } from "@/components/NavLink";
import {
  Home,
  Users,
  MessageCircle,
  Heart,
  Calendar,
  DollarSign,
  BookOpen,
  UserPlus,
  Megaphone,
  Baby,
  Shield,
  PhoneCall,
  UsersRound,
  HandHeart,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Building2,
  Target,
  FolderTree,
  UserCog,
  Church,
  LayoutDashboard,
  BarChart3,
  Settings,
  Image,
  PieChart,
  LineChart,
  TrendingUpIcon,
  ClipboardCheck,
  Route,
  FolderKanban,
  GraduationCap,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarCheck } from "lucide-react";
const menuItems = [
  {
    icon: Home,
    label: "Dashboard",
    path: "/",
  },
  {
    icon: CalendarCheck,
    label: "Minhas Escalas",
    path: "/minhas-escalas",
  },
  {
    icon: ClipboardCheck,
    label: "Chamada Rápida",
    path: "/chamada",
  },
  {
    icon: Megaphone,
    label: "Comunicação",
    path: "/publicacao",
  },
  {
    icon: FolderKanban,
    label: "Projetos",
    path: "/projetos",
  },
  {
    icon: BookOpen,
    label: "Meus Cursos",
    path: "/cursos",
  },
];
const pessoasItems = [
  {
    icon: UsersRound,
    label: "Geral",
    path: "/pessoas",
  },
  {
    icon: Users,
    label: "Membros",
    path: "/pessoas/membros",
  },
  {
    icon: UserPlus,
    label: "Visitantes",
    path: "/pessoas/visitantes",
  },
  {
    icon: PhoneCall,
    label: "Contatos Agendados",
    path: "/pessoas/contatos",
  },
  {
    icon: Route,
    label: "Jornadas",
    path: "/jornadas",
  },
];
const intercessaoItems = [
  {
    icon: HandHeart,
    label: "Geral",
    path: "/intercessao",
  },
  {
    icon: MessageCircle,
    label: "Pedidos de Oração",
    path: "/intercessao/pedidos",
  },
  {
    icon: Users,
    label: "Intercessores",
    path: "/intercessao/intercessores",
  },
  {
    icon: Heart,
    label: "Testemunhos",
    path: "/intercessao/testemunhos",
  },
  {
    icon: Heart,
    label: "Sentimentos",
    path: "/intercessao/sentimentos",
  },
];

const financasItems = [
  {
    icon: DollarSign,
    label: "Geral",
    path: "/financas",
  },
];
const financasConfigItems = [
  {
    icon: Target,
    label: "Bases Ministeriais",
    path: "/financas/bases-ministeriais",
  },
  {
    icon: Target,
    label: "Centros de Custo",
    path: "/financas/centros-custo",
  },
  {
    icon: FolderTree,
    label: "Categorias",
    path: "/financas/categorias",
  },
  {
    icon: UserCog,
    label: "Fornecedores",
    path: "/financas/fornecedores",
  },
];
const financasMovimentaItems = [
  {
    icon: TrendingUp,
    label: "Entradas",
    path: "/financas/entradas",
  },
  {
    icon: TrendingDown,
    label: "Saídas",
    path: "/financas/saidas",
  },
  {
    icon: Building2,
    label: "Contas",
    path: "/financas/contas",
  },
];
const financasPaineisItems = [
  {
    icon: BarChart3,
    label: "Dashboard Geral",
    path: "/financas/dashboard",
  },
  {
    icon: PieChart,
    label: "Dashboard de Ofertas",
    path: "/financas/dashboard-ofertas",
  },
  {
    icon: LineChart,
    label: "Projeção",
    path: "/financas/projecao",
  },
  {
    icon: TrendingUpIcon,
    label: "Insights",
    path: "/financas/insights",
  },
];
const cultosItems = [
  {
    icon: LayoutDashboard,
    label: "Geral",
    path: "/cultos/geral",
  },
  {
    icon: Calendar,
    label: "Eventos",
    path: "/cultos/eventos",
  },
  {
    icon: Users,
    label: "Times",
    path: "/cultos/times",
  },
  {
    icon: Target,
    label: "Categorias",
    path: "/cultos/categorias",
  },
  {
    icon: UserCog,
    label: "Posições",
    path: "/cultos/posicoes",
  },
  {
    icon: Image,
    label: "Mídias",
    path: "/cultos/midias",
  },
  {
    icon: ClipboardCheck,
    label: "Escalas Mensais",
    path: "/escalas",
  },
];

const midiasItems = [
  {
    icon: Image,
    label: "Geral",
    path: "/midias",
  },
  {
    icon: Image,
    label: "Gerenciar",
    path: "/midias/geral",
  },
];
const modulosItems = [
  {
    icon: GraduationCap,
    label: "Ensino",
    path: "/ensino",
  },
  {
    icon: Baby,
    label: "Kids",
    path: "/kids",
  },
  {
    icon: Settings,
    label: "Configurações",
    path: "/configuracoes-igreja",
  },
  {
    icon: Shield,
    label: "Administração",
    path: "/admin",
  },
];
export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [igrejaConfig, setIgrejaConfig] = useState({
    nome: "Igreja App",
    subtitulo: "Gestão Completa",
    logoUrl: null as string | null,
  });

  useEffect(() => {
    loadIgrejaConfig();
  }, []);

  const loadIgrejaConfig = async () => {
    try {
      const { data, error } = await supabase.from("configuracoes_igreja").select("*").single();

      if (error) throw error;

      if (data) {
        setIgrejaConfig({
          nome: data.nome_igreja,
          subtitulo: data.subtitulo || "Gestão Completa",
          logoUrl: data.logo_url,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-6 border-b border-sidebar-border">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              {igrejaConfig.logoUrl && (
                <img src={igrejaConfig.logoUrl} alt="Logo da Igreja" className="w-12 h-12 object-contain rounded-lg" />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-sidebar-foreground truncate">{igrejaConfig.nome}</h1>
                <p className="text-sm text-sidebar-foreground/70 mt-1 truncate">{igrejaConfig.subtitulo}</p>
              </div>
            </div>
          )}
          {isCollapsed &&
            (igrejaConfig.logoUrl ? (
              <img src={igrejaConfig.logoUrl} alt="Logo" className="w-8 h-8 mx-auto object-contain" />
            ) : (
              <h1 className="text-xl font-bold text-sidebar-foreground text-center">IA</h1>
            ))}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <NavLink
                        to={item.path}
                        end
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      >
                        <Icon className="w-5 h-5" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Pessoas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Pessoas">
                      <Users className="w-5 h-5" />
                      {!isCollapsed && (
                        <>
                          <span>Pessoas</span>
                          <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {pessoasItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <SidebarMenuSubItem key={item.path}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={item.path}
                                end
                                className="hover:bg-sidebar-accent"
                                activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              >
                                <Icon className="w-4 h-4 text-white" />
                                {!isCollapsed && <span>{item.label}</span>}
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Intercessão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Intercessão">
                      <HandHeart className="w-5 h-5" />
                      {!isCollapsed && (
                        <>
                          <span>Intercessão</span>
                          <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {intercessaoItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <SidebarMenuSubItem key={item.path}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={item.path}
                                end
                                className="hover:bg-sidebar-accent"
                                activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              >
                                <Icon className="w-4 h-4 text-white" />
                                {!isCollapsed && <span>{item.label}</span>}
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Finanças</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Finanças">
                      <DollarSign className="w-5 h-5" />
                      {!isCollapsed && (
                        <>
                          <span>Finanças</span>
                          <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {/* Geral */}
                      {financasItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <SidebarMenuSubItem key={item.path}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={item.path}
                                end
                                className="hover:bg-sidebar-accent"
                                activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              >
                                <Icon className="w-4 h-4 text-white" />
                                {!isCollapsed && <span>{item.label}</span>}
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}

                      {/* Painéis submenu */}
                      <Collapsible defaultOpen className="group/paineis">
                        <SidebarMenuSubItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton>
                              <BarChart3 className="w-4 h-4 text-white" />
                              {!isCollapsed && (
                                <>
                                  <span>Painéis</span>
                                  <ChevronDown className="ml-auto transition-transform group-data-[state=open]/paineis:rotate-180" />
                                </>
                              )}
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {financasPaineisItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                  <SidebarMenuSubItem key={item.path}>
                                    <SidebarMenuSubButton asChild>
                                      <NavLink
                                        to={item.path}
                                        end
                                        className="hover:bg-sidebar-accent pl-8"
                                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                                      >
                                        <Icon className="w-4 h-4 text-white" />
                                        {!isCollapsed && <span className="text-xs">{item.label}</span>}
                                      </NavLink>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuSubItem>
                      </Collapsible>

                      {/* Movimentações submenu */}
                      <Collapsible defaultOpen className="group/movimenta">
                        <SidebarMenuSubItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton>
                              <TrendingUp className="w-4 h-4 text-white" />
                              {!isCollapsed && (
                                <>
                                  <span>Movimentações</span>
                                  <ChevronDown className="ml-auto transition-transform group-data-[state=open]/movimenta:rotate-180" />
                                </>
                              )}
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {financasMovimentaItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                  <SidebarMenuSubItem key={item.path}>
                                    <SidebarMenuSubButton asChild>
                                      <NavLink
                                        to={item.path}
                                        end
                                        className="hover:bg-sidebar-accent pl-8"
                                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                                      >
                                        <Icon className="w-4 h-4 text-white" />
                                        {!isCollapsed && <span className="text-xs">{item.label}</span>}
                                      </NavLink>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuSubItem>
                      </Collapsible>

                      {/* Configurações submenu */}
                      <Collapsible defaultOpen className="group/config">
                        <SidebarMenuSubItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton>
                              <Settings className="w-4 h-4 text-white" />
                              {!isCollapsed && (
                                <>
                                  <span>Configurações</span>
                                  <ChevronDown className="ml-auto transition-transform group-data-[state=open]/config:rotate-180" />
                                </>
                              )}
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {financasConfigItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                  <SidebarMenuSubItem key={item.path}>
                                    <SidebarMenuSubButton asChild>
                                      <NavLink
                                        to={item.path}
                                        end
                                        className="hover:bg-sidebar-accent pl-8"
                                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                                      >
                                        <Icon className="w-4 h-4 text-white" />
                                        {!isCollapsed && <span className="text-xs">{item.label}</span>}
                                      </NavLink>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuSubItem>
                      </Collapsible>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Cultos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Cultos">
                      <Church className="w-5 h-5" />
                      {!isCollapsed && (
                        <>
                          <span>Cultos</span>
                          <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {cultosItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <SidebarMenuSubItem key={item.path}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={item.path}
                                end
                                className="hover:bg-sidebar-accent"
                                activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              >
                                <Icon className="w-4 h-4 text-white" />
                                {!isCollapsed && <span>{item.label}</span>}
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Mídias</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Mídias">
                      <Image className="w-5 h-5" />
                      {!isCollapsed && (
                        <>
                          <span>Mídias</span>
                          <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {midiasItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <SidebarMenuSubItem key={item.path}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={item.path}
                                end
                                className="hover:bg-sidebar-accent"
                                activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              >
                                <Icon className="w-4 h-4 text-white" />
                                {!isCollapsed && <span>{item.label}</span>}
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modulosItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <NavLink
                        to={item.path}
                        end
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      >
                        <Icon className="w-5 h-5" />
                        {!isCollapsed && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 border-t border-sidebar-border">
          {!isCollapsed && (
            <div className="px-4 py-2">
              <p className="text-xs text-sidebar-foreground/60">v1.0.0</p>
            </div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
