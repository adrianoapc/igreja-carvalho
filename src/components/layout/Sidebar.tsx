import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  HeartHandshake,
  Music,
  DollarSign,
  Settings,
  BookOpen,
  CalendarDays,
  MessageSquareHeart,
  Baby,
  Video,
  Home,
  Briefcase,
  ClipboardCheck, 
  GraduationCap, 
  CalendarCheck,
  Megaphone,
  MonitorPlay,
  Share2
} from "lucide-react";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { useAppConfig } from "@/hooks/useAppConfig";
import UserMenu from "./UserMenu";
import { Skeleton } from "@/components/ui/skeleton";

type MenuItem = {
  title: string;
  url: string;
  icon: any;
  permission?: Permission; 
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
  permission?: Permission; 
};

const MENU_GROUPS: MenuGroup[] = [
  // 1. Visão Geral (Para Todos)
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Mural & Avisos", url: "/mural", icon: MonitorPlay }, // ✅ Movidor para cá e público
      { title: "Minha Família", url: "/perfil/familia", icon: Home },
      { title: "Minhas Escalas", url: "/minhas-escalas", icon: CalendarCheck },
      { title: "Meus Cursos", url: "/cursos", icon: GraduationCap },
    ],
  },
  
  // 2. Cuidado de Pessoas
  {
    label: "Pessoas & Cuidado",
    items: [
      { title: "Membros & Visitantes", url: "/pessoas", icon: Users, permission: "pessoas.view" },
      { title: "Gabinete Pastoral", url: "/gabinete", icon: HeartHandshake, permission: "gabinete.view" },
      { title: "Pedidos de Oração", url: "/intercessao", icon: MessageSquareHeart }, 
    ],
  },

  // 3. Comunicação & Mídia (Gestão)
  {
    label: "Comunicação & Mídia",
    items: [
      // Mural saiu daqui
      { title: "Comunicados (Push)", url: "/comunicados", icon: Megaphone, permission: "ministerio.view" },
      { title: "Publicação Social", url: "/publicacao", icon: Share2, permission: "ministerio.view" },
      { title: "Arquivos & Mídias", url: "/midias", icon: Video, permission: "ministerio.view" },
    ],
    permission: "ministerio.view"
  },

  // 4. Operação Ministerial
  {
    label: "Ministérios & Operação",
    items: [
      { title: "Chamada Rápida", url: "/chamada", icon: ClipboardCheck, permission: "ministerio.view" },
      { title: "Escalas (Gestão)", url: "/escalas", icon: CalendarDays, permission: "ministerio.view" },
      { title: "Cultos & Liturgia", url: "/cultos", icon: Music, permission: "ministerio.view" },
      { title: "Kids", url: "/kids", icon: Baby, permission: "ministerio.view" },
      { title: "Ensino (Gestão)", url: "/ensino", icon: BookOpen, permission: "ensino.view" },
    ],
  },

  // 5. Backoffice
  {
    label: "Gestão Administrativa",
    items: [
      { title: "Projetos", url: "/projetos", icon: Briefcase, permission: "ministerio.view" },
      { title: "Financeiro", url: "/financas", icon: DollarSign, permission: "financeiro.view" },
      { title: "Configurações", url: "/configuracoes", icon: Settings, permission: "configuracoes.view" },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { checkPermission, isAdmin, loading } = usePermissions();
  const { config } = useAppConfig();
  
  const [filteredGroups, setFilteredGroups] = useState<MenuGroup[]>([]);
  const [isFiltering, setIsFiltering] = useState(true);

  useEffect(() => {
    const filterMenu = async () => {
      if (loading) return;

      const newGroups: MenuGroup[] = [];

      for (const group of MENU_GROUPS) {
        if (group.permission) {
          const canView = isAdmin || (await checkPermission(group.permission));
          if (!canView) continue;
        }

        const validItems: MenuItem[] = [];
        for (const item of group.items) {
          if (!item.permission) {
            validItems.push(item);
          } else {
            const hasAccess = isAdmin || (await checkPermission(item.permission));
            if (hasAccess) validItems.push(item);
          }
        }

        if (validItems.length > 0) {
          newGroups.push({ ...group, items: validItems });
        }
      }

      setFilteredGroups(newGroups);
      setIsFiltering(false);
    };

    filterMenu();
  }, [loading, isAdmin, checkPermission]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg shrink-0">
            {config?.logo_url ? (
              <img src={config.logo_url} alt="Logo" className="w-full h-full object-cover rounded-lg" />
            ) : (
              "IC"
            )}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">{config?.nome_igreja || "Igreja App"}</span>
            <span className="truncate text-xs text-muted-foreground">Gestão Ministerial</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {(loading || isFiltering) ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = 
                      location.pathname === item.url || 
                      (item.url !== "/" && location.pathname.startsWith(item.url));

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                          <Link to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}