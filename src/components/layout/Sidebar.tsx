import { NavLink } from "@/components/NavLink";
import { Home, Users, MessageCircle, Heart, Calendar, DollarSign, BookOpen, UserPlus, Megaphone, Baby, Shield } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: Megaphone, label: "Banners", path: "/banners" },
  { icon: Users, label: "Membros", path: "/membros" },
  { icon: UserPlus, label: "Visitantes", path: "/visitantes" },
  { icon: Baby, label: "Kids", path: "/kids" },
  { icon: MessageCircle, label: "Pedidos de Oração", path: "/oracoes" },
  { icon: Heart, label: "Testemunhos", path: "/testemunhos" },
  { icon: Calendar, label: "Cultos", path: "/cultos" },
  { icon: DollarSign, label: "Finanças", path: "/financas" },
  { icon: BookOpen, label: "Ensinamentos", path: "/ensinamentos" },
  { icon: Shield, label: "Administração", path: "/admin" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-6 border-b border-sidebar-border">
          {!isCollapsed && (
            <>
              <h1 className="text-2xl font-bold text-sidebar-foreground">Igreja App</h1>
              <p className="text-sm text-sidebar-foreground/70 mt-1">Gestão Completa</p>
            </>
          )}
          {isCollapsed && (
            <h1 className="text-xl font-bold text-sidebar-foreground text-center">IA</h1>
          )}
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
