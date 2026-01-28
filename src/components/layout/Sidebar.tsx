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
  Share2,
  Heart,
  Sparkles,
  Smile,
  Target,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { useAppConfig } from "@/hooks/useAppConfig";
import UserMenu from "./UserMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { FilialSwitcher } from "./FilialSwitcher";

type MenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: Permission;
};
type MenuGroup = {
  label: string;
  items: MenuItem[];
  permission?: Permission;
};

const MENU_GROUPS: MenuGroup[] = [
  {
    label: "📋 VISÃO GERAL",
    items: [
      { title: "Início", url: "/", icon: LayoutDashboard },
      { title: "Mural & Avisos", url: "/mural", icon: MonitorPlay },
      { title: "Diário de Oração", url: "/intercessao/diario", icon: Heart },
      { title: "Agenda", url: "/eventos/lista", icon: CalendarDays },
      { title: "Voluntariado", url: "/voluntariado", icon: Briefcase },
      { title: "Minha Jornada", url: "/voluntariado/minha-jornada", icon: Target },
      { title: "Meus Cursos", url: "/cursos", icon: GraduationCap },
      { title: "Minha Família", url: "/perfil/wallet", icon: Users },
      { title: "Minhas Escalas", url: "/minhas-escalas", icon: CalendarCheck },
    ],
  },
  {
    label: "⚡ MINISTÉRIOS",
    items: [
      {
        title: "Intercessão › Sala de Guerra",
        url: "/intercessao/sala-de-guerra",
        icon: MessageSquareHeart,
        permission: "ministerio.view",
      },
      {
        title: "Kids",
        url: "/kids/dashboard",
        icon: Baby,
        permission: "ministerio.view",
      },
      {
        title: "Kids › Gestão",
        url: "/kids",
        icon: Baby,
        permission: "ministerio.view",
      },
      {
        title: "Voluntariado › Gestão",
        url: "/voluntariado/candidatos",
        icon: ClipboardCheck,
        permission: "ministerio.view",
      },
      {
        title: "Voluntariado › Integração",
        url: "/voluntariado/integracao",
        icon: ClipboardCheck,
        permission: "ministerio.view",
      },
      {
        title: "Voluntariado › Testes",
        url: "/voluntariado/testes",
        icon: ClipboardCheck,
        permission: "ministerio.view",
      },
      {
        title: "Escalas",
        url: "/escalas",
        icon: CalendarCheck,
        permission: "ministerio.view",
      },
      {
        title: "Eventos › Gestão",
        url: "/eventos",
        icon: CalendarDays,
        permission: "ministerio.view",
      },
      {
        title: "Eventos › Chamada",
        url: "/chamada",
        icon: ClipboardCheck,
        permission: "ministerio.view",
      },
      {
        title: "Ensino & Discipulado",
        url: "/ensino",
        icon: BookOpen,
        permission: "ensino.view",
      },
    ],
  },
  {
    label: "🏛️ GESTÃO & CUIDADO",
    items: [
      {
        title: "Pessoas",
        url: "/pessoas",
        icon: Users,
        permission: "pessoas.view",
      },
      {
        title: "Gabinete Pastoral",
        url: "/gabinete",
        icon: HeartHandshake,
        permission: "gabinete.view",
      },
      {
        title: "Intercessão › Equipes",
        url: "/intercessao/equipes",
        icon: Users,
        permission: "ministerio.view",
      },
      {
        title: "Intercessão › Sentimentos",
        url: "/intercessao/sentimentos",
        icon: Smile,
        permission: "ministerio.view",
      },
      {
        title: "Comunicação",
        url: "/comunicados",
        icon: Megaphone,
        permission: "ministerio.view",
      },
      {
        title: "Mídias",
        url: "/midias",
        icon: Video,
        permission: "ministerio.view",
      },
      {
        title: "Projetos",
        url: "/projetos",
        icon: Briefcase,
        permission: "ministerio.view",
      },
      {
        title: "Financeiro",
        url: "/financas",
        icon: DollarSign,
        permission: "financeiro.view",
      },
      {
        title: "Configurações",
        url: "/configuracoes",
        icon: Settings,
        permission: "configuracoes.view",
      },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { checkPermission, isAdmin, loading } = usePermissions();
  const { igrejaConfig } = useAppConfig();

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
            const hasAccess =
              isAdmin || (await checkPermission(item.permission));
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

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border/40 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          {igrejaConfig?.logo_url ? (
            <img
              src={igrejaConfig.logo_url}
              alt="Logo"
              className="h-8 w-8 rounded-lg object-contain"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">
                {igrejaConfig?.nome_igreja?.charAt(0) || "I"}
              </span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-foreground">
              {igrejaConfig?.nome_igreja || "Igreja"}
            </span>
            {igrejaConfig?.subtitulo && (
              <span className="text-xs text-muted-foreground">
                {igrejaConfig.subtitulo}
              </span>
            )}
          </div>
        </Link>
        <FilialSwitcher className="mt-1" />
      </SidebarHeader>

      <SidebarContent className="px-2">
        {isFiltering || loading ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        className="transition-colors"
                      >
                        <Link to={item.url} className="flex items-center gap-3">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-4">
        <UserMenu />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
