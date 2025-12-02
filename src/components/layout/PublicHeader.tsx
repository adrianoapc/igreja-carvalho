import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Download, LogIn } from "lucide-react";
import logoCarvalho from "@/assets/logo-carvalho.png";

interface PublicHeaderProps {
  showBackButton?: boolean;
  backTo?: string;
  title?: string;
  subtitle?: string;
}

export function PublicHeader({ 
  showBackButton = false, 
  backTo = "/public",
  title,
  subtitle 
}: PublicHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isPublicHome = location.pathname === "/public";

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBackButton ? (
            <Button variant="ghost" size="icon" onClick={() => navigate(backTo)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : null}
          
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => navigate("/public")}
          >
            <img src={logoCarvalho} alt="Igreja Carvalho" className="h-10 w-auto" />
            {title ? (
              <div>
                <h1 className="font-semibold text-foreground leading-tight">{title}</h1>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            ) : (
              <span className="font-semibold text-foreground hidden sm:block">Igreja Carvalho</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isPublicHome && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/public")}
              className="text-muted-foreground hover:text-foreground hidden sm:flex"
            >
              Início
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/install")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Download className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Instalar</span>
          </Button>
          <Button 
            onClick={() => navigate("/auth")}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            <LogIn className="w-4 h-4 mr-1" />
            Entrar
          </Button>
        </div>
      </div>
    </header>
  );
}
