import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Users,
  Calendar,
  Heart,
  Menu,
  UserCircle,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useState, useEffect } from "react";

export function MobileNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, checkPermission, loading } = usePermissions();

  const [hasMinisterioAccess, setHasMinisterioAccess] = useState(false);
  const [hasPessoasAccess, setHasPessoasAccess] = useState(false);
  // Mesma checagem que a Sidebar usa pra mostrar/esconder "Financeiro"
  // (Sidebar.tsx, permission "financeiro.view") — F7 frente 3.
  const [hasFinanceiroAccess, setHasFinanceiroAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (isAdmin) {
        setHasMinisterioAccess(true);
        setHasPessoasAccess(true);
        setHasFinanceiroAccess(true);
        return;
      }
      const [ministerio, pessoas, financeiro] = await Promise.all([
        checkPermission("ministerio.view"),
        checkPermission("pessoas.view"),
        checkPermission("financeiro.view"),
      ]);
      setHasMinisterioAccess(ministerio);
      setHasPessoasAccess(pessoas);
      setHasFinanceiroAccess(financeiro);
    };
    if (!loading) {
      checkAccess();
    }
  }, [isAdmin, checkPermission, loading]);

  const agendaPath = "/eventos/lista";
  const pessoasPath = hasPessoasAccess ? "/pessoas" : "/perfil";
  const PessoasIcon = hasPessoasAccess ? Users : UserCircle;
  const pessoasLabel = hasPessoasAccess ? "Pessoas" : "Perfil";

  const navItems = [
    {
      label: "Início",
      icon: Home,
      path: "/",
      activeColor: "text-blue-600",
    },
    {
      label: "Agenda",
      icon: Calendar,
      path: agendaPath,
      activeColor: "text-purple-600",
    },
    {
      label: "Oração",
      icon: Heart,
      path: "/intercessao",
      activeColor: "text-red-600",
    },
    {
      label: pessoasLabel,
      icon: PessoasIcon,
      path: pessoasPath,
      activeColor: "text-orange-600",
    },
    // Só aparece pra quem tem acesso ao financeiro (mesma checagem da
    // Sidebar) — quem não tem continua vendo exatamente os 5 itens de
    // sempre, zero mudança visual (F7 frente 3).
    ...(hasFinanceiroAccess
      ? [
          {
            label: "Finanças",
            icon: DollarSign,
            path: "/financas",
            activeColor: "text-emerald-600",
          },
        ]
      : []),
    {
      label: "Menu",
      icon: Menu,
      // O Menu geralmente abre a Sidebar ou um Drawer.
      // Como estamos no mobile, podemos simular o clique no Trigger da Sidebar
      // ou navegar para uma página de menu dedicada se houver.
      // Por enquanto, vamos usar um hack simples para abrir a sidebar do Shadcn.
      action: () =>
        document
          .querySelector<HTMLElement>('[data-sidebar="trigger"]')
          ?.click(),
      path: "#menu",
      activeColor: "text-gray-600",
    },
  ];

  // Com "Finanças" o nav passa de 5 pra 6 ícones — reduz um pouco o
  // ícone/padding pra não apertar em telas estreitas (~360-375px); quem
  // não tem acesso ao financeiro não é afetado (continua nos 5 de sempre
  // no tamanho original). F7 frente 3.
  const isCompact = navItems.length > 5;
  const iconSize = isCompact ? 22 : 24;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/40 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)] md:hidden transition-all duration-300">
      <div
        className={cn(
          "flex items-center justify-around h-16",
          isCompact ? "px-0.5" : "px-2"
        )}
      >
        {navItems.map((item) => {
          // Verifica se está ativo (tratando sub-rotas)
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" &&
              item.path !== "#menu" &&
              location.pathname.startsWith(item.path));

          return (
            <button
              key={item.label}
              onClick={() =>
                item.action ? item.action() : navigate(item.path)
              }
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 outline-none focus:outline-none",
                isActive
                  ? item.activeColor
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "rounded-xl transition-all duration-300",
                  isCompact ? "p-1" : "p-1.5",
                  isActive
                    ? "bg-primary/10 translate-y-[-2px]"
                    : "bg-transparent"
                )}
              >
                <item.icon
                  size={iconSize}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={cn("transition-all", isActive && "scale-110")}
                />
              </div>
              <span
                className={cn(
                  "font-medium transition-all",
                  isCompact ? "text-[9px]" : "text-[10px]",
                  isActive ? "opacity-100 font-bold" : "opacity-70"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
