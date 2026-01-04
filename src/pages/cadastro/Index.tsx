import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Users, UserPlus, Heart } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";

export default function CadastroIndex() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [igrejaInfo, setIgrejaInfo] = useState({ nome: "Igreja Carvalho", subtitulo: "" });
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  
  const aceitouJesus = searchParams.get("aceitou") === "true";

  useEffect(() => {
    const fetchIgrejaInfo = async () => {
      if (!igrejaId) {
        return;
      }

      const { data } = await supabase
        .from("configuracoes_igreja")
        .select("*")
        .eq("igreja_id", igrejaId)
        .maybeSingle();
      if (data) {
        setIgrejaInfo({ nome: data.nome_igreja, subtitulo: data.subtitulo || "" });
      }
    };
    if (!igrejaLoading) {
      fetchIgrejaInfo();
    }
  }, [igrejaId, igrejaLoading]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader showBackButton backTo="/public" />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-soft">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">
              Bem-vindo(a)!
            </CardTitle>
            <CardDescription className="text-base">
              Ajude a {igrejaInfo.nome} a te conhecer melhor preenchendo seu perfil.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {aceitouJesus && (
              <div className="p-4 bg-primary/10 rounded-lg text-center mb-4">
                <Heart className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">
                  Que alegria saber que você aceitou Jesus! 🎉
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Membro</h3>
                <p className="text-sm text-muted-foreground">
                  Se você é membro da igreja, mantenha seus dados de cadastro atualizados aqui.
                </p>
                <Button 
                  className="w-full" 
                  onClick={() => navigate("/cadastro/membro")}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Atualizar meu perfil de membro
                </Button>
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Visitante</h3>
                <p className="text-sm text-muted-foreground">
                  Se você é visitante da igreja, deixe seu nome e contato aqui.
                </p>
                <Button 
                  variant="outline"
                  className="w-full" 
                  onClick={() => navigate(`/cadastro/visitante${aceitouJesus ? "?aceitou=true" : ""}`)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Cadastrar como visitante
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
