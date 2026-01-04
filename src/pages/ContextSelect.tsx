import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Shield, Building2 } from "lucide-react";
import logoCarvalho from "@/assets/logo-carvalho.png";

const CONTEXT_STORAGE_KEY = "preferred_context";

export default function ContextSelect() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const [rememberChoice, setRememberChoice] = useState(false);

  const loading = authLoading || superAdminLoading;

  // Redirect if not authenticated or not super admin
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }
      if (!isSuperAdmin) {
        navigate("/", { replace: true });
      }
    }
  }, [loading, user, isSuperAdmin, navigate]);

  const handleSelectContext = (context: "superadmin" | "app") => {
    if (rememberChoice) {
      localStorage.setItem(CONTEXT_STORAGE_KEY, context);
    }
    
    if (context === "superadmin") {
      navigate("/superadmin", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-16 w-16 rounded-full mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <img
            src={logoCarvalho}
            alt="Logo"
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold tracking-tight">
            Olá, {profile?.nome?.split(" ")[0] || "Admin"}! 👋
          </h1>
          <p className="text-muted-foreground">
            Onde deseja acessar hoje?
          </p>
        </div>

        {/* Context Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Super Admin Panel */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:bg-primary/5 group"
            onClick={() => handleSelectContext("superadmin")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 rounded-full bg-primary/10 text-primary mb-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Shield className="h-8 w-8" />
              </div>
              <CardTitle className="text-lg">Painel SaaS</CardTitle>
              <CardDescription className="text-xs">
                Gerenciar todas as igrejas
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-xs text-muted-foreground">
                Métricas globais, onboarding, billing
              </p>
            </CardContent>
          </Card>

          {/* Church App */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:bg-primary/5 group"
            onClick={() => handleSelectContext("app")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 rounded-full bg-secondary text-secondary-foreground mb-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Building2 className="h-8 w-8" />
              </div>
              <CardTitle className="text-lg">Aplicativo Igreja</CardTitle>
              <CardDescription className="text-xs">
                Usar como membro/admin
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-xs text-muted-foreground">
                Dashboard, pessoas, eventos, etc.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Remember Choice */}
        <div className="flex items-center justify-center gap-2">
          <Checkbox
            id="remember"
            checked={rememberChoice}
            onCheckedChange={(checked) => setRememberChoice(checked === true)}
          />
          <Label 
            htmlFor="remember" 
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Lembrar minha escolha
          </Label>
        </div>

        {/* Hint */}
        <p className="text-center text-xs text-muted-foreground">
          Você pode alternar entre os contextos a qualquer momento
        </p>
      </div>
    </div>
  );
}
