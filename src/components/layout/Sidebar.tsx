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
  UsersIcon,
  Book,
  ScanLine,
  WalletCards,
  Presentation,
  FileText,
  Cog,
  Receipt,
  Bell,
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
import { useAuth } from "@/hooks/useAuth";

type AppRole = 'admin' | 'pastor' | 'lider' | 'secretario' | 'tesoureiro' | 'membro' | 'basico';

// Roles que têm acesso administrativo completo
const ADMIN_ROLES: AppRole[] = ['admin', 'pastor', 'lider', 'secretario', 'tesoureiro'];

// Itens do menu principal - alguns são para todos, outros apenas admin
const menuItems = [
  {
    icon: Home,
    label: "Dashboard",
    path: "/",
    adminOnly: false,
  },
  {
    icon: CalendarCheck,
    label: "Minhas Escalas",
    path: "/minhas-escalas",
    adminOnly: false,
  },
  {
    icon: ClipboardCheck,
    label: "Chamada Rápida",
    path: "/chamada",
    adminOnly: true,
  },
  {
    icon: Megaphone,
    label: "Comunicação",
    path: "/publicacao",
    adminOnly: true,
  },
  {
    icon: FolderKanban,
    label: "Projetos",
    path: "/projetos",
    adminOnly: true,
  },
  {
    icon: BookOpen,
    label: "Meus Cursos",
    path: "/cursos",
    adminOnly: false,
  },
];

// Itens exclusivos para membros comuns
const memberOnlyItems = [
  {
    icon: WalletCards,
    label: "Carteira da Família",
    path: "/perfil/familia",
  },
  {
    icon: MessageCircle,
    label: "Pedidos de Oração",
    path: "/intercessao/pedidos",
  },
  {
    icon: Book,
    label: "Bíblia",
    path: "/biblia",
  },
];

// Itens do Ministério Kids (apenas para líderes/admin)
const kidsItems = [
  {
    icon: LayoutDashboard,
    label: "Visão Geral",
    path: "/kids/dashboard",
  },
  {
    icon: Users,
    label: "Crianças",
    path: "/kids/criancas",
  },
  {
    icon: ScanLine,
    label: "Totem de Check-in",
    path: "/kids/scanner",
  },
  {
    icon: BookOpen,
    label: "Diário de Classe",
    path: "/kids/turma-ativa",
  },
  {
    icon: Baby,
    label: "Salas & Turmas",
    path: "/kids",
  },
  {
    icon: Settings,
    label: "Configurar Salas",
    path: "/ensino?tab=config",
  },
];

// Itens do Módulo de Ensino (apenas para líderes/admin)
const ensinoItems = [
  {
    icon: LayoutDashboard,
    label: "Visão Geral",
    path: "/ensino/dashboard",
  },
  {
    icon: Presentation,
    label: "Aulas & Cronograma",
    path: "/ensino",
  },
  {
    icon: FileText,
    label: "Materiais",
    path: "/jornadas",
  },
];

// Itens do Módulo Administrativo (apenas para admin)
const administrativoItems = [
  {
    icon: Cog,
    label: "Configurações da Igreja",
    path: "/configuracoes-igreja",
  },
  {
    icon: Shield,
    label: "Gestão de Acesso",
    path: "/admin",
  },
  {
    icon: Bell,
    label: "Notificações",
    path: "/admin/notificacoes",
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
    icon: Receipt,
    label: "Reembolsos",
    path: "/financas/reembolsos",
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


export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user, profile } = useAuth();

  const [igrejaConfig, setIgrejaConfig] = useState({
    nome: "Igreja App",
    subtitulo: "Gestão Completa",
    logoUrl: null as string | null,
  });
  
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    loadIgrejaConfig();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchUserRoles();
    } else {
      setUserRoles([]);
      setRolesLoading(false);
    }
  }, [user?.id]);

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

      if (error) throw error;
      
      const roles = data?.map(r => r.role as AppRole) || [];
      setUserRoles(roles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    } finally {
      setRolesLoading(false);
    }
  };

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

  // Verifica se o usuário tem alguma role administrativa
  const isAdminUser = userRoles.some(role => ADMIN_ROLES.includes(role));
  const isVisitante = profile?.status === "visitante";
  
  // Filtra menu items baseado no perfil
  const filteredMenuItems = menuItems.filter(item => {
    if (item.adminOnly) return isAdminUser;
    return true;
  });

  // Se for visitante, mostra apenas itens limitados
  if (isVisitante && !rolesLoading) {
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
            <SidebarGroupLabel>Menu Visitante</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Início">
                    <NavLink
                      to="/"
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    >
                      <Home className="w-5 h-5" />
                      {!isCollapsed && <span>Início</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Minha Família / Kids */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Minha Família">
                    <NavLink
                      to="/perfil/familia"
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    >
                      <Baby className="w-5 h-5" />
                      {!isCollapsed && <span>Minha Família</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Agenda */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Agenda">
                    <NavLink
                      to="/agenda"
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    >
                      <Calendar className="w-5 h-5" />
                      {!isCollapsed && <span>Agenda</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    );
  }

  // Se não for admin, mostra apenas itens de membro
  if (!isAdminUser && !rolesLoading) {
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
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Dashboard">
                    <NavLink
                      to="/"
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    >
                      <Home className="w-5 h-5" />
                      {!isCollapsed && <span>Dashboard</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Minha Família */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Minha Família">
                    <NavLink
                      to="/perfil/familia"
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    >
                      <UsersIcon className="w-5 h-5" />
                      {!isCollapsed && <span>Minha Família</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Pedidos de Oração */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Pedidos de Oração">
                    <NavLink
                      to="/intercessao/pedidos"
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    >
                      <MessageCircle className="w-5 h-5" />
                      {!isCollapsed && <span>Pedidos de Oração</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Bíblia */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Bíblia">
                    <NavLink
                      to="/biblia"
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    >
                      <Book className="w-5 h-5" />
                      {!isCollapsed && <span>Bíblia</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Meus Cursos */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Meus Cursos">
                    <NavLink
                      to="/cursos"
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    >
                      <BookOpen className="w-5 h-5" />
                      {!isCollapsed && <span>Meus Cursos</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Minhas Escalas */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Minhas Escalas">
                    <NavLink
                      to="/minhas-escalas"
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    >
                      <CalendarCheck className="w-5 h-5" />
                      {!isCollapsed && <span>Minhas Escalas</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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

  // Sidebar completa para admins
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
              {filteredMenuItems.map((item) => {
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
          <SidebarGroupLabel>Ministério Kids</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Kids">
                      <Baby className="w-5 h-5" />
                      {!isCollapsed && (
                        <>
                          <span>Kids</span>
                          <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {kidsItems.map((item) => {
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
          <SidebarGroupLabel>Ministério de Ensino</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Ensino">
                      <GraduationCap className="w-5 h-5" />
                      {!isCollapsed && (
                        <>
                          <span>Ensino</span>
                          <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {ensinoItems.map((item) => {
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
          <SidebarGroupLabel>Administrativo</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Administrativo">
                      <Shield className="w-5 h-5" />
                      {!isCollapsed && (
                        <>
                          <span>Administrativo</span>
                          <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {administrativoItems.map((item) => {
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
