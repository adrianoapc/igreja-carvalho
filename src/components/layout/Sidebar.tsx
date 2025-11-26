import { NavLink } from "react-router-dom";
import { Home, Users, MessageCircle, Heart, Calendar, DollarSign, BookOpen, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: Users, label: "Membros", path: "/membros" },
  { icon: UserPlus, label: "Visitantes", path: "/visitantes" },
  { icon: MessageCircle, label: "Pedidos de Oração", path: "/oracoes" },
  { icon: Heart, label: "Testemunhos", path: "/testemunhos" },
  { icon: Calendar, label: "Cultos", path: "/cultos" },
  { icon: DollarSign, label: "Finanças", path: "/financas" },
  { icon: BookOpen, label: "Ensinamentos", path: "/ensinamentos" },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold text-sidebar-foreground">Igreja App</h1>
        <p className="text-sm text-sidebar-foreground/70 mt-1">Gestão Completa</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  "hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-soft"
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className="px-4 py-2">
          <p className="text-xs text-sidebar-foreground/60">v1.0.0</p>
        </div>
      </div>
    </aside>
  );
}
