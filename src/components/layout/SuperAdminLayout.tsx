import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  CreditCard,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  Bell,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/superadmin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/superadmin/igrejas", label: "Igrejas", icon: Building2 },
  { href: "/superadmin/metricas", label: "Métricas", icon: BarChart3 },
  { href: "/superadmin/billing", label: "Billing", icon: CreditCard, disabled: true },
  { href: "/superadmin/config", label: "Configurações", icon: Settings, disabled: true },
];

export function SuperAdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();

  const loading = authLoading || superAdminLoading;

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) {
      navigate("/");
      toast.error("Acesso negado. Você não tem permissão para acessar esta área.");
    }
  }, [loading, user, isSuperAdmin, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando credenciais...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Brand */}
            <Link to="/superadmin" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Admin SaaS</span>
            </Link>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              SUPER ADMIN
            </Badge>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/superadmin" && pathname.startsWith(item.href));
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  asChild={!item.disabled}
                  disabled={item.disabled}
                  className={cn(
                    "gap-2",
                    item.disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {item.disabled ? (
                    <>
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </>
                  ) : (
                    <Link to={item.href}>
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )}
                </Button>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2 pr-1">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {profile?.nome?.charAt(0)?.toUpperCase() || "S"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">
                    {profile?.nome?.split(" ")[0] || "Super Admin"}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.nome || "Super Admin"}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/")}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Ir para App Principal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden border-b bg-background px-4 py-2 overflow-x-auto">
        <div className="flex gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/superadmin" && pathname.startsWith(item.href));
            
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                asChild={!item.disabled}
                disabled={item.disabled}
                className={cn(
                  "gap-1.5 flex-shrink-0",
                  item.disabled && "opacity-50"
                )}
              >
                {item.disabled ? (
                  <>
                    <item.icon className="h-4 w-4" />
                    <span className="text-xs">{item.label}</span>
                  </>
                ) : (
                  <Link to={item.href}>
                    <item.icon className="h-4 w-4" />
                    <span className="text-xs">{item.label}</span>
                  </Link>
                )}
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
